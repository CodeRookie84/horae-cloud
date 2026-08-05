-- ============================================================
-- WhatsApp Engagement Reporting — Supabase Migration Script
-- Run this in your Supabase SQL Editor (or via `supabase db query --linked`)
-- ============================================================

-- 1. Track the Meta WhatsApp message id + delivery/read timestamps on every
--    outbound send, so inbound webhook status callbacks can be matched back
--    to the original notification_log row.
ALTER TABLE notification_log
  ADD COLUMN IF NOT EXISTS wa_message_id  TEXT,
  ADD COLUMN IF NOT EXISTS delivered_at   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS read_at        TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_notif_log_wa_message_id ON notification_log(wa_message_id);

-- 2. Inbound WhatsApp replies (business number receives a message back).
CREATE TABLE IF NOT EXISTS whatsapp_inbound_messages (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wa_message_id         TEXT,
  from_phone            TEXT NOT NULL,
  user_id               TEXT,             -- resolved by last-10-digit phone match, nullable if no match
  tenant_id             TEXT,
  body                  TEXT,
  context_wa_message_id TEXT,             -- set when the reply is "in reply to" a specific Horae-sent message
  received_at           TIMESTAMPTZ,
  created_at            TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_wa_inbound_user_time ON whatsapp_inbound_messages(user_id, received_at DESC);
CREATE INDEX IF NOT EXISTS idx_wa_inbound_context ON whatsapp_inbound_messages(context_wa_message_id);

ALTER TABLE whatsapp_inbound_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access"
  ON whatsapp_inbound_messages FOR ALL
  USING (true)
  WITH CHECK (true);

-- ============================================================
-- DONE. Next: deploy supabase/functions/whatsapp-webhook/ and register
-- its URL + verify token in the Meta App Dashboard (WhatsApp > Configuration).
-- ============================================================
