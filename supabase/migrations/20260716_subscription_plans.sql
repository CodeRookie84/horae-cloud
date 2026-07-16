-- Subscription plans: add the Training combo add-on flag to clients.
--
-- Feature entitlements are now DERIVED from clients.plan + this flag (see
-- src/services/plans.ts) instead of a per-browser localStorage override, so a
-- super-admin plan switch propagates to every user of that client.
--
-- The `plan` column is free text (no CHECK constraint), so the new "Training"
-- plan value needs no schema change — only this add-on column.
--
-- Apply against prod via:  supabase db query --linked "<contents>"
-- (Do NOT run `supabase db push` — prod schema is applied by hand.)

ALTER TABLE clients ADD COLUMN IF NOT EXISTS training_addon BOOLEAN NOT NULL DEFAULT false;
