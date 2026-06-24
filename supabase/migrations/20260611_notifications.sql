-- ============================================================
-- Horae Notification System — Supabase Migration Script
-- Run this in your Supabase SQL Editor
-- ============================================================

-- 1. Add notification columns to users table
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS phone_number        TEXT,
  ADD COLUMN IF NOT EXISTS whatsapp_opted_in   BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS fcm_token           TEXT,
  ADD COLUMN IF NOT EXISTS last_seen_at        TIMESTAMPTZ;

-- 2. Add quiet hours config to tenants table (per-client)
ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS quiet_hours_start   INTEGER DEFAULT 21,  -- 9 PM (24h format)
  ADD COLUMN IF NOT EXISTS quiet_hours_end     INTEGER DEFAULT 7;   -- 7 AM

-- 3. Notification log (for anti-spam deduplication)
CREATE TABLE IF NOT EXISTS notification_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         TEXT NOT NULL,
  tenant_id       TEXT,
  event_type      TEXT NOT NULL,
    -- 'task_assigned' | 'task_status' | 'task_chat' | 'notice' | 'daily_digest' | 'quiz'
  reference_id    TEXT,             -- task_id / checklist_id / notice_id / quiz_id
  channel         TEXT NOT NULL,    -- 'whatsapp' | 'fcm'
  sent_at         TIMESTAMPTZ DEFAULT now(),
  status          TEXT DEFAULT 'sent', -- 'sent' | 'skipped' | 'failed'
  error_message   TEXT
);
CREATE INDEX IF NOT EXISTS idx_notif_log_user_time   ON notification_log(user_id, sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_notif_log_ref         ON notification_log(reference_id, event_type);

-- 4. Daily digest tracker (one row per user per day)
CREATE TABLE IF NOT EXISTS digest_tracker (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         TEXT NOT NULL,
  tenant_id       TEXT NOT NULL,
  digest_date     DATE NOT NULL DEFAULT CURRENT_DATE,
  sent_at         TIMESTAMPTZ DEFAULT now(),
  items_count     INTEGER DEFAULT 0,
  items_summary   JSONB,   -- { checklists: [...], notices: [...], quizzes: [...] }
  UNIQUE(user_id, digest_date)
);
CREATE INDEX IF NOT EXISTS idx_digest_user_date ON digest_tracker(user_id, digest_date);

-- 5. RLS Policies (allow service role to write; users can read their own)
ALTER TABLE notification_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access"
  ON notification_log FOR ALL
  USING (true)
  WITH CHECK (true);

ALTER TABLE digest_tracker ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access"
  ON digest_tracker FOR ALL
  USING (true)
  WITH CHECK (true);

-- ============================================================
-- DONE. Next: deploy Supabase Edge Functions from
-- supabase/functions/notify-dispatcher/
-- supabase/functions/daily-digest/
-- ============================================================
