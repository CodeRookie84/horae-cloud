-- Speed up the inbound WhatsApp dedup lookup (2026-09-02)
--
-- Every inbound message runs `select … from whatsapp_inbound_messages
-- where wa_message_id = <id>` to skip Meta's re-deliveries. That column had no
-- index, so the check was a full-table scan on EVERY inbound — getting slower as
-- the table grows. This index turns it into an indexed lookup, cutting per-message
-- latency before the reply is built.

create index if not exists idx_wa_inbound_wamid
  on public.whatsapp_inbound_messages(wa_message_id);
