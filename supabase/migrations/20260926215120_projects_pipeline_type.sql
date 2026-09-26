-- ============================================================================
-- Projects — two project types (2026-09-27). Additive; safe to re-run.
--
--  • projects.kind              — 'checklist' (every member works through all
--                                 the steps once — one run per member) or
--                                 'pipeline' (members add many items — leads,
--                                 orders, candidates… — that each move through
--                                 the steps). `item_label` names the items.
--  • project_deliverables.run_key — the member id for a checklist run, NULL for
--                                 a pipeline item. Replaces the unique
--                                 (project_id, owner_user_id) index, which
--                                 allowed only one item per member.
--  • follow_up_at / lost_reason / source — pipeline item fields (contact_name,
--                                 contact_phone, value, notes already exist).
-- ============================================================================

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'checklist';

ALTER TABLE public.project_deliverables
  ADD COLUMN IF NOT EXISTS run_key      TEXT,
  ADD COLUMN IF NOT EXISTS follow_up_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS lost_reason  TEXT,
  ADD COLUMN IF NOT EXISTS source       TEXT;

-- Every existing row is a checklist run (one per member).
UPDATE public.project_deliverables SET run_key = owner_user_id WHERE run_key IS NULL;

-- NULLs are distinct, so pipeline items (run_key NULL) are unconstrained while
-- a member still gets exactly one checklist run per project.
CREATE UNIQUE INDEX IF NOT EXISTS project_deliverables_run_key_idx
  ON public.project_deliverables (project_id, run_key);
DROP INDEX IF EXISTS public.project_deliverables_member_run_idx;

CREATE INDEX IF NOT EXISTS project_deliverables_follow_up_idx
  ON public.project_deliverables (project_id, follow_up_at) WHERE status = 'open';
