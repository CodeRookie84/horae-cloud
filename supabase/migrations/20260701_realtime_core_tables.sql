-- Enable Supabase Realtime for core operational tables.
-- Without this, postgres_changes subscriptions in the client never fire
-- for INSERT/UPDATE events on these tables, breaking live bell/toast updates.

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE tasks;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE notices;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
