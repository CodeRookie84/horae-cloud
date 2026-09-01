-- ============================================================
-- Per-client digest kill switch.
--   digest_enabled = false silences the daily digest (push + WhatsApp,
--   all sections) for every user of that client. Default true so existing
--   clients keep their digest. Flip back to true to re-activate — no redeploy.
-- Run in Supabase SQL editor (prod migration history is applied by hand).
-- ============================================================

ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS digest_enabled boolean NOT NULL DEFAULT true;
