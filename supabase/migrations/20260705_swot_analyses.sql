-- SWOT Compass — per-user personal SWOT analyses
-- Run in Supabase SQL Editor after 20260705_team_talk_priority_users.sql
--
-- One row per staff member (their current analysis). Retaking overwrites via
-- upsert on user_id. tenant_id / client_id are stored so a future manager
-- "team console" can aggregate by outlet/client without a schema change.

CREATE TABLE IF NOT EXISTS swot_analyses (
  user_id      TEXT PRIMARY KEY,        -- staff member (from the global directory)
  tenant_id    TEXT,
  client_id    TEXT,
  role         TEXT NOT NULL,
  industry     TEXT NOT NULL,
  file         TEXT DEFAULT '',
  s            JSONB NOT NULL DEFAULT '[]'::jsonb,
  w            JSONB NOT NULL DEFAULT '[]'::jsonb,
  o            JSONB NOT NULL DEFAULT '[]'::jsonb,
  t            JSONB NOT NULL DEFAULT '[]'::jsonb,
  s_more       TEXT DEFAULT '',
  w_more       TEXT DEFAULT '',
  o_more       TEXT DEFAULT '',
  t_more       TEXT DEFAULT '',
  answers      JSONB NOT NULL DEFAULT '{}'::jsonb,   -- { likert, texts } — for retake prefill
  completed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_swot_analyses_client ON swot_analyses(client_id);
CREATE INDEX IF NOT EXISTS idx_swot_analyses_tenant ON swot_analyses(tenant_id);

-- RLS — matches the permissive pattern used across the other feature tables.
ALTER TABLE swot_analyses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all swot_analyses" ON swot_analyses FOR ALL USING (true) WITH CHECK (true);
