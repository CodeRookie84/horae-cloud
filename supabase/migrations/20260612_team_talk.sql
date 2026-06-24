-- =============================================================
-- Team Talk — Horae Chat Feature
-- Migration: 20260612_team_talk.sql
-- =============================================================

-- ─────────────────────────────────────────────────────────────
-- 1. CHANNELS
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS chat_channels (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     TEXT NOT NULL,
  name          TEXT NOT NULL,                     -- e.g. "general", "kitchen-team"
  description   TEXT,
  type          TEXT NOT NULL DEFAULT 'department'
                  CHECK (type IN ('announcement', 'department', 'outlet', 'context', 'dm', 'group')),
  context_type  TEXT CHECK (context_type IN ('task', 'notice', 'checklist')),
  context_id    TEXT,                              -- FK to tasks.id / notices.id etc (soft ref)
  created_by    TEXT NOT NULL,                     -- user id
  is_archived   BOOLEAN NOT NULL DEFAULT false,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for quick tenant+type lookups
CREATE INDEX IF NOT EXISTS idx_chat_channels_tenant ON chat_channels(tenant_id);
CREATE INDEX IF NOT EXISTS idx_chat_channels_type   ON chat_channels(tenant_id, type);

-- ─────────────────────────────────────────────────────────────
-- 2. CHANNEL MEMBERSHIP
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS chat_members (
  channel_id    UUID NOT NULL REFERENCES chat_channels(id) ON DELETE CASCADE,
  user_id       TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  last_read_at  TIMESTAMPTZ,
  is_muted      BOOLEAN NOT NULL DEFAULT false,
  joined_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (channel_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_chat_members_user ON chat_members(user_id);

-- ─────────────────────────────────────────────────────────────
-- 3. MESSAGES
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS chat_messages (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id           UUID NOT NULL REFERENCES chat_channels(id) ON DELETE CASCADE,

  -- Threading model:
  -- thread_id = UUID of the root message that started a thread (null = this IS a root message)
  -- parent_id = UUID of the specific message being replied to (for threaded reply chains)
  thread_id            UUID REFERENCES chat_messages(id) ON DELETE SET NULL,
  parent_id            UUID REFERENCES chat_messages(id) ON DELETE SET NULL,

  sender_id            TEXT NOT NULL,
  sender_name          TEXT NOT NULL,
  sender_role          TEXT,
  sender_avatar        TEXT,

  -- Content
  content              TEXT,                       -- Text content (null for pure voice)
  message_type         TEXT NOT NULL DEFAULT 'text'
                         CHECK (message_type IN ('text', 'voice', 'image', 'system')),

  -- Voice message fields
  voice_url            TEXT,                       -- Supabase Storage URL
  voice_duration_sec   INT,                        -- For display
  voice_transcript     TEXT,                       -- Gemini-transcribed text (for search)

  -- Language / Translation
  detected_language    TEXT,                       -- ISO 639-1: 'hi', 'ta', 'en' etc.
  translations         JSONB DEFAULT '{}',          -- { "en": "...", "ta": "..." }

  -- Task / Checklist integration
  linked_task_id       TEXT,                       -- Soft ref to tasks.id
  linked_checklist_id  TEXT,                       -- Soft ref to checklists.id
  linked_notice_id     TEXT,                       -- Soft ref to notices.id
  is_branched          BOOLEAN NOT NULL DEFAULT false,
  branch_task_id       TEXT,                       -- Task created FROM this message (Fork+Link)

  -- Reactions: { "👍": ["user-id-1", "user-id-2"], "❤️": ["user-id-3"] }
  reactions            JSONB NOT NULL DEFAULT '{}',

  -- Flags
  is_edited            BOOLEAN NOT NULL DEFAULT false,
  is_deleted           BOOLEAN NOT NULL DEFAULT false,

  tenant_id            TEXT NOT NULL,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_chat_messages_channel    ON chat_messages(channel_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_messages_thread     ON chat_messages(thread_id)    WHERE thread_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_chat_messages_tenant     ON chat_messages(tenant_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_sender     ON chat_messages(sender_id);
-- Full-text search on content + voice_transcript
CREATE INDEX IF NOT EXISTS idx_chat_messages_fts ON chat_messages
  USING GIN (to_tsvector('english', coalesce(content, '') || ' ' || coalesce(voice_transcript, '')));

-- ─────────────────────────────────────────────────────────────
-- 4. READ RECEIPTS
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS chat_read_receipts (
  message_id  UUID NOT NULL REFERENCES chat_messages(id) ON DELETE CASCADE,
  user_id     TEXT NOT NULL,
  read_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (message_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_chat_read_receipts_user ON chat_read_receipts(user_id);

-- ─────────────────────────────────────────────────────────────
-- 5. ENABLE SUPABASE REALTIME
-- ─────────────────────────────────────────────────────────────
-- Supabase Realtime listens to CDC (Change Data Capture) events.
-- We add both tables to the realtime publication so clients
-- receive live INSERT/UPDATE/DELETE events via WebSocket.
ALTER PUBLICATION supabase_realtime ADD TABLE chat_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE chat_channels;

-- ─────────────────────────────────────────────────────────────
-- 6. ROW LEVEL SECURITY (RLS)
-- ─────────────────────────────────────────────────────────────
-- Enable RLS on all tables
ALTER TABLE chat_channels       ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_members        ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages       ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_read_receipts  ENABLE ROW LEVEL SECURITY;

-- For now allow all (same pattern as rest of Horae app).
-- In production, these should be tenant-scoped policies.
CREATE POLICY "Allow all chat_channels"      ON chat_channels      FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all chat_members"       ON chat_members       FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all chat_messages"      ON chat_messages      FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all chat_read_receipts" ON chat_read_receipts FOR ALL USING (true) WITH CHECK (true);

-- ─────────────────────────────────────────────────────────────
-- 7. HELPER FUNCTION: Thread reply count
-- ─────────────────────────────────────────────────────────────
-- Returns count of replies for a given thread root message.
CREATE OR REPLACE FUNCTION get_thread_reply_count(root_id UUID)
RETURNS INT AS $$
  SELECT COUNT(*)::INT FROM chat_messages
  WHERE thread_id = root_id AND is_deleted = false;
$$ LANGUAGE SQL STABLE;

-- ─────────────────────────────────────────────────────────────
-- 8. UPDATED_AT auto-trigger
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER chat_messages_updated_at
  BEFORE UPDATE ON chat_messages
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
