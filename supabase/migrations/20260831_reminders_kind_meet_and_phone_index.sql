-- Reminders "kind" + faster inbound phone lookup (2026-08-31)
--
-- 1) Reminders now carry a `kind` so the SAME table backs two WhatsApp keywords:
--      • rem  → kind = 'reminder'  (personal notes/reminders, the original use)
--      • meet → kind = 'meeting'   (meetings only)
--    Both stay PULL-only (no cron, no push, zero messaging cost). Existing rows
--    become 'reminder' via the DEFAULT, so nothing is lost. The app's Reminders
--    screen filters to kind = 'reminder' so meetings never leak into it.
--
-- 2) Inbound WhatsApp messages resolve the sender with the last 10 phone digits.
--    The webhook used `phone_number LIKE '%<last10>'` — a LEADING wildcard that
--    can't use an index, so every inbound did a full scan of `users`. We add a
--    STORED generated column holding the normalised last-10 digits and index it,
--    turning that scan into an indexed exact-match lookup (matters at 10k+ users).

-- 1. reminders.kind ───────────────────────────────────────────────────────────
alter table public.reminders
  add column if not exists kind text not null default 'reminder';  -- 'reminder' | 'meeting'

-- Query path is (user_id, kind, status) — the reminders/meetings list fetch.
create index if not exists idx_reminders_user_kind
  on public.reminders(user_id, kind, status);

-- 2. users.phone_last10 (generated, indexed) ──────────────────────────────────
alter table public.users
  add column if not exists phone_last10 text
  generated always as (right(regexp_replace(coalesce(phone_number, ''), '[^0-9]', '', 'g'), 10)) stored;

create index if not exists idx_users_phone_last10 on public.users(phone_last10);
