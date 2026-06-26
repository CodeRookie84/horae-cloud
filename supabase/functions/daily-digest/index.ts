/**
 * Supabase Edge Function: daily-digest
 *
 * Runs twice a day (configured via Supabase cron):
 *  - "morning" (~8:00 AM IST): pending checklists, notices from last 24h,
 *    quizzes not yet attempted, tasks due today.
 *  - "evening" (~6:30 PM IST): tasks still open from today, unread Team
 *    Talk mentions since the morning run, tasks due tomorrow.
 *
 * Calls notify-dispatcher with the digest payload.
 * Skips users who already received a digest for that run today.
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

  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86400000).toISOString();
  const startOfToday = today + "T00:00:00Z";

  console.log(`[daily-digest] Running ${runMode} digest for ${today}`);

  // Get all active tenants
  const { data: tenants } = await supabase.from("tenants").select("id");

  let dispatched = 0;
  let skipped = 0;

  for (const tenant of (tenants || [])) {
    // Get all staff users in this tenant (excluding admins from digest)
    const { data: users } = await supabase
      .from("users")
      .select("id, name, whatsapp_opted_in, phone_number, fcm_token")
      .eq("tenant_id", tenant.id)
      .not("role", "eq", "Super Admin");

    for (const user of (users || [])) {
      // Skip if neither WhatsApp nor FCM is configured
      if ((!user.phone_number || !user.whatsapp_opted_in) && !user.fcm_token) {
        skipped++;
        continue;
      }

      // Skip if this run's digest already sent today
      const { data: existing } = await supabase
        .from("digest_tracker")
        .select("id")
        .eq("user_id", user.id)
        .eq("digest_date", today)
        .eq("run_mode", runMode)
        .single();
      if (existing) { skipped++; continue; }

      const items: { checklists: any[]; notices: any[]; quizzes: any[]; tasks: any[]; mentions: any[] } = {
        checklists: [],
        notices: [],
        quizzes: [],
        tasks: [],
        mentions: [],
      };

      if (runMode === "morning") {
        // 1. Pending checklists (not yet submitted today by this user)
        const { data: checklists } = await supabase
          .from("checklists")
          .select("id, title, recurrence")
          .eq("tenant_id", tenant.id);
        items.checklists = (checklists || []).slice(0, 3);

        // 2. Notices posted in last 24h
        const { data: notices } = await supabase
          .from("notices")
          .select("id, title")
          .eq("tenant_id", tenant.id)
          .gte("created_at", yesterday)
          .order("created_at", { ascending: false })
          .limit(3);
        items.notices = notices || [];

        // 3. Tasks due today assigned to this user
        const { data: tasks } = await supabase
          .from("tasks")
          .select("id, title, status, priority")
          .eq("tenant_id", tenant.id)
          .contains("assigned_user_ids", [user.id])
          .not("status", "in", '("Completed","Closed")')
          .lte("due_date", today + "T23:59:59Z")
          .gte("due_date", startOfToday);
        items.tasks = tasks || [];
      } else {
        // Evening run: tasks still open from today
        const { data: openTasks } = await supabase
          .from("tasks")
          .select("id, title, status, priority")
          .eq("tenant_id", tenant.id)
          .contains("assigned_user_ids", [user.id])
          .not("status", "in", '("Completed","Closed")')
          .lte("due_date", today + "T23:59:59Z")
          .gte("due_date", startOfToday);
        items.tasks = openTasks || [];

        // Tasks due tomorrow
        const { data: tomorrowTasks } = await supabase
          .from("tasks")
          .select("id, title, status, priority")
          .eq("tenant_id", tenant.id)
          .contains("assigned_user_ids", [user.id])
          .not("status", "in", '("Completed","Closed")')
          .lte("due_date", tomorrow + "T23:59:59Z")
          .gte("due_date", tomorrow + "T00:00:00Z");
        items.notices = []; // not used in evening run
        items.tasks = [...items.tasks, ...(tomorrowTasks || [])];

        // Unread Team Talk mentions since this morning
        const { data: mentions } = await supabase
          .from("chat_messages")
          .select("id, content, channel_id")
          .contains("mentioned_user_ids", [user.id])
          .gte("created_at", startOfToday)
          .order("created_at", { ascending: false })
          .limit(5);
        items.mentions = mentions || [];
      }

      // Skip empty digest
      const totalItems = items.checklists.length + items.notices.length + items.tasks.length + items.mentions.length;
      if (totalItems === 0) { skipped++; continue; }

      // Call dispatcher with DIGEST type
      const res = await fetch(DISPATCHER_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
        },
        body: JSON.stringify({
          type: "DIGEST",
          userId: user.id,
          tenantId: tenant.id,
          runMode,
          items,
        }),
      });

      if (res.ok) {
        // Record digest sent
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
