-- ============================================================================
-- Projects — per-client templates (2026-09-29). Additive; safe to re-run.
--
--  • project_template_access — which BUILT-IN templates (ids from
--                              PROJECT_TEMPLATES in projectsService.ts) a client
--                              may use. Chosen by the super admin at client
--                              onboarding / client edit. No row = legacy client
--                              → every built-in template (keeps existing
--                              clients working). Only the super admin writes it.
--  • project_templates       — a client's OWN templates: a built-in (or another
--                              saved template) edited and saved under a new
--                              name. The original is never changed.
--
-- Apply: supabase db query --linked -f "<this file>"
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.project_template_access (
  client_id    TEXT PRIMARY KEY,
  template_ids JSONB NOT NULL DEFAULT '[]'::jsonb,   -- ["sales", "real-estate", …]
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.project_templates (
  id          TEXT PRIMARY KEY,
  client_id   TEXT NOT NULL,
  name        TEXT NOT NULL,
  blurb       TEXT,
  kind        TEXT NOT NULL DEFAULT 'checklist',     -- 'checklist' | 'pipeline'
  item_label  TEXT,
  milestones  JSONB NOT NULL DEFAULT '[]'::jsonb,    -- same shape as projects.milestones
  based_on    TEXT,                                  -- template id it was copied from
  created_by  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS project_templates_client_idx ON public.project_templates (client_id, created_at);

-- RLS — a client reads its own access row; only the super admin changes it.
ALTER TABLE public.project_template_access ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS rls_read  ON public.project_template_access;
DROP POLICY IF EXISTS rls_write ON public.project_template_access;
CREATE POLICY rls_read ON public.project_template_access FOR SELECT
  USING (client_id = app.current_client_id() OR app.is_super_admin());
CREATE POLICY rls_write ON public.project_template_access FOR ALL
  USING (app.is_super_admin()) WITH CHECK (app.is_super_admin());

ALTER TABLE public.project_templates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS rls_all ON public.project_templates;
CREATE POLICY rls_all ON public.project_templates FOR ALL
  USING      (client_id = app.current_client_id() OR app.is_super_admin())
  WITH CHECK (client_id = app.current_client_id() OR app.is_super_admin());
