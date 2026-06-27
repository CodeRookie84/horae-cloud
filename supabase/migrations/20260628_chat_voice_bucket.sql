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
-- has no creation migration anywhere in this repo. Created defensively
-- here so the upserts in chatService.ts can rely on an actual
-- (thread_id, user_id) unique constraint.
-- =============================================================
CREATE TABLE IF NOT EXISTS chat_thread_participants (
  thread_id     UUID NOT NULL REFERENCES chat_messages(id) ON DELETE CASCADE,
  user_id       TEXT NOT NULL,
  last_read_at  TIMESTAMPTZ,
  joined_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (thread_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_chat_thread_participants_user ON chat_thread_participants(user_id);

ALTER TABLE chat_thread_participants ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all chat_thread_participants" ON chat_thread_participants;
CREATE POLICY "Allow all chat_thread_participants" ON chat_thread_participants FOR ALL USING (true) WITH CHECK (true);
