-- Scope chat_channels by client_id so a client admin can see every outlet's
-- rooms/channels under their organization, not just their home outlet.

ALTER TABLE chat_channels ADD COLUMN IF NOT EXISTS client_id TEXT;

UPDATE chat_channels
SET client_id = tenants.client_id
FROM tenants
WHERE chat_channels.tenant_id = tenants.id
  AND chat_channels.client_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_chat_channels_client ON chat_channels(client_id);
