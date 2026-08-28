-- =============================================================================
-- KOT reminders — dedup log (additive; safe to run after 20260828_kot.sql)
-- =============================================================================
-- One row per (order, reminder kind) so the day-before and 2h-before reminders
-- each fire at most once per order even though the sweep runs repeatedly.

CREATE TABLE IF NOT EXISTS kot_reminder_log (
  order_id  TEXT NOT NULL,
  kind      TEXT NOT NULL,            -- 'day_before' | 'soon'
  sent_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (order_id, kind)
);

ALTER TABLE kot_reminder_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all kot_reminder_log" ON kot_reminder_log FOR ALL USING (true) WITH CHECK (true);
