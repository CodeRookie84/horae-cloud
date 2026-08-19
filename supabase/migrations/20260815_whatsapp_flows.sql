-- ============================================================
-- WhatsApp interactive flows + translation foundation
--
-- Supports:
--   #1 forward-a-message -> tappable menu -> create-task link
--   #2 "new task" (text/voice) -> create-task link
--   #5 per-user language preference for translated notifications
--
-- Run in the Supabase SQL Editor (or `supabase db query --linked`) after
-- 20260811_rls_revert.sql. Matches Horae's permissive-RLS convention:
-- everything is service-role / app-enforced, so policies stay open.
-- ============================================================

-- 1. Per-user language preference (ISO 639-1: 'en', 'hi', 'ta', 'ml', ...).
--    Outbound notifications are translated into this; NULL/'' => English.
--    Team Talk used to store detected_language per message; that table is gone,
--    so language now lives on the user.
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS preferred_language TEXT DEFAULT 'en';

-- 2. Short-lived conversation state for the inbound WhatsApp menu flow.
--    When a staff member forwards a message (or texts "new task"), Horae stores
--    the captured content here and offers interactive buttons. The button they
--    tap arrives on the webhook with context.id = menu_message_id, which is how
--    we tie the tap back to this row.
CREATE TABLE IF NOT EXISTS whatsapp_conversations (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          TEXT,                 -- resolved Horae user (nullable if unmatched phone)
  tenant_id        TEXT,
  from_phone       TEXT NOT NULL,
  state            TEXT NOT NULL DEFAULT 'menu_offered',  -- 'menu_offered' | 'done' | 'expired'
  intent           TEXT,                 -- 'forward_capture' | 'new_task'
  payload          JSONB NOT NULL DEFAULT '{}'::jsonb,    -- { text, suggestedTitle, mediaId, ... }
  menu_message_id  TEXT,                 -- wamid of the Horae message that showed the buttons
  expires_at       TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '24 hours'),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_wa_conv_menu_msg ON whatsapp_conversations(menu_message_id);
CREATE INDEX IF NOT EXISTS idx_wa_conv_user_state ON whatsapp_conversations(user_id, state);

ALTER TABLE whatsapp_conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access"
  ON whatsapp_conversations FOR ALL USING (true) WITH CHECK (true);

-- 3. Pending task content captured from WhatsApp, consumed by the in-app
--    task-creation form (/tasks/new?capture={id}). Kept separate from `tasks`
--    so half-formed captures never appear in task lists, digests, or fire the
--    task_assigned notification. Rows are consumed on submit or expire.
CREATE TABLE IF NOT EXISTS task_captures (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        TEXT,
  user_id          TEXT,                 -- who captured it (becomes created_by on submit)
  source           TEXT NOT NULL DEFAULT 'whatsapp_forward', -- 'whatsapp_forward' | 'whatsapp_newtask' | 'whatsapp_voice'
  suggested_title  TEXT NOT NULL DEFAULT '',
  raw_text         TEXT NOT NULL DEFAULT '',
  status           TEXT NOT NULL DEFAULT 'pending',          -- 'pending' | 'consumed' | 'discarded'
  consumed_task_id TEXT,                 -- the tasks.id created from this capture
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  consumed_at      TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_task_captures_user ON task_captures(user_id, status);

ALTER TABLE task_captures ENABLE ROW LEVEL SECURITY;
-- App reads a capture by its UUID from the create form (authenticated user),
-- and the service role (edge functions) writes them. Kept open per Horae
-- convention; the UUID is the unguessable key.
CREATE POLICY "Service role full access"
  ON task_captures FOR ALL USING (true) WITH CHECK (true);

-- 4. Push-delivery health (Plan B: push-first, WhatsApp only as fallback).
--    The service worker POSTs to the push-ack function whenever it receives a
--    push; that stamps last_push_ack_at and logs a receipt. The dispatcher reads
--    last_push_ack_at to decide whether a user's push pipe is alive — if it is,
--    the daily digest goes via free push; if it looks dead, the digest (the
--    fallback carrier) goes via WhatsApp. This is a HEALTH signal, not a
--    per-message delivery guarantee (web push gives no such guarantee).
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS last_push_ack_at TIMESTAMPTZ,
  -- Set when the PWA is installed to the home screen (iOS only delivers push to
  -- installed PWAs), so we can tell "push is broken" from "never installed".
  ADD COLUMN IF NOT EXISTS pwa_installed_at TIMESTAMPTZ;

-- Detailed receipt log (debugging / deliverability analytics). The dispatcher
-- only needs users.last_push_ack_at above; this is the audit trail.
CREATE TABLE IF NOT EXISTS push_receipts (
  id            BIGSERIAL PRIMARY KEY,
  user_id       TEXT,
  tenant_id     TEXT,
  tag           TEXT,                 -- the push payload tag, e.g. 'task-<id>'
  ack_type      TEXT NOT NULL DEFAULT 'delivered', -- 'delivered' | 'seen'
  received_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_push_receipts_user_time ON push_receipts(user_id, received_at DESC);

ALTER TABLE push_receipts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access"
  ON push_receipts FOR ALL USING (true) WITH CHECK (true);

-- ============================================================
-- DONE. Next: deploy the _shared/ai.ts helper + updated whatsapp-webhook,
-- the new push-ack function, and add a "New task from WhatsApp" prefill path
-- to the task-creation form.
-- ============================================================
