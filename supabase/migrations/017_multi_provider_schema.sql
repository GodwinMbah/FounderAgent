-- Migration: Multi-provider schema extensions
-- Safe to re-run; uses IF NOT EXISTS throughout

-- 1. Extend upload_source enum with new providers
DO $$
DECLARE
  val TEXT;
  vals TEXT[] := ARRAY[
    'tide',
    'monzo',
    'starling',
    'wise',
    'barclays',
    'hsbc',
    'lloyds',
    'natwest',
    'chase',
    'square',
    'gocardless',
    'shopify_payouts'
  ];
BEGIN
  FOREACH val IN ARRAY vals
  LOOP
    IF NOT EXISTS (
      SELECT 1
      FROM pg_type t
      JOIN pg_enum e ON t.oid = e.enumtypid
      WHERE t.typname = 'upload_source'
        AND e.enumlabel = val
    ) THEN
      ALTER TYPE upload_source ADD VALUE val;
    END IF;
  END LOOP;
END $$;

-- 2. Add provider detection metadata to uploads
ALTER TABLE uploads
  ADD COLUMN IF NOT EXISTS provider_detected TEXT,
  ADD COLUMN IF NOT EXISTS provider_confidence INT CHECK (provider_confidence BETWEEN 0 AND 100);

-- 3. Add enriched transaction fields for multi-provider ingestion
ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS external_transaction_id TEXT,
  ADD COLUMN IF NOT EXISTS posted_date DATE,
  ADD COLUMN IF NOT EXISTS fee_amount NUMERIC(14,2),
  ADD COLUMN IF NOT EXISTS running_balance NUMERIC(14,2),
  ADD COLUMN IF NOT EXISTS source_provider TEXT;

-- 4. Add indexes for lookup performance
CREATE INDEX IF NOT EXISTS idx_transactions_external_id
  ON transactions(company_id, external_transaction_id);

CREATE INDEX IF NOT EXISTS idx_transactions_source_provider
  ON transactions(company_id, source_provider);

CREATE INDEX IF NOT EXISTS idx_uploads_provider
  ON uploads(company_id, provider_detected);
