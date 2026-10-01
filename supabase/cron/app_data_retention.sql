-- App data retention (agreed with the owner 2026-10-02). Operational pg_cron
-- job — DB state, not a schema migration. Apply with:
--   supabase db query --linked -f supabase/cron/app_data_retention.sql
-- cron.schedule is idempotent by job name, so re-running just updates the job.
--
--   notifications (in-app feed)      deleted after 90 days (app loads 30)
--   push_receipts                    deleted after 30 days (dispatcher reads 3)
--   kept forever: ALL checklist data (submissions + checklist_runs) — owner
--                 decision 2026-10-02: they are business/audit records; the app
--                 loads only recent submissions instead. Also tasks, notices,
--                 trainings/attempts, KOT, projects.
-- WhatsApp logs have their own 7-day job: see wa_keepwarm_and_log_pruning.sql.
-- Runs daily at 03:30 UTC (09:00 IST).
select cron.schedule(
  'prune-app-data',
  '30 3 * * *',
  $job$
    delete from public.notifications where created_at  < now() - interval '90 days';
    delete from public.push_receipts where received_at < now() - interval '30 days';

  $job$
);
