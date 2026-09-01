-- ============================================================================
-- RLS LOCKDOWN — replace the permissive tmp_* (USING(true)) policies with real
-- client-isolation policies. Isolation boundary = client_id (per the data model:
-- Client → Tenant/outlet → User). Depends on 20260810_auth_foundation.sql
-- (app.current_client_id(), app.is_super_admin()) and real Supabase Auth sessions.
--
-- Resolver fns are SECURITY DEFINER owned by postgres (rolbypassrls=true), so the
-- users/tenants policies calling them do NOT recurse.
--
-- Super Admin gets a blanket bypass: the platform console + its user-impersonation
-- feature need cross-client reach, and the sole super admin is the platform owner.
--
-- Apply: supabase db query --linked "<this file>". Revert: 20260811_rls_revert.sql.
-- ============================================================================

-- 1) Drop every existing policy on public tables (clears the tmp_* set + any leftovers).
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT c.relname AS t, p.polname AS pol
    FROM pg_policy p
    JOIN pg_class c ON c.oid = p.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.pol, r.t);
  END LOOP;
END $$;

-- Convenience note: predicates are inlined below.
--   client-direct : (col = app.current_client_id() OR app.is_super_admin())
--   tenant-scoped : (tenant_id IN (SELECT id FROM public.tenants
--                    WHERE client_id = app.current_client_id()) OR app.is_super_admin())

-- 2) Tier A — tables that carry client_id directly.
CREATE POLICY rls_all ON public.tenants FOR ALL
  USING (client_id = app.current_client_id() OR app.is_super_admin())
  WITH CHECK (client_id = app.current_client_id() OR app.is_super_admin());

CREATE POLICY rls_all ON public.trainings FOR ALL
  USING (client_id = app.current_client_id() OR app.is_super_admin())
  WITH CHECK (client_id = app.current_client_id() OR app.is_super_admin());

CREATE POLICY rls_all ON public.maintenance_sop_meta FOR ALL
  USING (client_id = app.current_client_id() OR app.is_super_admin())
  WITH CHECK (client_id = app.current_client_id() OR app.is_super_admin());

-- clients: everyone reads their OWN client; only the super admin creates/edits.
CREATE POLICY rls_select ON public.clients FOR SELECT
  USING (id = app.current_client_id() OR app.is_super_admin());
CREATE POLICY rls_insert ON public.clients FOR INSERT WITH CHECK (app.is_super_admin());
CREATE POLICY rls_update ON public.clients FOR UPDATE USING (app.is_super_admin()) WITH CHECK (app.is_super_admin());
CREATE POLICY rls_delete ON public.clients FOR DELETE USING (app.is_super_admin());

-- 3) Tier B — tables scoped by tenant_id (resolved to client via tenants).
DO $$
DECLARE t text;
  pred text := '(tenant_id IN (SELECT id FROM public.tenants WHERE client_id = app.current_client_id()) OR app.is_super_admin())';
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'checklists','notices','tasks','notifications','users','training_attempts',
    'maintenance_audits','maintenance_checklist_history','maintenance_checklist_state',
    'maintenance_defects','maintenance_equipment'
  ] LOOP
    EXECUTE format('CREATE POLICY rls_all ON public.%I FOR ALL USING (%s) WITH CHECK (%s)', t, pred, pred);
  END LOOP;
END $$;

-- 4) Report tables — the app READS them (engagement report), edge functions WRITE
--    them via service_role (which bypasses RLS). So: tenant-scoped SELECT only.
CREATE POLICY rls_select ON public.notification_log FOR SELECT
  USING (tenant_id IN (SELECT id FROM public.tenants WHERE client_id = app.current_client_id()) OR app.is_super_admin());
CREATE POLICY rls_select ON public.whatsapp_inbound_messages FOR SELECT
  USING (tenant_id IN (SELECT id FROM public.tenants WHERE client_id = app.current_client_id()) OR app.is_super_admin());

-- 5) Tier C — child tables reached through a parent FK.
CREATE POLICY rls_all ON public.checklist_items FOR ALL
  USING (app.is_super_admin() OR EXISTS (
    SELECT 1 FROM public.checklists c JOIN public.tenants t ON t.id = c.tenant_id
    WHERE c.id = checklist_items.checklist_id AND t.client_id = app.current_client_id()))
  WITH CHECK (app.is_super_admin() OR EXISTS (
    SELECT 1 FROM public.checklists c JOIN public.tenants t ON t.id = c.tenant_id
    WHERE c.id = checklist_items.checklist_id AND t.client_id = app.current_client_id()));

CREATE POLICY rls_all ON public.task_messages FOR ALL
  USING (app.is_super_admin() OR EXISTS (
    SELECT 1 FROM public.tasks tk JOIN public.tenants t ON t.id = tk.tenant_id
    WHERE tk.id = task_messages.task_id AND t.client_id = app.current_client_id()))
  WITH CHECK (app.is_super_admin() OR EXISTS (
    SELECT 1 FROM public.tasks tk JOIN public.tenants t ON t.id = tk.tenant_id
    WHERE tk.id = task_messages.task_id AND t.client_id = app.current_client_id()));

-- 6) Service-role-only tables — RLS stays ON with NO policy, so authenticated/anon
--    get nothing and only edge functions (service_role) can touch them:
--      digest_tracker, notification_claims  (written by daily-digest / notify-dispatcher)
--      chat_*  (dead Team Talk residue — will be dropped)
--    Their policies were removed in step 1 and are intentionally not recreated.
