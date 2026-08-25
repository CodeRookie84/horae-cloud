-- ============================================================
-- Demo (sales-trial) clients.
--   A demo client is a self-contained, time-limited sandbox handed to a
--   prospect. It behaves like the Free trial (all features unlocked) but:
--     * its window is EXPLICIT (demo_expires_at) rather than the 15-day
--       derive, so each demo can be a different length (default 7 days);
--     * once expired it is a hard stop — the app shows a "demo ended"
--       screen instead of the silent feature-hidden state a real Free
--       trial falls into;
--     * WhatsApp is off (demo staff carry no phone; digest is disabled);
--     * a daily purge job hard-deletes it 30 days after expiry.
--
--   is_demo lets every downstream gate (entitlements, dispatcher, purge)
--   distinguish a demo from a paying client without guessing.
-- Run in Supabase SQL editor (prod migration history is applied by hand).
-- ============================================================

ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS demo_expires_at timestamptz;

-- Fast lookup for the purge job (only demo rows are ever scanned).
CREATE INDEX IF NOT EXISTS idx_clients_demo_expiry
  ON clients (demo_expires_at)
  WHERE is_demo = true;
