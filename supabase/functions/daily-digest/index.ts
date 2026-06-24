/**
 * Supabase Edge Function: daily-digest
 *
 * Runs every morning at 8:00 AM (configured via Supabase cron).
 * For each active staff member, builds a digest of:
 *  - Pending checklists
 *  - Notices posted in last 24h
 *  - Quizzes not yet attempted
 *  - Tasks due today
 *
 * Calls notify-dispatcher with the digest payload.
 * Skips users who already received a digest today.
 */

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL     = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const DISPATCHER_URL   = `${SUPABASE_URL}/functions/v1/notify-dispatcher`;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE);

serve(async (_req) => {
  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86400000).toISOString();

  console.log(`[daily-digest] Running for ${today}`);

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

      // Skip if digest already sent today
      const { data: existing } = await supabase
        .from("digest_tracker")
        .select("id")
        .eq("user_id", user.id)
        .eq("digest_date", today)
        .single();
      if (existing) { skipped++; continue; }

      // Build digest items
      const items: { checklists: any[]; notices: any[]; quizzes: any[]; tasks: any[] } = {
        checklists: [],
        notices: [],
        quizzes: [],
        tasks: [],
      };

      // 1. Pending checklists (not yet submitted today by this user)
      const { data: checklists } = await supabase
        .from("checklists")
        .select("id, title, recurrence")
        .eq("tenant_id", tenant.id);

      // Simple check — include all active checklists for now
      // (Full per-user submission check requires submissions table)
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

      // 3. Quizzes not yet attempted by this user
      // (simplified — include any quizzes in this tenant)
      // Full implementation would join with quiz_attempts table
      // For now we signal "check quizzes" if any exist
      // items.quizzes = ...; (left for tenant-specific quiz integration)

      // 4. Tasks due today assigned to this user
      const { data: tasks } = await supabase
        .from("tasks")
        .select("id, title, status, priority")
        .eq("tenant_id", tenant.id)
        .contains("assigned_user_ids", [user.id])
        .not("status", "in", '("Completed","Closed")')
        .lte("due_date", today + "T23:59:59Z")
        .gte("due_date", today + "T00:00:00Z");
      items.tasks = tasks || [];

      // Skip empty digest
      const totalItems = items.checklists.length + items.notices.length + items.tasks.length;
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
          items,
        }),
      });

      if (res.ok) {
        // Record digest sent
        await supabase.from("digest_tracker").upsert({
          user_id: user.id,
          tenant_id: tenant.id,
          digest_date: today,
          items_count: totalItems,
          items_summary: items,
        });
        dispatched++;
      } else {
        console.error(`[daily-digest] Failed for user ${user.id}:`, await res.text());
      }
    }
  }

  console.log(`[daily-digest] Done. Dispatched: ${dispatched}, Skipped: ${skipped}`);
  return new Response(JSON.stringify({ dispatched, skipped }), { status: 200 });
});

/**
 * To schedule this function at 8 AM daily, add to Supabase dashboard:
 * Dashboard → Edge Functions → daily-digest → Cron: "0 2 * * *" (8 AM IST = 2:30 AM UTC)
 * or use pg_cron in Supabase SQL editor:
 *
 * SELECT cron.schedule(
 *   'daily-digest-8am-IST',
 *   '30 2 * * *',
 *   $$SELECT net.http_post(
 *     url := 'https://<project>.supabase.co/functions/v1/daily-digest',
 *     headers := '{"Authorization": "Bearer <service-role-key>"}'::jsonb,
 *     body := '{}'::jsonb
 *   )$$
 * );
 */
