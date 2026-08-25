/**
 * Supabase Edge Function: purge-demos
 *
 * Hard-deletes expired demo (sales-trial) clients and everything under them,
 * 30 days after their access window (`demo_expires_at`) closed. That grace
 * period means a prospect keeps their (read-only) demo for a while after it
 * ends, and nothing lingers in storage beyond ~a month.
 *
 * Runs on the service_role key (bypasses RLS). No caller JWT is required — this
 * is meant to be invoked by a scheduler (pg_cron / Supabase scheduled trigger),
 * not the browser. It is guarded by a shared secret header so a stray public
 * call can't trigger deletions: set PURGE_SECRET and send `x-purge-secret`.
 *
 * Safety: only ever touches rows where clients.is_demo = true. A paying client
 * can never be selected here, whatever its plan or age.
 *
 * Schedule it (Supabase SQL editor, pg_cron) e.g. daily at 03:00 UTC:
 *
 *   select cron.schedule('purge-demos-daily', '0 3 * * *', $$
 *     select net.http_post(
 *       url     := 'https://<project-ref>.supabase.co/functions/v1/purge-demos',
 *       headers := jsonb_build_object('x-purge-secret', '<PURGE_SECRET>'),
 *       body    := '{}'::jsonb
 *     );
 *   $$);
 */
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const PURGE_SECRET = Deno.env.get("PURGE_SECRET") || "";
const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

// Access window + 30 days = when a demo becomes eligible for deletion.
const GRACE_DAYS = 30;

// Tenant-scoped tables to sweep by tenant_id. Best-effort: a missing table or
// column is ignored so this keeps working as the schema evolves.
const TENANT_TABLES = [
  "maintenance_equipment", "maintenance_checklist_state", "maintenance_checklist_history",
  "maintenance_defects", "maintenance_audits",
  "trainings", "training_attempts",
  "whatsapp_conversations", "whatsapp_inbound_messages", "task_captures", "push_receipts",
  "notification_log", "digest_tracker",
  "notices", "notifications",
];

async function delBy(table: string, col: string, values: string[]) {
  if (!values.length) return;
  try {
    await admin.from(table).delete().in(col, values);
  } catch (_e) { /* table/column may not exist — ignore */ }
}

serve(async (req) => {
  if (PURGE_SECRET && req.headers.get("x-purge-secret") !== PURGE_SECRET) {
    return new Response(JSON.stringify({ error: "forbidden" }), { status: 403 });
  }

  const cutoff = new Date(Date.now() - GRACE_DAYS * 24 * 60 * 60 * 1000).toISOString();

  // Only demo clients whose window closed more than GRACE_DAYS ago.
  const { data: expired, error } = await admin
    .from("clients")
    .select("id")
    .eq("is_demo", true)
    .not("demo_expires_at", "is", null)
    .lt("demo_expires_at", cutoff);
  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }

  const purged: string[] = [];
  for (const client of expired || []) {
    const clientId = client.id as string;

    // Resolve this client's outlets + staff.
    const { data: tenants } = await admin.from("tenants").select("id").eq("client_id", clientId);
    const tenantIds = (tenants || []).map((t: any) => t.id);
    const { data: users } = await admin.from("users").select("id, auth_id").in("tenant_id", tenantIds.length ? tenantIds : ["__none__"]);
    const userIds = (users || []).map((u: any) => u.id);
    const authIds = (users || []).map((u: any) => u.auth_id).filter(Boolean);

    if (tenantIds.length) {
      // Parent → child chains first.
      const { data: checklists } = await admin.from("checklists").select("id").in("tenant_id", tenantIds);
      const checklistIds = (checklists || []).map((c: any) => c.id);
      await delBy("checklist_items", "checklist_id", checklistIds);
      await delBy("checklists", "tenant_id", tenantIds);

      const { data: tasks } = await admin.from("tasks").select("id").in("tenant_id", tenantIds);
      const taskIds = (tasks || []).map((t: any) => t.id);
      await delBy("task_messages", "task_id", taskIds);
      await delBy("tasks", "tenant_id", tenantIds);

      // Flat tenant-scoped tables.
      for (const table of TENANT_TABLES) {
        await delBy(table, "tenant_id", tenantIds);
      }
    }

    // Client-scoped odds and ends.
    await delBy("maintenance_sop_meta", "client_id", [clientId]);
    await delBy("trainings", "client_id", [clientId]);
    if (userIds.length) await delBy("push_subscriptions", "user_id", userIds);

    // Remove the Supabase Auth accounts so demo logins don't accumulate.
    for (const authId of authIds) {
      try { await admin.auth.admin.deleteUser(authId); } catch (_e) { /* already gone */ }
    }

    // Staff, outlets, then the client row itself.
    if (tenantIds.length) {
      await delBy("users", "tenant_id", tenantIds);
      await delBy("tenants", "id", tenantIds);
    }
    await admin.from("clients").delete().eq("id", clientId);
    purged.push(clientId);
  }

  return new Response(JSON.stringify({ purged, count: purged.length }), {
    headers: { "Content-Type": "application/json" },
  });
});
