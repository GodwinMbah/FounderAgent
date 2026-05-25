-- Fix onboarding-critical enums and add missing values
-- Root causes: currency_code missing JPY/SGD, user_role missing 'owner'

-- 1. Fix currency_code enum: add JPY and SGD
DO $$ BEGIN
  ALTER TYPE currency_code ADD VALUE IF NOT EXISTS 'JPY';
  ALTER TYPE currency_code ADD VALUE IF NOT EXISTS 'SGD';
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- 2. Fix user_role enum: ensure 'owner' exists
-- Migration 001 created ('founder','accountist','admin') which blocks 003's attempt.
-- We cannot ALTER TYPE to rename values easily, but we can add missing ones.
-- The app uses 'owner' extensively. Add it if missing.
DO $$ BEGIN
  ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'owner';
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'member';
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'viewer';
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- 3. Add onboarding_completed_at to company_settings for tracking
ALTER TABLE company_settings
  ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS onboarding_data JSONB DEFAULT '{}';

-- 4. Add country to companies table (optional, for quick filtering)
ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS country TEXT;

-- 5. Ensure companies.slug has a helpful index for collision checks
CREATE INDEX IF NOT EXISTS idx_companies_slug ON companies(slug);
