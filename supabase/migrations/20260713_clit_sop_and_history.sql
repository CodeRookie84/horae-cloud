-- CLIT round frequency on history + per-client SOP roster.
-- Run in the Supabase SQL Editor / CLI after 20260712_clit_access.sql.

-- 1. Record which frequency (Daily / Weekly / Monthly) a completed checklist round
--    covered. Nullable/blank for legacy + auto-archived (day-rollover) rounds.
ALTER TABLE maintenance_checklist_history ADD COLUMN IF NOT EXISTS frequency TEXT NOT NULL DEFAULT '';

-- 2. Per-CLIENT editable SOP roster (Project Lead, Sponsor, etc.). The SOP
--    framework is generic across clients; only the person names are client-specific.
CREATE TABLE IF NOT EXISTS maintenance_sop_meta (
  client_id  TEXT PRIMARY KEY,
  roster     JSONB NOT NULL DEFAULT '{}'::jsonb,   -- { "Document Owner / Project Lead": "…", … }
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE maintenance_sop_meta ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all maintenance_sop_meta" ON maintenance_sop_meta FOR ALL USING (true) WITH CHECK (true);

DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE maintenance_sop_meta; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
