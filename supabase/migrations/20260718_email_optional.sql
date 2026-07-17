-- Phone-only staff: email is optional now (login works by email OR mobile),
-- but users.email was NOT NULL — so onboarding a staff member with only a
-- mobile number silently failed to insert (the UI reported success because the
-- insert error wasn't checked; fixed in store.onboardingUser alongside this).
--
-- Applied to prod 2026-07-17 via `supabase db query --linked`.

ALTER TABLE users ALTER COLUMN email DROP NOT NULL;
