-- =============================================================================
-- KOT notification log — one row per WhatsApp send attempt (additive)
-- =============================================================================
-- The KOT lane used to fire-and-forget: kot-reminders called kot-notify and
-- discarded the result, and kot-notify wrote nothing down. A Meta rejection or a
-- reminder that fired before any staff were assigned looked identical to success,
-- so "no message arrived" was undiagnosable. This table records every attempt
-- (per recipient, plus a synthetic row when an order had no active assignees) so
-- failures are always visible.

CREATE TABLE IF NOT EXISTS kot_notification_log (
  id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  order_id   TEXT NOT NULL,
  trigger    TEXT NOT NULL,            -- 'order_created' | 'reminder:day_before' | 'reminder:soon'
  channel    TEXT NOT NULL DEFAULT 'whatsapp',
  phone      TEXT,                     -- NULL for a "no recipients" row
  ok         BOOLEAN NOT NULL,
  error      TEXT,                     -- Meta's error text when ok = false
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS kot_notification_log_order_idx ON kot_notification_log (order_id, created_at DESC);

ALTER TABLE kot_notification_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all kot_notification_log" ON kot_notification_log;
CREATE POLICY "Allow all kot_notification_log" ON kot_notification_log FOR ALL USING (true) WITH CHECK (true);
