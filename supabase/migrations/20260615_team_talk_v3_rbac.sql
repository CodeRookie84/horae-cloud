-- Team Talk v3 Migration — Spaces, Dynamic RBAC, One-Tap Escalations
-- Run this in Supabase SQL Editor after 20260613_team_talk_v2.sql

-- ── 1. Spaces ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS chat_spaces (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     TEXT NOT NULL,
  name          TEXT NOT NULL,
  description   TEXT,
  type          TEXT NOT NULL DEFAULT 'outlet' CHECK (type IN ('outlet', 'department', 'cross_functional', 'management')),
  is_archived   BOOLEAN NOT NULL DEFAULT false,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_chat_spaces_tenant ON chat_spaces(tenant_id);

-- Link Channels to Spaces
ALTER TABLE chat_channels
  ADD COLUMN IF NOT EXISTS space_id UUID REFERENCES chat_spaces(id) ON DELETE CASCADE;

-- ── 2. Dynamic RBAC Rules ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS chat_channel_auto_rules (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id    UUID NOT NULL REFERENCES chat_channels(id) ON DELETE CASCADE,
  role          TEXT, -- if null, matches any role
  department    TEXT, -- if null, matches any department
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_chat_channel_auto_rules_channel ON chat_channel_auto_rules(channel_id);

-- ── 3. One-Tap Escalations ──────────────────────────────────────────────────
ALTER TABLE chat_messages
  ADD COLUMN IF NOT EXISTS escalation_role TEXT,      -- e.g., 'Manager', 'Supervisor'
  ADD COLUMN IF NOT EXISTS escalation_status TEXT DEFAULT 'pending' CHECK (escalation_status IN ('pending', 'resolved', 'ignored'));

-- ── 4. Enable Realtime ──────────────────────────────────────────────────────
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE chat_spaces;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE chat_channel_auto_rules;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;

-- ── 5. RLS ──────────────────────────────────────────────────────────────────
ALTER TABLE chat_spaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_channel_auto_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all chat_spaces" ON chat_spaces FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all chat_channel_auto_rules" ON chat_channel_auto_rules FOR ALL USING (true) WITH CHECK (true);
