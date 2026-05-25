-- ============================================================
-- 12. ONBOARDING COMPLETE SETUP
-- One-shot migration that ensures all tables and types needed
-- for onboarding exist, with the corrected enums.
-- Safe to run even if some objects already exist.
-- ============================================================

-- 1. Fix currency_code enum: ensure all needed values exist
DO $$ BEGIN
  CREATE TYPE currency_code AS ENUM ('USD', 'GBP', 'EUR', 'AUD', 'CAD', 'JPY', 'SGD');
EXCEPTION WHEN duplicate_object THEN
  -- Type exists — add missing values individually
  ALTER TYPE currency_code ADD VALUE IF NOT EXISTS 'JPY';
  ALTER TYPE currency_code ADD VALUE IF NOT EXISTS 'SGD';
END $$;

-- 2. Fix user_role enum: ensure all needed values exist
DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('owner', 'admin', 'member', 'viewer');
EXCEPTION WHEN duplicate_object THEN
  ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'owner';
  ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'admin';
  ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'member';
  ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'viewer';
END $$;

-- 3. Create profiles table if missing
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  phone TEXT,
  timezone TEXT DEFAULT 'UTC',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);

-- 4. Create companies table if missing
CREATE TABLE IF NOT EXISTS companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE,
  industry TEXT,
  currency currency_code NOT NULL DEFAULT 'USD',
  fiscal_year_start INT NOT NULL DEFAULT 1 CHECK (fiscal_year_start BETWEEN 1 AND 12),
  timezone TEXT NOT NULL DEFAULT 'UTC',
  country TEXT,
  tax_region TEXT,
  logo_url TEXT,
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_companies_slug ON companies(slug);

-- 5. Create company_members table if missing
CREATE TABLE IF NOT EXISTS company_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role user_role NOT NULL DEFAULT 'member',
  is_active BOOLEAN NOT NULL DEFAULT true,
  invited_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (company_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_company_members_user ON company_members(user_id);
CREATE INDEX IF NOT EXISTS idx_company_members_company ON company_members(company_id);

-- 6. Create company_settings table if missing
CREATE TABLE IF NOT EXISTS company_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  industry TEXT,
  business_stage TEXT,
  country TEXT,
  currency TEXT,
  fiscal_year_start TEXT,
  timezone TEXT,
  primary_goal TEXT,
  revenue_model TEXT,
  monthly_recurring_revenue NUMERIC,
  one_time_revenue NUMERIC,
  average_monthly_revenue NUMERIC,
  top_revenue_channels JSONB DEFAULT '[]',
  payment_tools JSONB DEFAULT '[]',
  average_monthly_expenses NUMERIC,
  biggest_cost_category TEXT,
  active_subscription_count INT,
  tools_used JSONB DEFAULT '[]',
  payroll_spend NUMERIC,
  advertising_spend NUMERIC,
  cloud_spend NUMERIC,
  agent_focus JSONB DEFAULT '[]',
  alert_sensitivity TEXT,
  weekly_digest_enabled BOOLEAN DEFAULT true,
  agent_autonomy_level TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (company_id)
);

CREATE INDEX IF NOT EXISTS idx_company_settings_company ON company_settings(company_id);

-- 7. Add onboarding columns if company_settings already existed
ALTER TABLE company_settings
  ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS onboarding_data JSONB DEFAULT '{}';

-- 8. Enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_settings ENABLE ROW LEVEL SECURITY;

-- 9. RLS policies for company_settings
DROP POLICY IF EXISTS "Members can view company settings" ON company_settings;
CREATE POLICY "Members can view company settings" ON company_settings
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM company_members cm
      WHERE cm.company_id = company_settings.company_id
        AND cm.user_id = auth.uid()
        AND cm.is_active = true
    )
  );

DROP POLICY IF EXISTS "Owners and admins can manage company settings" ON company_settings;
CREATE POLICY "Owners and admins can manage company_settings" ON company_settings
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM company_members cm
      WHERE cm.company_id = company_settings.company_id
        AND cm.user_id = auth.uid()
        AND cm.role IN ('owner', 'admin')
        AND cm.is_active = true
    )
  );

-- 10. RLS policies for profiles
DROP POLICY IF EXISTS "profiles_select" ON profiles;
CREATE POLICY "profiles_select" ON profiles
  FOR SELECT USING (id = auth.uid());

DROP POLICY IF EXISTS "profiles_update" ON profiles;
CREATE POLICY "profiles_update" ON profiles
  FOR UPDATE USING (id = auth.uid());

-- 11. RLS policies for companies
DROP POLICY IF EXISTS "companies_select" ON companies;
CREATE POLICY "companies_select" ON companies
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM company_members cm
      WHERE cm.company_id = companies.id
        AND cm.user_id = auth.uid()
        AND cm.is_active = true
    )
  );

-- 12. RLS policies for company_members
DROP POLICY IF EXISTS "company_members_select" ON company_members;
CREATE POLICY "company_members_select" ON company_members
  FOR SELECT USING (
    company_id = ANY(
      SELECT company_id FROM company_members WHERE user_id = auth.uid() AND is_active = true
    )
  );
