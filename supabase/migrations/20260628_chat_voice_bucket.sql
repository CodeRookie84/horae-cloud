-- =============================================================
-- Team Talk — create the storage bucket voice notes upload to.
-- Without this bucket, chatService.sendVoiceMessage()'s upload
-- fails silently and no voice message is ever created.
-- =============================================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('chat-voice-messages', 'chat-voice-messages', true)
ON CONFLICT (id) DO NOTHING;

-- Match the "allow all" policy already used for the chat tables
-- (see 20260612_team_talk.sql) so any authenticated tenant user
-- can upload/read voice notes.
DROP POLICY IF EXISTS "Allow all chat-voice-messages" ON storage.objects;
CREATE POLICY "Allow all chat-voice-messages"
  ON storage.objects FOR ALL
  USING (bucket_id = 'chat-voice-messages')
  WITH CHECK (bucket_id = 'chat-voice-messages');

-- =============================================================
-- chat_thread_participants — referenced extensively in chatService.ts
-- (getThreadParticipants, getUnreadThreads, markThreadRead, etc.) but
-- has no creation migration anywhere in this repo. It turned out to
-- already exist live (created ad hoc, with columns thread_id, user_id,
-- added_at) — so CREATE TABLE IF NOT EXISTS alone silently skipped
-- adding the last_read_at/joined_at columns the code actually needs.
-- Add them explicitly so this migration is correct whether the table
-- pre-exists or not.
-- =============================================================
CREATE TABLE IF NOT EXISTS chat_thread_participants (
  thread_id     UUID NOT NULL REFERENCES chat_messages(id) ON DELETE CASCADE,
  user_id       TEXT NOT NULL,
  PRIMARY KEY (thread_id, user_id)
);

ALTER TABLE chat_thread_participants ADD COLUMN IF NOT EXISTS last_read_at TIMESTAMPTZ;
ALTER TABLE chat_thread_participants ADD COLUMN IF NOT EXISTS joined_at TIMESTAMPTZ NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_chat_thread_participants_user ON chat_thread_participants(user_id);

ALTER TABLE chat_thread_participants ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all chat_thread_participants" ON chat_thread_participants;
CREATE POLICY "Allow all chat_thread_participants" ON chat_thread_participants FOR ALL USING (true) WITH CHECK (true);

-- Backfill: give every existing active thread's channel members a
-- participant row (treated as unread from the start), since threads
-- activated before this fix never got participants registered.
INSERT INTO chat_thread_participants (thread_id, user_id, last_read_at)
SELECT m.id, cm.user_id, '1970-01-01T00:00:00Z'::timestamptz
FROM chat_messages m
JOIN chat_members cm ON cm.channel_id = m.channel_id
WHERE m.thread_status = 'active' AND m.thread_id IS NULL
ON CONFLICT (thread_id, user_id) DO NOTHING;
