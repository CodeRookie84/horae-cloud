-- ============================================================
-- WhatsApp message pricing — per-message billing record
-- ============================================================
-- Meta's billing dashboard only shows totals. Every status callback
-- (sent/delivered) that reaches whatsapp-webhook carries a `pricing` object:
--   { billable: bool, pricing_model: "PMP", category: "utility"|"marketing"|
--     "authentication"|"service", type: "regular"|"free_customer_service"|... }
-- whatsapp-webhook upserts one row per outbound message (keyed by WAMID) so the
-- super-admin "WhatsApp Billing" tab can show exactly which messages were paid,
-- to whom, and for which client. Covers EVERY outbound send (notify-dispatcher,
-- webhook replies, kot-notify…) since it is fed from Meta's receipts, not from
-- our own send paths.

CREATE TABLE IF NOT EXISTS whatsapp_message_pricing (
  wa_message_id  TEXT PRIMARY KEY,
  recipient      TEXT,                 -- Meta's recipient_id (digits, with country code)
  user_id        TEXT,                 -- resolved by last-10-digit phone match (nullable)
  tenant_id      TEXT,
  client_id      TEXT,                 -- denormalised for the per-client filter
  billable       BOOLEAN,
  category       TEXT,                 -- utility | marketing | authentication | service
  pricing_type   TEXT,                 -- regular (paid) | free_customer_service | free_entry_point
  pricing_model  TEXT,
  status         TEXT,                 -- latest status seen: sent | delivered | read | failed
  sent_at        TIMESTAMPTZ,          -- timestamp of the first status callback
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wa_pricing_client_time ON whatsapp_message_pricing (client_id, sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_wa_pricing_time ON whatsapp_message_pricing (sent_at DESC);

ALTER TABLE whatsapp_message_pricing ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all whatsapp_message_pricing" ON whatsapp_message_pricing;
CREATE POLICY "Allow all whatsapp_message_pricing" ON whatsapp_message_pricing FOR ALL USING (true) WITH CHECK (true);
