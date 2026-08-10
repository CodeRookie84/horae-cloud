-- Auth foundation for the prototype→production security migration.
-- Additive and safe: adds the link column + RLS identity resolvers. Applied to
-- prod 2026-08-10 via `supabase db query --linked`. Does NOT enable RLS or change
-- any login behaviour on its own — those are later, separate steps.

-- 1) Link each app user (public.users) to its Supabase Auth account.
alter table public.users
  add column if not exists auth_id uuid unique references auth.users(id) on delete set null;

-- 2) Identity resolvers used by RLS policies. SECURITY DEFINER so they can read
--    users/tenants regardless of RLS; STABLE so Postgres caches them per statement.
create schema if not exists app;

create or replace function app.current_client_id()
returns text language sql stable security definer set search_path = public as $$
  select t.client_id
  from public.users u
  join public.tenants t on t.id = u.tenant_id
  where u.auth_id = auth.uid()
  limit 1
$$;

create or replace function app.is_super_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.users u
    where u.auth_id = auth.uid() and u.role = 'Super Admin'
  )
$$;

grant usage on schema app to authenticated, anon;
grant execute on function app.current_client_id() to authenticated, anon;
grant execute on function app.is_super_admin() to authenticated, anon;
