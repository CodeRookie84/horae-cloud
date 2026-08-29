-- Personal reminders / notes (2026-08-30)
--
-- A lightweight, per-user notes feature. Deliberately PULL-only: reminders are
-- never actively pushed (no cron, no WhatsApp template, no push) so the feature
-- adds ZERO messaging cost. Staff create them from WhatsApp ("me …" / "I …") or
-- the app, and fetch them on request. `remind_at` is optional metadata for
-- display/sorting ("due today"), not a trigger.

create table if not exists public.reminders (
  id         text primary key,
  user_id    text not null,
  tenant_id  text,
  text       text not null,
  remind_at  timestamptz,                 -- optional "when", parsed from the message
  status     text not null default 'pending',  -- 'pending' | 'done'
  created_at timestamptz not null default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_reminders_user on public.reminders(user_id, status);

alter table public.reminders enable row level security;

-- Client-scoped access, mirroring the app's other tables (the app filters to the
-- signed-in user's own rows; the WhatsApp webhook uses the service role).
drop policy if exists rls_all on public.reminders;
create policy rls_all on public.reminders for all
  using (
    (tenant_id in (select id from public.tenants where client_id = app.current_client_id()))
    or app.is_super_admin()
  )
  with check (
    (tenant_id in (select id from public.tenants where client_id = app.current_client_id()))
    or app.is_super_admin()
  );
