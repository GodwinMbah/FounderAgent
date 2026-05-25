-- ============================================================
-- 16. ENSURE MISSING TABLES AND COLUMNS
-- Fixes schema drift where migrations 007 and 008 were not
-- applied to the remote database.
-- Safe to re-run; uses IF NOT EXISTS throughout.
-- ============================================================

-- 1. Ensure csv_mapping_profiles table exists
CREATE TABLE IF NOT EXISTS csv_mapping_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  source_type TEXT NOT NULL DEFAULT 'manual_csv',
  profile_name TEXT NOT NULL,
  column_mappings JSONB NOT NULL DEFAULT '{}',
  date_format TEXT,
  currency TEXT,
  delimiter TEXT DEFAULT ',',
  is_default BOOLEAN DEFAULT false,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (company_id, source_type, profile_name)
);

CREATE INDEX IF NOT EXISTS idx_csv_mapping_profiles_company ON csv_mapping_profiles(company_id);
CREATE INDEX IF NOT EXISTS idx_csv_mapping_profiles_source ON csv_mapping_profiles(company_id, source_type);

ALTER TABLE csv_mapping_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members can view mapping profiles" ON csv_mapping_profiles;
CREATE POLICY "Members can view mapping profiles" ON csv_mapping_profiles
  FOR ALL USING (company_id = ANY(get_user_company_ids(auth.uid())));

-- 2. Ensure upload_sessions table exists
CREATE TABLE IF NOT EXISTS upload_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  file_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  mime_type TEXT,
  parsed_preview_json JSONB DEFAULT '{}',
  mapping_overrides_json JSONB DEFAULT '{}',
  expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '30 minutes',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_upload_sessions_company ON upload_sessions(company_id);
CREATE INDEX IF NOT EXISTS idx_upload_sessions_expires ON upload_sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_upload_sessions_user ON upload_sessions(user_id);

ALTER TABLE upload_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "upload_sessions_select" ON upload_sessions;
CREATE POLICY "upload_sessions_select" ON upload_sessions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM company_members cm
      WHERE cm.company_id = upload_sessions.company_id
        AND cm.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "upload_sessions_insert" ON upload_sessions;
CREATE POLICY "upload_sessions_insert" ON upload_sessions
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM company_members cm
      WHERE cm.company_id = upload_sessions.company_id
        AND cm.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "upload_sessions_update" ON upload_sessions;
CREATE POLICY "upload_sessions_update" ON upload_sessions
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM company_members cm
      WHERE cm.company_id = upload_sessions.company_id
        AND cm.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "upload_sessions_delete" ON upload_sessions;
CREATE POLICY "upload_sessions_delete" ON upload_sessions
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM company_members cm
      WHERE cm.company_id = upload_sessions.company_id
        AND cm.user_id = auth.uid()
    )
  );

-- 3. Ensure uploads pipeline columns exist (from migration 008)
ALTER TABLE uploads
  ADD COLUMN IF NOT EXISTS total_rows INT,
  ADD COLUMN IF NOT EXISTS processed_rows INT,
  ADD COLUMN IF NOT EXISTS failed_rows INT,
  ADD COLUMN IF NOT EXISTS pipeline_stage TEXT,
  ADD COLUMN IF NOT EXISTS pipeline_progress INT CHECK (pipeline_progress BETWEEN 0 AND 100),
  ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_uploads_pipeline_stage ON uploads(pipeline_stage) WHERE pipeline_stage IS NOT NULL;
