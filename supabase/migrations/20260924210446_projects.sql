-- ============================================================================
-- Projects — milestone pipelines for outcome-paid roles (marketing, real estate,
-- sales). Additive; safe to re-run.
--
--  • projects               — one pipeline. Its customisable milestones (each with
--                             a gating checklist + optional approval) live in the
--                             `milestones` jsonb so reorder/rename is one atomic
--                             write. `item_label` lets each client call the items
--                             "Deliverable", "Lead", "Deal"…
--  • project_deliverables   — the items that move milestone → milestone. Checklist
--                             answers + approval state are keyed by milestone id.
--  • project_activity       — append-only history per deliverable (moves,
--                             approvals, comments).
--  • project_targets        — per-person target for a period: count and/or ₹ value.
--  • project_daily_updates  — one status line per person per project per day.
--
-- Scoped per CLIENT (a project spans outlets), keyed off app.current_client_id().
-- Apply: supabase db query --linked -f "<this file>"
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.projects (
  id          TEXT PRIMARY KEY,
  client_id   TEXT NOT NULL,
  name        TEXT NOT NULL,
  description TEXT,
  item_label  TEXT NOT NULL DEFAULT 'Deliverable',
  color       TEXT NOT NULL DEFAULT 'indigo',
  status      TEXT NOT NULL DEFAULT 'active',          -- 'active' | 'archived'
  milestones  JSONB NOT NULL DEFAULT '[]'::jsonb,      -- [{ id, name, slaDays, requiresApproval, checklist:[{ id, text, type, required }] }]
  member_ids  JSONB NOT NULL DEFAULT '[]'::jsonb,      -- user ids who work this project
  created_by  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS projects_client_idx ON public.projects (client_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.project_deliverables (
  id                   TEXT PRIMARY KEY,
  project_id           TEXT NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  client_id            TEXT NOT NULL,
  title                TEXT NOT NULL,
  contact_name         TEXT,
  contact_phone        TEXT,
  value                NUMERIC NOT NULL DEFAULT 0,
  owner_user_id        TEXT,
  milestone_id         TEXT,                             -- current milestone
  status               TEXT NOT NULL DEFAULT 'open',     -- 'open' | 'won' | 'lost'
  checklist            JSONB NOT NULL DEFAULT '{}'::jsonb, -- { [milestoneId]: { [itemId]: { done, value, by, at } } }
  approvals            JSONB NOT NULL DEFAULT '{}'::jsonb, -- { [milestoneId]: { status, requestedBy, decidedBy, at, note } }
  notes                TEXT,
  milestone_entered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_at            TIMESTAMPTZ,
  created_by           TEXT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS project_deliverables_project_idx ON public.project_deliverables (project_id);
CREATE INDEX IF NOT EXISTS project_deliverables_owner_idx   ON public.project_deliverables (owner_user_id);

CREATE TABLE IF NOT EXISTS public.project_activity (
  id             TEXT PRIMARY KEY,
  deliverable_id TEXT NOT NULL REFERENCES public.project_deliverables(id) ON DELETE CASCADE,
  project_id     TEXT NOT NULL,
  client_id      TEXT NOT NULL,
  user_id        TEXT,
  user_name      TEXT,
  kind           TEXT NOT NULL,     -- 'created' | 'moved' | 'approval_requested' | 'approved' | 'rejected' | 'won' | 'lost' | 'reopened' | 'comment'
  text           TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS project_activity_deliverable_idx ON public.project_activity (deliverable_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.project_targets (
  id           TEXT PRIMARY KEY,
  project_id   TEXT NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  client_id    TEXT NOT NULL,
  user_id      TEXT NOT NULL,
  period_start DATE NOT NULL,
  period_end   DATE NOT NULL,
  target_count INTEGER,
  target_value NUMERIC,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (project_id, user_id, period_start)
);

CREATE TABLE IF NOT EXISTS public.project_daily_updates (
  id         TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  client_id  TEXT NOT NULL,
  user_id    TEXT NOT NULL,
  user_name  TEXT,
  day        DATE NOT NULL,
  text       TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (project_id, user_id, day)
);

-- RLS — client-scoped, same identity resolvers as rls_lockdown.
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['projects','project_deliverables','project_activity','project_targets','project_daily_updates'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS rls_all ON public.%I', t);
    EXECUTE format(
      'CREATE POLICY rls_all ON public.%I FOR ALL
         USING      (client_id = app.current_client_id() OR app.is_super_admin())
         WITH CHECK (client_id = app.current_client_id() OR app.is_super_admin())', t);
  END LOOP;
END $$;

-- Checklist evidence files (photos / signed agreements / invoices) — public
-- bucket with unguessable paths, same pattern as checklist-photos.
INSERT INTO storage.buckets (id, name, public)
VALUES ('project-files', 'project-files', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Allow all project-files" ON storage.objects;
CREATE POLICY "Allow all project-files" ON storage.objects FOR ALL
  USING (bucket_id = 'project-files')
  WITH CHECK (bucket_id = 'project-files');
