/**
 * Supabase Edge Function: daily-digest
 *
 * Runs twice a day (configured via Supabase cron):
 *  - "morning" (~8:00 AM IST)
 *  - "evening" (~6:30 PM IST)
 *
 * Both runs summarise, per user: open TASKS assigned to them, pending
 * CHECKLISTS in their outlet, pending TRAININGS targeted to them, and recent
 * NOTICES. Calls notify-dispatcher with the digest payload; skips users who
 * already received this run's digest today.
 */

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL     = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const DISPATCHER_URL   = `${SUPABASE_URL}/functions/v1/notify-dispatcher`;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE);

// ── Plan → feature entitlements (mirrors src/services/plans.ts) ───────────────
// The digest is plan-gated: each client only gets the sections its plan pays for
// (tasks/chats → tasks, checklists → checklists, notices → notices, training →
// training). Keep this table in sync with plans.ts PLAN_BASE.
type FeatureKey = "tasks" | "notices" | "checklists" | "maintenance" | "training" | "sops";
const TRIAL_MS = 15 * 24 * 60 * 60 * 1000;
const ALL_FEATURES: FeatureKey[] = ["tasks", "notices", "checklists", "maintenance", "training", "sops"];
const PLAN_BASE: Record<string, FeatureKey[]> = {
  Essential: ["tasks"],
  Pro: ["tasks", "checklists", "maintenance", "notices"],
  Enterprise: ["tasks", "checklists", "maintenance", "notices", "training", "sops"],
  Training: ["training"],
};
function planFeatures(plan?: string, trainingAddon?: boolean, createdAt?: string): Set<FeatureKey> {
  if (plan === "Free") {
    const created = createdAt ? new Date(createdAt).getTime() : Date.now();
    return new Set(Date.now() - created <= TRIAL_MS ? ALL_FEATURES : []);
  }
  const base = [...(PLAN_BASE[plan || ""] || PLAN_BASE.Enterprise)]; // unknown plan → all sections
  if (trainingAddon && (plan === "Essential" || plan === "Pro") && !base.includes("training")) base.push("training");
  return new Set(base);
}

type RunMode = "morning" | "evening";

serve(async (req) => {
  let runMode: RunMode = "morning";
  try {
    const body = await req.json();
    if (body?.runMode === "evening") runMode = "evening";
  } catch {
    // No body (manual trigger) — default to morning
  }

  const today = new Date().toISOString().slice(0, 10);
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86400000).toISOString();

  console.log(`[daily-digest] Running ${runMode} digest for ${today}`);

  // All outlets, with their client id (needed to scope trainings).
  const { data: tenants } = await supabase.from("tenants").select("id, client_id");

  // Client-level plan + digest opt-out. digest_enabled = false silences the whole
  // client's digest (both channels, every section); flip it back to true to
  // re-activate with no redeploy. plan/training_addon/created_at drive section
  // gating (#4). digest_enabled defaults to true, so a client missing the column
  // (or the whole client row) is treated as enabled.
  const { data: clientRows } = await supabase
    .from("clients")
    .select("id, plan, training_addon, created_at, digest_enabled");
  const clientsById = new Map((clientRows || []).map((c: any) => [c.id, c]));

  let dispatched = 0;
  let skipped = 0;

  for (const tenant of (tenants || [])) {
    const client = clientsById.get(tenant.client_id);
    // Whole-client kill switch — skip every user of a disabled client.
    if (client && client.digest_enabled === false) continue;
    // Sections the client's plan actually pays for (#4). Anything not in `feat`
    // is left empty below, so the digest never mentions a feature they lack.
    const feat = planFeatures(client?.plan, client?.training_addon, client?.created_at);

    // Staff of this outlet (super admins excluded from the digest).
    const { data: users } = await supabase
      .from("users")
      .select("id, name, whatsapp_opted_in, phone_number, fcm_token, department, role, tenant_id")
      .eq("tenant_id", tenant.id)
      .not("role", "eq", "Super Admin");
    if (!users || users.length === 0) continue;

    // ── Per-outlet data shared across its users (each section plan-gated) ────
    // Pending checklists (SOP/quiz rows that share the table are filtered out).
    let checklists: any[] = [];
    if (feat.has("checklists")) {
      const { data: tenantChecklists } = await supabase
        .from("checklists")
        .select("id, title, description")
        .eq("tenant_id", tenant.id);
      checklists = (tenantChecklists || []).filter((c: any) => {
        try {
          if (typeof c.description === "string" && c.description.startsWith("{")) {
            const o = JSON.parse(c.description);
            if (o.type === "sop" || o.type === "quiz") return false;
          }
        } catch { /* plain-text description = real checklist */ }
        return true;
      }).slice(0, 3);
    }

    // Notices posted in the last 24h.
    let recentNotices: any[] = [];
    if (feat.has("notices")) {
      const { data } = await supabase
        .from("notices")
        .select("id, title")
        .eq("tenant_id", tenant.id)
        .gte("created_at", yesterday)
        .order("created_at", { ascending: false })
        .limit(3);
      recentNotices = data || [];
    }

    // Published trainings for this outlet's client + who has already passed them,
    // so we can compute each user's PENDING training list (mirrors
    // trainingService.trainingMatchesUser: outlets[]/dept/role wildcards).
    let clientTrainings: any[] = [];
    const passedByUser: Record<string, Set<string>> = {};
    if (feat.has("training")) {
      const { data } = await supabase
        .from("trainings")
        .select("id, title, outlets, department, role, questions")
        .eq("client_id", tenant.client_id)
        .eq("published", true);
      clientTrainings = data || [];
      const trainingIds = clientTrainings.map((t: any) => t.id);
      if (trainingIds.length) {
        const { data: atts } = await supabase
          .from("training_attempts")
          .select("training_id, user_id, passed")
          .in("training_id", trainingIds);
        for (const a of (atts || [])) {
          if (a.passed) (passedByUser[a.user_id] ??= new Set<string>()).add(a.training_id);
        }
      }
    }

    // ── Per-user assembly ───────────────────────────────────────────────────
    for (const user of users) {
      // Needs at least one delivery channel configured.
      if ((!user.phone_number || !user.whatsapp_opted_in) && !user.fcm_token) { skipped++; continue; }

      // Already sent this run today?
      const { data: existing } = await supabase
        .from("digest_tracker").select("id")
        .eq("user_id", user.id).eq("digest_date", today).eq("run_mode", runMode).single();
      if (existing) { skipped++; continue; }

      // Tasks this user is PRIMARY on or CC'd on (CC users get their tasks only
      // through the digest — no WhatsApp — so both must be included here).
      const mine = `assigned_user_ids.cs.{${user.id}},cc_user_ids.cs.{${user.id}}`;
      let tasks: any[] = [];
      if (feat.has("tasks")) {
        if (runMode === "morning") {
          // Due today or overdue, still open.
          const { data } = await supabase.from("tasks")
            .select("id, title, status, priority")
            .eq("tenant_id", tenant.id)
            .or(mine)
            .not("status", "in", '("Completed","Closed")')
            .lte("due_date", today + "T23:59:59Z");
          tasks = data || [];
        } else {
          // Still open today + anything due tomorrow.
          const { data: openToday } = await supabase.from("tasks")
            .select("id, title, status, priority")
            .eq("tenant_id", tenant.id)
            .or(mine)
            .not("status", "in", '("Completed","Closed")')
            .lte("due_date", today + "T23:59:59Z");
          const { data: dueTomorrow } = await supabase.from("tasks")
            .select("id, title, status, priority")
            .eq("tenant_id", tenant.id)
            .or(mine)
            .not("status", "in", '("Completed","Closed")')
            .gte("due_date", tomorrow + "T00:00:00Z")
            .lte("due_date", tomorrow + "T23:59:59Z");
          tasks = [...(openToday || []), ...(dueTomorrow || [])];
        }
      }

      // Pending trainings targeted to this user.
      const passed = passedByUser[user.id] || new Set<string>();
      const training = (clientTrainings || []).filter((t: any) => {
        if (!(t.questions?.length)) return false;
        if (passed.has(t.id)) return false;
        const outletOk = !Array.isArray(t.outlets) || t.outlets.length === 0 || t.outlets.includes(user.tenant_id);
        const deptOk = String(t.department || "All Departments") === "All Departments" || String(t.department) === String(user.department);
        const roleOk = String(t.role || "All Roles") === "All Roles" || String(t.role) === String(user.role);
        return outletOk && deptOk && roleOk;
      }).slice(0, 3);

      // New task-chat messages (last 24h) on this user's tasks — assigned to them
      // or created by them — from someone else. Chats don't push; they land here.
      // Gated with tasks: a client without the tasks feature has no task chats.
      let chats: any[] = [];
      if (feat.has("tasks")) {
        const { data: aTasks } = await supabase.from("tasks").select("id")
          .eq("tenant_id", tenant.id).or(mine);
        const { data: cTasks } = await supabase.from("tasks").select("id")
          .eq("tenant_id", tenant.id).eq("created_by_user_id", user.id);
        const myTaskIds = [...new Set([...(aTasks || []), ...(cTasks || [])].map((t: any) => t.id))];
        if (myTaskIds.length) {
          const { data: msgs } = await supabase.from("task_messages")
            .select("task_id, sender_name, message")
            .in("task_id", myTaskIds)
            .gte("timestamp", yesterday)
            .neq("user_id", user.id)
            .order("timestamp", { ascending: false })
            .limit(20);
          chats = msgs || [];
        }
      }

      const items = {
        checklists,
        notices: recentNotices || [],
        tasks,
        training,
        chats,
        mentions: [],
      };

      const totalItems = items.checklists.length + items.notices.length + items.tasks.length + items.training.length + items.chats.length;
      if (totalItems === 0) { skipped++; continue; }

      const res = await fetch(DISPATCHER_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${SUPABASE_SERVICE}`,
        },
        body: JSON.stringify({ type: "DIGEST", userId: user.id, tenantId: tenant.id, runMode, items }),
      });

      if (res.ok) {
        await supabase.from("digest_tracker").upsert({
          user_id: user.id,
          tenant_id: tenant.id,
          digest_date: today,
          run_mode: runMode,
          items_count: totalItems,
          items_summary: items,
        });
        dispatched++;
      } else {
        console.error(`[daily-digest] Failed for user ${user.id}:`, await res.text());
      }

      // Morning-only WhatsApp "reply Hi" nudge — sent ONLY to users who have real
      // pending items AND WhatsApp, so it stays transactional (Utility) and cheap.
      // The digest itself is push-only; this single Utility ping earns the free
      // 24h window when they reply Hi.
      if (runMode === "morning" && user.phone_number && user.whatsapp_opted_in) {
        // Bold, capitalized labels — each added ONLY when that category has items,
        // so the line never shows an empty category. This is a WhatsApp template
        // variable, so it must stay a SINGLE line (no newlines allowed there).
        const bits: string[] = [];
        if (items.tasks.length)      bits.push("*Pending Tasks*");
        if (items.notices.length)    bits.push("*Unread Notices*");
        if (items.checklists.length) bits.push("*Pending Checklists*");
        if (items.training.length)   bits.push("*Pending Training Assessment*");
        // Join grammatically: "a", "a and b", "a, b and c".
        const joined = bits.length <= 1
          ? (bits[0] || "")
          : `${bits.slice(0, -1).join(", ")} and ${bits[bits.length - 1]}`;
        const summary = bits.length ? `You have ${joined} today.` : "You have updates today.";
        await fetch(DISPATCHER_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${SUPABASE_SERVICE}` },
          body: JSON.stringify({ type: "NUDGE", userId: user.id, tenantId: tenant.id, summary }),
        }).catch(() => { /* non-fatal */ });
      }
    }
  }

  console.log(`[daily-digest] Done (${runMode}). Dispatched: ${dispatched}, Skipped: ${skipped}`);
  return new Response(JSON.stringify({ runMode, dispatched, skipped }), { status: 200 });
});

/**
 * Cron setup (pg_cron, run in Supabase SQL editor — see
 * supabase/migrations/20260626_digest_run_mode.sql for the exact
 * cron.schedule calls for both the morning and evening runs).
 */
