-- =============================================================================
-- KOT — Cake-Order Tracking (Cakewala)
-- =============================================================================
-- Self-contained module built INSIDE Horae but designed to be lift-out clean:
--   • every table is prefixed `kot_`
--   • no existing Horae table is altered by this migration
--   • one storage bucket `kot-photos`
-- Removing KOT later = drop these tables + bucket, delete src/kot/, delete the
-- kot-* edge functions. Nothing else in Horae depends on any of this.
--
-- Outlets are reused from Horae's existing `tenants` table (tenant_id = outlet).
-- We DO NOT add columns to `tenants` or `users`; the manager⇄KOT link lives on
-- kot_participants.linked_user_id so `users` stays untouched.
--
-- RLS is permissive (USING(true) WITH CHECK(true)) to match the current Horae
-- posture (see 20260811_rls_revert.sql). The shared-station surface is scoped by
-- tenant_id in the kot-station-auth edge function, not by RLS, for now.
-- Run in the Supabase SQL editor / CLI after 20260825_demo_clients.sql.

-- ── 0. KOT-enabled clients (the entitlement flag) ────────────────────────────
-- A client uses KOT only if it has a row here. This gates the launcher icon and
-- the admin surface, so clients that don't need KOT never see any of it — and it
-- lets a KOT client's admin open the module to do first-time setup (bootstrap),
-- before any station/participant exists. Enable Cakewala with one INSERT:
--   INSERT INTO kot_clients (client_id) VALUES ('<cakewala-client-id>');
CREATE TABLE IF NOT EXISTS kot_clients (
  client_id   TEXT PRIMARY KEY,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── 1. People Directory — separate from Horae's staff directory ───────────────
-- A participant belongs to a client and a team; which outlets they cover is the
-- many-to-many kot_participant_outlets (Kitchen/Management map to all outlets
-- today, can be split per-outlet later without a migration). `phone` drives the
-- WhatsApp/push reminders; `linked_user_id` (optional) ties a participant to a
-- Horae user so managers get the KOT icon + are identified on status actions.
CREATE TABLE IF NOT EXISTS kot_participants (
  id             TEXT PRIMARY KEY,
  client_id      TEXT NOT NULL,
  name           TEXT NOT NULL,
  phone          TEXT NOT NULL DEFAULT '',
  team           TEXT NOT NULL DEFAULT 'Outlet',   -- 'Outlet' | 'Kitchen' | 'Management'
  linked_user_id TEXT,                             -- optional → Horae users.id
  active         BOOLEAN NOT NULL DEFAULT true,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_kot_participants_client ON kot_participants(client_id);
CREATE INDEX IF NOT EXISTS idx_kot_participants_user   ON kot_participants(linked_user_id);

CREATE TABLE IF NOT EXISTS kot_participant_outlets (
  participant_id TEXT NOT NULL,
  tenant_id      TEXT NOT NULL,                    -- an outlet
  PRIMARY KEY (participant_id, tenant_id)
);
CREATE INDEX IF NOT EXISTS idx_kot_part_outlets_tenant ON kot_participant_outlets(tenant_id);

-- ── 2. Shared floor logins (QR + rotatable code) ─────────────────────────────
-- One station per shared tablet, scoped to a single outlet. `code_hash` is a
-- SHA-256 of the access code (never stored in clear); rotating the code just
-- overwrites the hash and bumps updated_at, killing old remembered-device tokens.
CREATE TABLE IF NOT EXISTS kot_stations (
  id          TEXT PRIMARY KEY,
  client_id   TEXT NOT NULL,
  tenant_id   TEXT NOT NULL,                       -- the outlet
  label       TEXT NOT NULL DEFAULT '',
  code_hash   TEXT NOT NULL,
  active      BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_kot_stations_tenant ON kot_stations(tenant_id);

-- ── 3. Orders (one per scanned KOT slip) ─────────────────────────────────────
-- `invoice_no` is unique per client so two staff scanning the same slip can't
-- create a duplicate. `extracted` keeps the raw vision-model JSON for audit even
-- after the confirm-form edits. `status` mirrors the latest kot_status_events row.
CREATE TABLE IF NOT EXISTS kot_orders (
  id                TEXT PRIMARY KEY,
  client_id         TEXT NOT NULL,
  tenant_id         TEXT NOT NULL,                 -- outlet the order belongs to
  invoice_no        TEXT,
  order_date        TEXT,                          -- as printed ("Advance Order" date)
  customer_name     TEXT DEFAULT '',
  customer_phone    TEXT DEFAULT '',
  customer_address  TEXT DEFAULT '',
  delivery_at       TIMESTAMPTZ,                   -- delivery date + time
  fulfilment        TEXT DEFAULT 'delivery',       -- 'pickup' | 'delivery'
  bill_total        NUMERIC DEFAULT 0,
  advance_paid      NUMERIC DEFAULT 0,
  balance_due       NUMERIC DEFAULT 0,
  kot_photo_url     TEXT,                          -- the scanned slip (source of truth)
  status            TEXT NOT NULL DEFAULT 'order_received',
  extracted         JSONB,                         -- raw extraction, for audit
  created_by_station TEXT,
  created_by_user_id TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_kot_orders_invoice UNIQUE (client_id, invoice_no)
);
CREATE INDEX IF NOT EXISTS idx_kot_orders_tenant   ON kot_orders(tenant_id);
CREATE INDEX IF NOT EXISTS idx_kot_orders_status   ON kot_orders(status);
CREATE INDEX IF NOT EXISTS idx_kot_orders_delivery ON kot_orders(delivery_at);

-- ── 4. Line items + the all-important handwritten remark ─────────────────────
-- Printed invoice rows come through as normal items. The pen-written
-- personalisation (the reason this app exists) is stored as is_extra_remark=true
-- with editable remark_text + an optional photo of the customer's cake drawing.
CREATE TABLE IF NOT EXISTS kot_order_items (
  id                TEXT PRIMARY KEY,
  order_id          TEXT NOT NULL,
  name              TEXT DEFAULT '',
  qty               NUMERIC DEFAULT 0,
  rate              NUMERIC DEFAULT 0,
  amount            NUMERIC DEFAULT 0,
  is_extra_remark   BOOLEAN NOT NULL DEFAULT false,
  remark_text       TEXT DEFAULT '',
  drawing_photo_url TEXT,
  sort_order        INT NOT NULL DEFAULT 0,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_kot_items_order ON kot_order_items(order_id);

-- ── 5. Default + added assignees (who to notify for this order) ───────────────
CREATE TABLE IF NOT EXISTS kot_order_assignees (
  order_id       TEXT NOT NULL,
  participant_id TEXT NOT NULL,
  PRIMARY KEY (order_id, participant_id)
);
CREATE INDEX IF NOT EXISTS idx_kot_assignees_participant ON kot_order_assignees(participant_id);

-- ── 6. Status audit trail (the team-handoff accountability) ───────────────────
-- One row per transition. photo_url is REQUIRED by the app for the
-- 'ready' and 'collected' statuses (enforced in the UI + kot-notify). Records
-- who acted at station granularity (actor_station_id) and, when known, the
-- individual (actor_participant_id / actor_name).
CREATE TABLE IF NOT EXISTS kot_status_events (
  id                   TEXT PRIMARY KEY,
  order_id             TEXT NOT NULL,
  tenant_id            TEXT,
  status               TEXT NOT NULL,
  photo_url            TEXT,
  note                 TEXT DEFAULT '',
  actor_station_id     TEXT,
  actor_participant_id TEXT,
  actor_name           TEXT DEFAULT '',
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_kot_status_events_order ON kot_status_events(order_id);

-- ── 7. Photo storage ─────────────────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public)
VALUES ('kot-photos', 'kot-photos', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Allow all kot-photos" ON storage.objects;
CREATE POLICY "Allow all kot-photos"
  ON storage.objects FOR ALL
  USING (bucket_id = 'kot-photos')
  WITH CHECK (bucket_id = 'kot-photos');

-- ── 8. RLS — permissive, matching current Horae ──────────────────────────────
ALTER TABLE kot_clients             ENABLE ROW LEVEL SECURITY;
ALTER TABLE kot_participants        ENABLE ROW LEVEL SECURITY;
ALTER TABLE kot_participant_outlets ENABLE ROW LEVEL SECURITY;
ALTER TABLE kot_stations            ENABLE ROW LEVEL SECURITY;
ALTER TABLE kot_orders              ENABLE ROW LEVEL SECURITY;
ALTER TABLE kot_order_items         ENABLE ROW LEVEL SECURITY;
ALTER TABLE kot_order_assignees     ENABLE ROW LEVEL SECURITY;
ALTER TABLE kot_status_events       ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all kot_clients"             ON kot_clients             FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all kot_participants"        ON kot_participants        FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all kot_participant_outlets" ON kot_participant_outlets FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all kot_stations"            ON kot_stations            FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all kot_orders"              ON kot_orders              FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all kot_order_items"         ON kot_order_items         FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all kot_order_assignees"     ON kot_order_assignees     FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all kot_status_events"       ON kot_status_events       FOR ALL USING (true) WITH CHECK (true);

-- ── 9. Realtime — so outlet & kitchen tablets see changes live ───────────────
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE kot_orders;          EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE kot_order_items;     EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE kot_order_assignees; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE kot_status_events;   EXCEPTION WHEN duplicate_object THEN NULL; END $$;
