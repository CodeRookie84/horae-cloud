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

-- WhatsApp communication retention (changed 2026-10-02 from 90 → 7 days):
-- message logs, inbound message bodies, menu/conversation state, forwarded-text
-- captures and digest/KOT send logs are deleted once older than 7 days. Nothing
-- reads further back than that: notify-dispatcher dedup/caps look back ≤ 1 day,
-- the 24h-window check 23h, inbound dedup minutes, daily-digest only "today",
-- and the WhatsApp engagement report was cut to 7 days to match.
-- whatsapp_message_pricing (super-admin billing, no message content) is kept 90
-- days to match the billing report's longest range; event labels on billing rows
-- older than 7 days show as "—" because their notification_log row is gone.
-- Runs daily at 03:15 UTC.
select cron.schedule(
  'prune-wa-logs',
  '15 3 * * *',
  $job$
    delete from public.notification_log          where sent_at     < now() - interval '7 days';
    delete from public.whatsapp_inbound_messages where received_at < now() - interval '7 days';
    delete from public.whatsapp_conversations    where coalesce(updated_at, created_at) < now() - interval '7 days';
    delete from public.task_captures             where created_at  < now() - interval '7 days';
    delete from public.msg_sessions              where updated_at  < now() - interval '7 days';
    delete from public.digest_tracker            where sent_at     < now() - interval '7 days';
    delete from public.kot_notification_log      where created_at  < now() - interval '7 days';
    delete from public.whatsapp_message_pricing  where coalesce(sent_at, created_at) < now() - interval '90 days';
  $job$
);
