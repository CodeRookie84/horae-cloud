-- Move the "has this account completed its mandatory first-login password
-- change" flag from localStorage (client-side, per-device) to a real DB
-- column. The client-side version silently reset on any new device, cleared
-- browser data, or iOS's aggressive storage-clearing for installed web apps
-- — even though the account's password was already changed — so the
-- forced-change prompt kept reappearing for every user, repeatedly.
--
-- Applied to prod 2026-07-18 via `supabase db query --linked`.

ALTER TABLE users ADD COLUMN IF NOT EXISTS pwd_changed BOOLEAN NOT NULL DEFAULT false;
