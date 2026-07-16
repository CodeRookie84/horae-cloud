-- Delta sync: give the polled collaborative tables an `updated_at` so the
-- foreground background sync can fetch only rows changed since the last tick
-- (instead of the whole history every 15s). See the cost-optimization plan.
--
-- chat_messages already has updated_at, so it's not touched here.
--
-- Apply via the Supabase dashboard SQL editor (or `supabase db query --linked`)
-- BEFORE deploying the Tier 2 frontend — do NOT run `supabase db push`.

-- Shared trigger fn: bump updated_at on every UPDATE.
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['tasks', 'notices', 'checklists', 'notifications'] LOOP
    -- 1. Add the column (backfilled to created_at so existing rows aren't "new").
    EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS updated_at timestamptz', t);
    EXECUTE format('UPDATE %I SET updated_at = COALESCE(updated_at, created_at, now()) WHERE updated_at IS NULL', t);
    EXECUTE format('ALTER TABLE %I ALTER COLUMN updated_at SET DEFAULT now()', t);
    EXECUTE format('ALTER TABLE %I ALTER COLUMN updated_at SET NOT NULL', t);

    -- 2. Keep it fresh on UPDATE.
    EXECUTE format('DROP TRIGGER IF EXISTS set_updated_at_%I ON %I', t, t);
    EXECUTE format('CREATE TRIGGER set_updated_at_%I BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION public.set_updated_at()', t, t);

    -- 3. Index the delta-query shape.
    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%I_tenant_updated ON %I (tenant_id, updated_at)', t, t);
  END LOOP;
END $$;
