-- ============================================================
-- 7. CSV MAPPING PROFILES TABLE
-- Stores saved column mappings per company and source type
-- ============================================================

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

-- Indexes
CREATE INDEX IF NOT EXISTS idx_csv_mapping_profiles_company ON csv_mapping_profiles(company_id);
CREATE INDEX IF NOT EXISTS idx_csv_mapping_profiles_source ON csv_mapping_profiles(company_id, source_type);

-- Updated at trigger
DROP TRIGGER IF EXISTS tr_csv_mapping_profiles_updated_at ON csv_mapping_profiles;
CREATE TRIGGER tr_csv_mapping_profiles_updated_at
  BEFORE UPDATE ON csv_mapping_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS
ALTER TABLE csv_mapping_profiles ENABLE ROW LEVEL SECURITY;

-- Members can view their company's mapping profiles
DROP POLICY IF EXISTS "Members can view mapping profiles" ON csv_mapping_profiles;
CREATE POLICY "Members can view mapping profiles" ON csv_mapping_profiles
  FOR ALL USING (company_id = ANY(get_user_company_ids(auth.uid())));
