-- ============================================================================
-- Projects — "each member works through all the steps" model (2026-09-26).
-- Additive; safe to re-run.
--
--  • projects.manager_ids      — users the client admin authorises to see every
--                                member's progress and approve steps (besides
--                                the admin). Members only see their own.
--  • project_deliverables      — now one row per (project, member): that member's
--                                run through the steps (title = member name).
--  • project_activity.milestone_id / file_url — step-scoped updates, optionally
--                                with an attached photo/file.
-- Targets / daily updates tables are left in place but no longer used by the UI.
-- ============================================================================

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS manager_ids JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.project_activity
  ADD COLUMN IF NOT EXISTS milestone_id TEXT,
  ADD COLUMN IF NOT EXISTS file_url     TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS project_deliverables_member_run_idx
  ON public.project_deliverables (project_id, owner_user_id);
