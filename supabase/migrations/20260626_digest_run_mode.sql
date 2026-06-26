-- ============================================================
-- Adds morning/evening digest support and urgent-push logging
-- Run this in your Supabase SQL Editor
-- ============================================================

-- 1. Track which run (morning/evening) a digest belongs to
ALTER TABLE digest_tracker
  ADD COLUMN IF NOT EXISTS run_mode TEXT NOT NULL DEFAULT 'morning';

ALTER TABLE digest_tracker
  DROP CONSTRAINT IF EXISTS digest_tracker_user_id_digest_date_key;

ALTER TABLE digest_tracker
  ADD CONSTRAINT digest_tracker_user_id_digest_date_run_mode_key
  UNIQUE (user_id, digest_date, run_mode);

-- 2. Flag urgent (on-demand) pushes in the notification log
ALTER TABLE notification_log
  ADD COLUMN IF NOT EXISTS is_urgent BOOLEAN DEFAULT false;

-- ============================================================
-- Cron schedules (run in Supabase SQL editor — pg_cron is not
-- version-controlled, so this block documents the manual setup):
--
-- SELECT cron.schedule(
--   'daily-digest-morning-8am-IST',
--   '30 2 * * *',  -- 8:00 AM IST
--   $$SELECT net.http_post(
--     url := 'https://<project>.supabase.co/functions/v1/daily-digest',
--     headers := '{"Authorization": "Bearer <service-role-key>", "Content-Type": "application/json"}'::jsonb,
--     body := '{"runMode": "morning"}'::jsonb
--   )$$
-- );
--
-- SELECT cron.schedule(
--   'daily-digest-evening-630pm-IST',
--   '0 13 * * *',  -- 6:30 PM IST
--   $$SELECT net.http_post(
--     url := 'https://<project>.supabase.co/functions/v1/daily-digest',
--     headers := '{"Authorization": "Bearer <service-role-key>", "Content-Type": "application/json"}'::jsonb,
--     body := '{"runMode": "evening"}'::jsonb
--   )$$
-- );
-- ============================================================
