-- Add the missing DELETE row-level-security policy to every app table.
--
-- Every public table had RLS enabled with permissive INSERT/SELECT/UPDATE
-- policies (tmp_insert / tmp_select / tmp_update) but NO delete policy. With RLS
-- on and no DELETE policy, Postgres silently removes 0 rows and PostgREST still
-- returns success — so the app reported "deleted" while the row remained (e.g.
-- a client admin deleting a staff user). This adds the permissive `tmp_delete`
-- policy wherever it's missing, matching the existing permissive pattern.
--
-- Apply via the Supabase dashboard SQL editor (or `supabase db query --linked`).
-- Idempotent: only creates the policy on tables that don't already have one.

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT c.relname
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind = 'r'
      AND c.relrowsecurity = true
      AND NOT EXISTS (
        SELECT 1 FROM pg_policy p
        WHERE p.polrelid = c.oid AND p.polcmd IN ('d', '*')  -- DELETE or ALL
      )
  LOOP
    EXECUTE format('CREATE POLICY tmp_delete ON public.%I FOR DELETE USING (true)', r.relname);
  END LOOP;
END $$;
