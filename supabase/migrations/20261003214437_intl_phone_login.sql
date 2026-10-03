-- International phone numbers (2026-10-04)
--
-- Staff numbers are stored as "+<country code><number>" (all existing rows are
-- already "+91XXXXXXXXXX"). Matching moves from "last 10 digits" — which can't
-- tell +91 98xxx from +44 98xxx and breaks for non-10-digit countries — to an
-- exact match on the full international number. Purely ADDITIVE: the old
-- login_email_for_phone(p_last10) and users.phone_last10 stay so cached app
-- bundles keep working during rollout.

-- 1. Exact-match lookups (WhatsApp inbound, session restore, duplicate check).
create index if not exists idx_users_phone_number on public.users(phone_number);

-- 2. Mobile-number login resolver, country-code aware.
--    Returns the staff member's real Supabase Auth email (read from auth.users
--    via auth_id, so it's right even for phone-only staff whose shim differs),
--    or NULL when no staff number matches.
--      p_digits : international digits from the app's normalizer, e.g. 971501234567
--      p_typed  : the raw typed digits — lets someone abroad type their LOCAL
--                 number without the code; accepted only when exactly ONE staff
--                 number ends with it (leading trunk zeros ignored, ≥7 digits).
--    Exposure is unchanged from v1: "does this number exist + its login email".
create or replace function public.login_email_for_phone_v2(p_digits text, p_typed text default null)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_suffix text := ltrim(regexp_replace(coalesce(p_typed, ''), '[^0-9]', '', 'g'), '0');
  v_ids    text[];
begin
  if coalesce(p_digits, '') <> '' then
    select array_agg(id) into v_ids from (
      select id from public.users where phone_number = '+' || p_digits limit 1
    ) x;
  end if;

  if v_ids is null and length(v_suffix) >= 7 then
    select array_agg(id) into v_ids from (
      select id from public.users
      where regexp_replace(coalesce(phone_number, ''), '[^0-9]', '', 'g') like '%' || v_suffix
      limit 2
    ) x;
    if array_length(v_ids, 1) <> 1 then return null; end if;  -- ambiguous → refuse
  end if;

  if v_ids is null then return null; end if;

  return (
    select lower(coalesce(au.email, u.email, substr(u.phone_number, 2) || '@horae.local'))
    from public.users u
    left join auth.users au on au.id = u.auth_id
    where u.id = v_ids[1]
  );
end;
$$;

revoke all on function public.login_email_for_phone_v2(text, text) from public;
grant execute on function public.login_email_for_phone_v2(text, text) to anon, authenticated;
