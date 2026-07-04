-- Team Talk — Priority Users ("VIP" labelling)
-- Run in Supabase SQL Editor after 20260702_chat_images.sql
--
-- Each row = "owner user_id has marked priority_user_id as a priority contact".
-- Stored server-side (not localStorage) so the notify-dispatcher edge function
-- can read it and give priority senders a distinct, break-through push.
-- Max 3 per owner is enforced in the app layer (chatService.setPriorityUserIds),
-- matching how the rest of Team Talk enforces limits client-side.

CREATE TABLE IF NOT EXISTS chat_priority_users (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          TEXT NOT NULL,          -- owner of the list
  priority_user_id TEXT NOT NULL,          -- teammate marked as priority
  position         SMALLINT NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, priority_user_id)
);

CREATE INDEX IF NOT EXISTS idx_chat_priority_users_owner ON chat_priority_users(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_priority_users_target ON chat_priority_users(priority_user_id);

-- Realtime so a change on one device reflects on the user's other devices.
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE chat_priority_users;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;

-- RLS — matches the permissive pattern used across the other chat_* tables.
ALTER TABLE chat_priority_users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all chat_priority_users" ON chat_priority_users FOR ALL USING (true) WITH CHECK (true);
