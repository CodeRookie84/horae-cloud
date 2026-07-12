-- Training feature: client-admin uploads a document, an AI-drafted (admin-reviewed)
-- test is attached, targeted to outlets/departments/roles, and staff take it.
-- Run in the Supabase SQL Editor / CLI after 20260713_clit_sop_and_history.sql.

-- 1. Trainings (one per uploaded course).
CREATE TABLE IF NOT EXISTS trainings (
  id             TEXT PRIMARY KEY,
  client_id      TEXT NOT NULL,
  tenant_id      TEXT NOT NULL,                     -- creator's outlet (reference)
  title          TEXT NOT NULL,
  description    TEXT NOT NULL DEFAULT '',
  doc_url        TEXT DEFAULT '',
  doc_name       TEXT DEFAULT '',
  doc_type       TEXT DEFAULT '',                    -- mime type
  source_notes   TEXT DEFAULT '',                    -- optional notes for AI generation
  outlets        JSONB NOT NULL DEFAULT '[]'::jsonb, -- array of tenant ids; [] = all client outlets
  department     TEXT NOT NULL DEFAULT 'All Departments',
  role           TEXT NOT NULL DEFAULT 'All Roles',
  pass_pct       INT NOT NULL DEFAULT 70,
  allow_retest   BOOLEAN NOT NULL DEFAULT true,
  max_attempts   INT NOT NULL DEFAULT 3,             -- 0 = unlimited
  shuffle        BOOLEAN NOT NULL DEFAULT true,
  due_date       DATE,
  questions      JSONB NOT NULL DEFAULT '[]'::jsonb, -- [{id,question,options[],correctIndex}]
  retest_grants  JSONB NOT NULL DEFAULT '[]'::jsonb, -- userIds granted one extra attempt
  published      BOOLEAN NOT NULL DEFAULT false,
  created_by     TEXT DEFAULT '',
  created_by_name TEXT DEFAULT '',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_trainings_client ON trainings(client_id);

-- 2. Attempts (one row per submission; retakes add rows).
CREATE TABLE IF NOT EXISTS training_attempts (
  id             TEXT PRIMARY KEY,
  training_id    TEXT NOT NULL,
  training_title TEXT NOT NULL DEFAULT '',
  user_id        TEXT NOT NULL,
  user_name      TEXT NOT NULL DEFAULT '',
  user_role      TEXT NOT NULL DEFAULT '',
  department     TEXT NOT NULL DEFAULT '',
  tenant_id      TEXT NOT NULL DEFAULT '',
  score          INT NOT NULL DEFAULT 0,
  total          INT NOT NULL DEFAULT 0,
  pct            INT NOT NULL DEFAULT 0,
  passed         BOOLEAN NOT NULL DEFAULT false,
  answers        JSONB NOT NULL DEFAULT '[]'::jsonb,
  attempt_no     INT NOT NULL DEFAULT 1,
  submitted_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_training_attempts_training ON training_attempts(training_id);
CREATE INDEX IF NOT EXISTS idx_training_attempts_user ON training_attempts(user_id);

-- RLS — permissive, matching the rest of Horae (visibility enforced in-app).
ALTER TABLE trainings          ENABLE ROW LEVEL SECURITY;
ALTER TABLE training_attempts  ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all trainings"         ON trainings         FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all training_attempts" ON training_attempts FOR ALL USING (true) WITH CHECK (true);

DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE trainings;         EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE training_attempts; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 3. Storage bucket for the uploaded documents (public read, like chat-images).
INSERT INTO storage.buckets (id, name, public) VALUES ('training-docs', 'training-docs', true)
  ON CONFLICT (id) DO NOTHING;
DO $$ BEGIN
  CREATE POLICY "training-docs read"  ON storage.objects FOR SELECT USING (bucket_id = 'training-docs');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "training-docs write" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'training-docs');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
