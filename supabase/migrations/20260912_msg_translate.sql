-- =============================================================================
-- MSG — WhatsApp self-help Translation (`/msg`)
-- =============================================================================
-- Self-contained module built INSIDE Horae but designed to be lift-out clean,
-- exactly like KOT (20260828_kot.sql):
--   • every table is prefixed `msg_`
--   • no existing Horae table is altered by this migration
--   • no new edge function — the logic rides on the existing whatsapp-webhook
-- Removing MSG later = drop these tables, delete src/msg/, delete
-- supabase/functions/whatsapp-webhook/msg.ts + the two `// [MSG]` seams in
-- index.ts, and the launcher-icon seams in appModules.ts / App.tsx.
--
-- Translation is a DEFAULT feature for every Horae staff user (like reminders) —
-- there is no per-client entitlement flag. The one table below is only the extra
-- directory of NON-staff phones an admin chooses to give it to.
--
-- RLS is permissive (USING(true) WITH CHECK(true)) to match the current Horae
-- posture (see 20260811_rls_revert.sql).
-- Run in the Supabase SQL editor / CLI after 20260911_kot_notification_log.sql.

-- ── 1. People Directory — the 5-language store ────────────────────────────────
-- Identified by `phone` (last-10 match, the same convention as kot_participants /
-- normalizePhone). `languages` holds up to 5 ISO-639-1 codes the user toggles
-- between for input/output; it stays empty until the first-time language pick over
-- WhatsApp. No `linked_user_id` — this feature never creates or ties to a login.
--
-- `source` distinguishes the two populations that share this table:
--   'onboarded' — extra NON-staff phones added by an admin in the Translate panel;
--                 shown there; `client_id` = the admin's client.
--   'staff'     — Horae staff, who get the translator by default; a row is
--                 auto-created by whatsapp-webhook on their first `/msg` use,
--                 purely to hold their 5 languages. `client_id` is NULL and the
--                 admin panel HIDES these — staff are never managed here.
CREATE TABLE IF NOT EXISTS msg_participants (
  id          TEXT PRIMARY KEY,
  client_id   TEXT,                                 -- NULL for source='staff'
  source      TEXT NOT NULL DEFAULT 'onboarded',    -- 'onboarded' | 'staff'
  name        TEXT NOT NULL DEFAULT '',
  phone       TEXT NOT NULL DEFAULT '',
  languages   JSONB NOT NULL DEFAULT '[]'::jsonb,   -- up to 5 ISO-639-1 codes
  active      BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_msg_participants_client ON msg_participants(client_id);

-- ── 2. Conversation state (per phone) ─────────────────────────────────────────
-- The translation flow is stateful (pick languages → choose input>outputs → send
-- content). It's keyed by phone (not user_id) so it works identically for staff
-- and onboarded users. One row per phone, keyed by the last 10 digits.
-- `state`: 'pick_langs' | 'await_selection' | 'await_content'. `expires_at` lets a
-- stale session lapse so an old awaiting state never swallows a later message.
CREATE TABLE IF NOT EXISTS msg_sessions (
  phone_last10  TEXT PRIMARY KEY,
  participant_id TEXT NOT NULL,
  client_id     TEXT,                             -- NULL for staff sessions
  state         TEXT NOT NULL DEFAULT 'await_selection',
  input_lang    TEXT,
  output_langs  JSONB NOT NULL DEFAULT '[]'::jsonb,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at    TIMESTAMPTZ NOT NULL DEFAULT now() + interval '1 hour'
);

-- ── RLS — permissive, matching current Horae posture ─────────────────────────
ALTER TABLE msg_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE msg_sessions     ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all msg_participants" ON msg_participants;
DROP POLICY IF EXISTS "Allow all msg_sessions"     ON msg_sessions;

CREATE POLICY "Allow all msg_participants" ON msg_participants FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all msg_sessions"     ON msg_sessions     FOR ALL USING (true) WITH CHECK (true);
