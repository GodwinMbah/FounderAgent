-- Add revolut_business_csv to upload_source enum
-- Safe to re-run; will skip if value already exists

DO $$ BEGIN
  ALTER TYPE upload_source ADD VALUE IF NOT EXISTS 'revolut_business_csv';
EXCEPTION WHEN duplicate_object THEN
  -- Value already exists, ignore
  NULL;
END $$;
