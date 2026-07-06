-- Equipment Maintenance (CLIT Autonomous Maintenance) — per-outlet tables.
-- Run in the Supabase SQL Editor / CLI after 20260705_swot_analyses.sql.
--
-- Ports the standalone CLIT tool into Horae. Everything is scoped per outlet
-- (tenant_id). Permissive RLS matches the pattern used by every other Horae
-- feature table (swot_analyses, checklists, notices, …).

-- 1. Equipment registry (built-in machines are lazily seeded per outlet by the
--    client on first open; admins can add custom machines). id is composite:
--    "<tenant_id>__<code>" so a base machine stays unique per outlet.
CREATE TABLE IF NOT EXISTS maintenance_equipment (
  id          TEXT PRIMARY KEY,
  tenant_id   TEXT NOT NULL,
  name        TEXT NOT NULL,
  group_name  TEXT NOT NULL DEFAULT '',
  icon        TEXT NOT NULL DEFAULT 'oven',
  checklist   JSONB NOT NULL DEFAULT '[]'::jsonb,   -- [{c,p,std,freq,method}]
  sort_order  INT NOT NULL DEFAULT 0,
  is_custom   BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_maint_equipment_tenant ON maintenance_equipment(tenant_id);

-- 2. Current in-progress CLIT marks (one row per equipment). Reset-able.
CREATE TABLE IF NOT EXISTS maintenance_checklist_state (
  equipment_id TEXT PRIMARY KEY,
  tenant_id    TEXT NOT NULL,
  responses    JSONB NOT NULL DEFAULT '{}'::jsonb,   -- { "<itemIdx>": "ok"|"notok" }
  tech_name    TEXT DEFAULT '',
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_maint_state_tenant ON maintenance_checklist_state(tenant_id);

-- 3. Archived completed rounds (permanent).
CREATE TABLE IF NOT EXISTS maintenance_checklist_history (
  id             TEXT PRIMARY KEY,
  tenant_id      TEXT NOT NULL,
  equipment_id   TEXT NOT NULL,
  equipment_name TEXT NOT NULL DEFAULT '',
  date           DATE NOT NULL,
  tech_name      TEXT DEFAULT '',
  items          JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_maint_history_tenant ON maintenance_checklist_history(tenant_id);

-- 4. Defect log.
CREATE TABLE IF NOT EXISTS maintenance_defects (
  id             TEXT PRIMARY KEY,
  tenant_id      TEXT NOT NULL,
  equipment_id   TEXT NOT NULL,
  equipment_name TEXT NOT NULL DEFAULT '',
  item_idx       INT NOT NULL,
  component      TEXT NOT NULL DEFAULT '',
  description    TEXT NOT NULL DEFAULT '',
  criticality    TEXT NOT NULL DEFAULT 'Non-Critical',   -- 'Critical' | 'Non-Critical'
  status         TEXT NOT NULL DEFAULT 'Open',            -- 'Open' | 'In Progress' | 'Closed'
  action         TEXT DEFAULT '',
  spares         TEXT DEFAULT '',
  target         DATE,
  date           DATE NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_maint_defects_tenant ON maintenance_defects(tenant_id);

-- 5. AM audit submissions (permanent).
CREATE TABLE IF NOT EXISTS maintenance_audits (
  id             TEXT PRIMARY KEY,
  tenant_id      TEXT NOT NULL,
  equipment_id   TEXT NOT NULL,
  equipment_name TEXT NOT NULL DEFAULT '',
  date           DATE NOT NULL,
  inspector      TEXT NOT NULL DEFAULT '',
  total_score    INT NOT NULL DEFAULT 0,
  scores         JSONB NOT NULL DEFAULT '[]'::jsonb,
  remarks        JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_maint_audits_tenant ON maintenance_audits(tenant_id);

-- RLS — permissive, matching the rest of Horae.
ALTER TABLE maintenance_equipment          ENABLE ROW LEVEL SECURITY;
ALTER TABLE maintenance_checklist_state    ENABLE ROW LEVEL SECURITY;
ALTER TABLE maintenance_checklist_history  ENABLE ROW LEVEL SECURITY;
ALTER TABLE maintenance_defects            ENABLE ROW LEVEL SECURITY;
ALTER TABLE maintenance_audits             ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all maintenance_equipment"         ON maintenance_equipment         FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all maintenance_checklist_state"   ON maintenance_checklist_state   FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all maintenance_checklist_history" ON maintenance_checklist_history FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all maintenance_defects"           ON maintenance_defects           FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all maintenance_audits"            ON maintenance_audits            FOR ALL USING (true) WITH CHECK (true);

-- Realtime — so cross-device changes to the defect log / checklist marks fire
-- postgres_changes for any open client (the Hub also polls as a fallback).
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE maintenance_equipment;          EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE maintenance_checklist_state;    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE maintenance_defects;            EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE maintenance_audits;             EXCEPTION WHEN duplicate_object THEN NULL; END $$;
