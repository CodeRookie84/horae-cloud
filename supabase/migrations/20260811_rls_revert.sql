-- EMERGENCY REVERT for 20260811_rls_lockdown.sql — restores the permissive
-- (USING(true)) state so the app keeps working while a policy problem is fixed.
-- Not a security state; only for rollback during the RLS rollout.
--   supabase db query --linked "<this file>"
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT c.relname AS t, p.polname AS pol
    FROM pg_policy p JOIN pg_class c ON c.oid = p.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = 'public'
  LOOP EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.pol, r.t); END LOOP;

  FOR r IN
    SELECT c.relname AS t FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = 'public'
    WHERE c.relkind = 'r' AND c.relrowsecurity = true
  LOOP EXECUTE format('CREATE POLICY tmp_all ON public.%I FOR ALL USING (true) WITH CHECK (true)', r.t); END LOOP;
END $$;
