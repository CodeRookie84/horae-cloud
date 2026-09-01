-- ============================================================
-- Notification dedup claims
--
-- Task-assignment notifications can be triggered from more than one
-- path (DB webhook + client-side fallback call). This table gives
-- notify-dispatcher an atomic "claim" it can use to guarantee a
-- one-time event (like task_assigned) is only ever actually sent
-- once per user, no matter how many times the underlying event fires.
-- ============================================================

CREATE TABLE IF NOT EXISTS notification_claims (
  id            BIGSERIAL PRIMARY KEY,
  user_id       TEXT NOT NULL,
  event_type    TEXT NOT NULL,
  reference_id  TEXT NOT NULL,
  claimed_at    TIMESTAMPTZ DEFAULT now(),
  UNIQUE (user_id, event_type, reference_id)
);

ALTER TABLE notification_claims ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access"
  ON notification_claims FOR ALL
  USING (true)
  WITH CHECK (true);
