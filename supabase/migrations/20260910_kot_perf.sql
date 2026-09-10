-- ── KOT: performance indexes ─────────────────────────────────────────────────
-- Covers the app's hot read paths as volume grows (~100 orders/day). All
-- IF NOT EXISTS so the migration is re-runnable.

-- listOrders(): WHERE client_id [= ?] ORDER BY created_at DESC — the board load.
CREATE INDEX IF NOT EXISTS idx_kot_orders_client_created
  ON kot_orders (client_id, created_at DESC);

-- hydrateOrders(): kot_order_assignees WHERE order_id IN (...). There was only an
-- index on participant_id, so this join scanned — the notable missing one.
CREATE INDEX IF NOT EXISTS idx_kot_assignees_order
  ON kot_order_assignees (order_id);

-- listStatusEvents(): WHERE order_id ORDER BY created_at — the order timeline.
CREATE INDEX IF NOT EXISTS idx_kot_status_events_order_created
  ON kot_status_events (order_id, created_at);
