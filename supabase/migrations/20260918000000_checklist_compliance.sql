-- ============================================================================
-- Food Safety Checks — compliance layer on top of the existing Checklists module
-- (additive; safe to re-run). Phase 1.
--
--  • checklist_items gains per-item metadata (response type, critical flag,
--    corrective action, photo requirement, numeric pass range).
--  • checklist_stations — module-local responsible identities ("Kitchen — Closing",
--    "Counter — Opening"), decoupled from the staff directory (mirrors kot_stations,
--    but in-app/authenticated, so it uses the normal tenant-scoped RLS rather than
--    the KOT anon-kiosk permissive style).
--  • checklist_runs — one immutable, inspection-ready completion record. Per-item
--    results + evidence photo URLs live in `items` jsonb; photos themselves go to
--    the checklist-photos bucket. Runs are NOT written into checklists.description
--    (that JSON blob is for template meta only).
--
-- Isolation: client_id via tenants (same predicate as 20260811 rls_lockdown).
-- Apply: supabase db query --linked "<this file>"  (or the SQL editor).
-- ============================================================================

-- 1) Per-item metadata (defaults keep every existing checklist a plain tick list).
ALTER TABLE public.checklist_items ADD COLUMN IF NOT EXISTS response_type    TEXT    NOT NULL DEFAULT 'tick';
ALTER TABLE public.checklist_items ADD COLUMN IF NOT EXISTS critical         BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.checklist_items ADD COLUMN IF NOT EXISTS corrective_action TEXT;
ALTER TABLE public.checklist_items ADD COLUMN IF NOT EXISTS requires_photo   BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.checklist_items ADD COLUMN IF NOT EXISTS target           JSONB;   -- { min, max, unit }

-- 2) Stations — responsible identities defined inside the module (per outlet).
CREATE TABLE IF NOT EXISTS public.checklist_stations (
  id         TEXT PRIMARY KEY,
  tenant_id  TEXT NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  client_id  TEXT,                        -- denormalised for reporting; RLS keys off tenant_id
  label      TEXT NOT NULL,
  pin_hash   TEXT,                        -- optional PIN so a run is attributed to the right person
  active     BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS checklist_stations_tenant_idx ON public.checklist_stations (tenant_id);

-- 3) Runs — the immutable completion record (the inspection-ready register row).
CREATE TABLE IF NOT EXISTS public.checklist_runs (
  id              TEXT PRIMARY KEY,
  checklist_id    TEXT NOT NULL,
  tenant_id       TEXT NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  station_id      TEXT,
  performer_user_id TEXT,
  performer_name  TEXT NOT NULL,
  started_at      TIMESTAMPTZ,
  completed_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  status          TEXT NOT NULL DEFAULT 'completed',   -- 'completed' | 'failed'
  score           NUMERIC,                              -- mean 1–5 rating (audits)
  compliance_pct  NUMERIC,                              -- % of applicable items passed
  items           JSONB NOT NULL DEFAULT '[]'::jsonb,   -- [{ itemId, ok, value, remark, photoUrl, correctiveAction }]
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS checklist_runs_checklist_idx ON public.checklist_runs (checklist_id, completed_at DESC);
CREATE INDEX IF NOT EXISTS checklist_runs_tenant_idx    ON public.checklist_runs (tenant_id, completed_at DESC);

-- 4) RLS — tenant-scoped (client isolation via tenants), matching rls_lockdown.
ALTER TABLE public.checklist_stations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checklist_runs     ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS rls_all ON public.checklist_stations;
CREATE POLICY rls_all ON public.checklist_stations FOR ALL
  USING      (tenant_id IN (SELECT id FROM public.tenants WHERE client_id = app.current_client_id()) OR app.is_super_admin())
  WITH CHECK (tenant_id IN (SELECT id FROM public.tenants WHERE client_id = app.current_client_id()) OR app.is_super_admin());

DROP POLICY IF EXISTS rls_all ON public.checklist_runs;
CREATE POLICY rls_all ON public.checklist_runs FOR ALL
  USING      (tenant_id IN (SELECT id FROM public.tenants WHERE client_id = app.current_client_id()) OR app.is_super_admin())
  WITH CHECK (tenant_id IN (SELECT id FROM public.tenants WHERE client_id = app.current_client_id()) OR app.is_super_admin());

-- 5) Evidence photos — public bucket with unguessable paths (same pattern as
--    training-docs / chat-images). Path convention: <client>/<checklist>/<run>/<item>.jpg
INSERT INTO storage.buckets (id, name, public)
VALUES ('checklist-photos', 'checklist-photos', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Allow all checklist-photos" ON storage.objects;
CREATE POLICY "Allow all checklist-photos" ON storage.objects FOR ALL
  USING (bucket_id = 'checklist-photos')
  WITH CHECK (bucket_id = 'checklist-photos');
