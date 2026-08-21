-- Task assignees split into PRIMARY vs CC (2026-08-21)
--
-- Until now the multi-assignee list lived only inside the description text blob
-- (`---HORAE-METADATA---`), and the single `assigned_user_id` column held the
-- primary. That meant server-side readers (notify-dispatcher DB-webhook path,
-- daily-digest's `contains(assigned_user_ids, ...)`) had no real column to read,
-- so digest task summaries came up empty.
--
-- This adds two first-class array columns:
--   assigned_user_ids  – the PRIMARY assignees (they get the paid WhatsApp ping)
--   cc_user_ids        – the CC / keep-informed users (in-app + daily digest only)
--
-- Existing rows are intentionally left with empty arrays: getTasks() falls back
-- to the metadata blob for them, so their historical (possibly multi-)assignee
-- list is preserved. Only tasks created/edited after this migration populate the
-- columns. A backfill of just the primary is applied so at least the owner shows
-- up in server-side queries for legacy rows.

ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS assigned_user_ids text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS cc_user_ids       text[] NOT NULL DEFAULT '{}';

-- Best-effort backfill: seed the primary from the legacy single column so the
-- owner appears in digest/notification queries. Secondary assignees on old rows
-- stay in the metadata blob and are still resolved by getTasks().
UPDATE public.tasks
   SET assigned_user_ids = ARRAY[assigned_user_id]
 WHERE cardinality(assigned_user_ids) = 0
   AND assigned_user_id IS NOT NULL;
