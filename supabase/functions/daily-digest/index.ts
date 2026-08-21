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

  let dispatched = 0;
  let skipped = 0;

  for (const tenant of (tenants || [])) {
    // Staff of this outlet (super admins excluded from the digest).
    const { data: users } = await supabase
      .from("users")
      .select("id, name, whatsapp_opted_in, phone_number, fcm_token, department, role, tenant_id")
      .eq("tenant_id", tenant.id)
      .not("role", "eq", "Super Admin");
    if (!users || users.length === 0) continue;

    // ── Per-outlet data shared across its users ─────────────────────────────
    // Pending checklists (SOP/quiz rows that share the table are filtered out).
    const { data: tenantChecklists } = await supabase
      .from("checklists")
      .select("id, title, description")
      .eq("tenant_id", tenant.id);
    const checklists = (tenantChecklists || []).filter((c: any) => {
      try {
        if (typeof c.description === "string" && c.description.startsWith("{")) {
          const o = JSON.parse(c.description);
          if (o.type === "sop" || o.type === "quiz") return false;
        }
      } catch { /* plain-text description = real checklist */ }
      return true;
    }).slice(0, 3);

    // Notices posted in the last 24h.
    const { data: recentNotices } = await supabase
      .from("notices")
      .select("id, title")
      .eq("tenant_id", tenant.id)
      .gte("created_at", yesterday)
      .order("created_at", { ascending: false })
      .limit(3);

    // Published trainings for this outlet's client + who has already passed them,
    // so we can compute each user's PENDING training list (mirrors
    // trainingService.trainingMatchesUser: outlets[]/dept/role wildcards).
    const { data: clientTrainings } = await supabase
      .from("trainings")
      .select("id, title, outlets, department, role, questions")
      .eq("client_id", tenant.client_id)
      .eq("published", true);
    const trainingIds = (clientTrainings || []).map((t: any) => t.id);
    const passedByUser: Record<string, Set<string>> = {};
    if (trainingIds.length) {
      const { data: atts } = await supabase
        .from("training_attempts")
        .select("training_id, user_id, passed")
        .in("training_id", trainingIds);
      for (const a of (atts || [])) {
        if (a.passed) (passedByUser[a.user_id] ??= new Set<string>()).add(a.training_id);
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
      const { data: aTasks } = await supabase.from("tasks").select("id")
        .eq("tenant_id", tenant.id).or(mine);
      const { data: cTasks } = await supabase.from("tasks").select("id")
        .eq("tenant_id", tenant.id).eq("created_by_user_id", user.id);
      const myTaskIds = [...new Set([...(aTasks || []), ...(cTasks || [])].map((t: any) => t.id))];
      let chats: any[] = [];
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
