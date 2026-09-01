-- Mobile-number login resolver (2026-08-22)
--
-- Staff onboarded WITH an email have their Supabase Auth account under that
-- email; phone-only staff have it under the shim `91<last10>@horae.local`.
-- Login-by-mobile therefore has to resolve a phone → the real auth email BEFORE
-- authenticating. A plain client SELECT can't do this: it runs pre-login (no
-- session), and public.users has client-scoped RLS (app.current_client_id()),
-- so an anon read returns nothing.
--
-- This SECURITY DEFINER function bypasses RLS to return just the email for an
-- exact 10-digit phone match (or NULL for phone-only staff, where the caller
-- falls back to the shim). Exposure is limited to "does this number exist + its
-- email", acceptable for an internal ops tool.

create or replace function public.login_email_for_phone(p_last10 text)
returns text
language sql
security definer
set search_path = public
as $$
  select email from public.users
  where p_last10 is not null and length(p_last10) = 10
    and phone_number like '%' || p_last10
  limit 1;
$$;

grant execute on function public.login_email_for_phone(text) to anon, authenticated;
