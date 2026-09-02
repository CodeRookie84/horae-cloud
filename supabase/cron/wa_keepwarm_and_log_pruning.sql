-- Operational pg_cron jobs (applied 2026-09-02) — for the record / re-provisioning.
--
-- These are DB state, not schema migrations. Apply with:
--   supabase db query --linked -f supabase/cron/wa_keepwarm_and_log_pruning.sql
-- cron.schedule is idempotent by job name, so re-running just updates the job.
--
-- NOTE: the OTHER cron jobs (daily-digest-morning/evening, purge-demos-daily)
-- embed secrets (anon key / x-purge-secret) and are therefore NOT committed —
-- they live only in cron.job. See the horae-deploy-and-infra notes.

-- Keep-warm: ping whatsapp-webhook every 5 minutes so it never cold-starts.
-- An empty POST body means processWebhook() iterates nothing → NO DB writes,
-- returns 200. Fixed cost (~288/day) regardless of user count. No auth header
-- needed: whatsapp-webhook runs with verify_jwt = false.
select cron.schedule(
  'whatsapp-webhook-keepwarm',
  '*/5 * * * *',
  $job$
    select net.http_post(
      url := 'https://vexqmdrldxhwrpcwbxow.supabase.co/functions/v1/whatsapp-webhook',
      headers := jsonb_build_object('Content-Type', 'application/json'),
      body := '{}'::jsonb
    );
  $job$
);

-- Log pruning: keep the two fastest-growing log tables bounded. 90-day retention
-- is safe — the WhatsApp engagement report only looks back 30 days, and inbound
-- dedup only needs the last few minutes. Runs daily at 03:15 UTC.
select cron.schedule(
  'prune-wa-logs',
  '15 3 * * *',
  $job$
    delete from public.notification_log         where sent_at     < now() - interval '90 days';
    delete from public.whatsapp_inbound_messages where received_at < now() - interval '90 days';
  $job$
);
