-- Add country column to companies table (safe to re-run)
-- This column is used for quick filtering and display.
-- Onboarding data is canonical in company_settings; this column is optional denormalisation.

ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS country TEXT;
