-- ============================================================
-- Per-client translation languages
--
-- Each client picks, at onboarding, which languages its staff can translate
-- into (from the full Google Translate list). The in-app translate pickers then
-- offer only this subset instead of a fixed hard-coded list.
--
-- Default keeps the previously hard-coded set (Hindi/Kannada/Tamil) so existing
-- clients behave exactly as before until an admin edits their selection.
-- ============================================================

ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS languages JSONB NOT NULL DEFAULT '["hi","kn","ta"]'::jsonb;
