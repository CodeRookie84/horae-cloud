-- Team Talk v2 Migration — Mentions, Pinned Messages, Channel Archive
-- Run this in Supabase SQL Editor after 20260612_team_talk.sql

-- ── 1. Add mentioned_user_ids column to chat_messages ──────────────────────
ALTER TABLE chat_messages
  ADD COLUMN IF NOT EXISTS mentioned_user_ids text[] DEFAULT '{}';

-- ── 2. Mentions tracking table ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS chat_mentions (
  id            uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id    uuid          REFERENCES chat_messages(id) ON DELETE CASCADE NOT NULL,
  channel_id    uuid          REFERENCES chat_channels(id) ON DELETE CASCADE NOT NULL,
  tenant_id     text          NOT NULL,
  mentioned_user_id   text    NOT NULL,
  mentioned_by_user_id text   NOT NULL,
  is_read       boolean       DEFAULT false,
  created_at    timestamptz   DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_chat_mentions_user     ON chat_mentions(mentioned_user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_chat_mentions_tenant   ON chat_mentions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_chat_mentions_channel  ON chat_mentions(channel_id);

-- RLS
ALTER TABLE chat_mentions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_all_chat_mentions" ON chat_mentions USING (true) WITH CHECK (true);

-- ── 3. Pinned message per channel ───────────────────────────────────────────
ALTER TABLE chat_channels
  ADD COLUMN IF NOT EXISTS pinned_message_id uuid REFERENCES chat_messages(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS pinned_at         timestamptz,
  ADD COLUMN IF NOT EXISTS pinned_by         text;

-- ── 4. Enable Realtime on mentions ──────────────────────────────────────────
-- (supabase_realtime publication must already exist from previous migration)
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE chat_mentions;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;
