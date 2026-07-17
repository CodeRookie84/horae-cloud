-- Track how many times a staff member left/backgrounded the app during a
-- training test attempt — a soft deterrent + admin-visible signal, not an
-- automatic fail (a phone call shouldn't invalidate a real attempt). Shown
-- next to the score in the admin scores view for the admin's own judgment.
--
-- Applied to prod 2026-07-18 via `supabase db query --linked`.

ALTER TABLE training_attempts ADD COLUMN IF NOT EXISTS screen_leaves INTEGER NOT NULL DEFAULT 0;
