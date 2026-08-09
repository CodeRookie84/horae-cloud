-- Drop the swot_analyses table — Growth Compass (personal SWOT) was removed from
-- the app on 2026-08-10 (no backup kept, per the project lead). This table is the
-- feature's only DB footprint; nothing else reads or writes it after the removal.
--
-- ⚠️ DESTRUCTIVE: this permanently deletes every row. There is no staging DB, so
-- run this ONLY when you're certain the Growth Compass data is not needed.
--
-- Apply via the Supabase dashboard SQL editor, or from a linked CLI:
--   supabase db query --linked "drop table if exists public.swot_analyses;"
--
-- Idempotent: safe to re-run.

DROP TABLE IF EXISTS public.swot_analyses;
