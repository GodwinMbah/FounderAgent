-- Migration: Align live schema with application requirements
-- Purpose: Add filtering/indexing columns and expand alert_category enum
-- Safe to re-run; uses IF NOT EXISTS throughout
-- Note: Migration 017 was never applied to the live instance, so this
--       migration covers all required columns idempotently.

-- ============================================================
-- 1. TRANSACTIONS — Add enriched columns for filtering & Plaid
-- ============================================================

ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS currency TEXT,
  ADD COLUMN IF NOT EXISTS reference TEXT,
  ADD COLUMN IF NOT EXISTS external_transaction_id TEXT,
  ADD COLUMN IF NOT EXISTS source_provider TEXT;

COMMENT ON COLUMN transactions.currency IS
  'ISO-4217 currency code (e.g. USD, GBP). Promoted to real column for filtering, indexing, and future Plaid sync.';

COMMENT ON COLUMN transactions.reference IS
  'Bank or provider reference number. Promoted to real column for search, duplicate detection, and Plaid matching.';

COMMENT ON COLUMN transactions.external_transaction_id IS
  'Immutable ID from the source provider (e.g. Plaid transaction_id). Used for deduplication and idempotent sync.';

COMMENT ON COLUMN transactions.source_provider IS
  'Name of the provider that supplied this transaction (e.g. plaid, stripe, revolut). Used for filtering and analytics.';

-- ============================================================
-- 2. UPLOADS — Add provider detection columns
-- ============================================================

ALTER TABLE uploads
  ADD COLUMN IF NOT EXISTS provider_detected TEXT,
  ADD COLUMN IF NOT EXISTS provider_confidence INTEGER
    CHECK (provider_confidence BETWEEN 0 AND 100);

COMMENT ON COLUMN uploads.provider_detected IS
  'Auto-detected provider from file content or filename (e.g. hsbc, chase). Used for routing and analytics.';

COMMENT ON COLUMN uploads.provider_confidence IS
  'Confidence score (0-100) of the provider detection algorithm.';

-- ============================================================
-- 3. ALERT CATEGORY — Expand enum with new values
-- ============================================================
-- PostgreSQL does not support IF NOT EXISTS on ADD VALUE, so we
-- guard each addition with a catalog lookup.

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum
        WHERE enumlabel = 'currency'
          AND enumtypid = 'alert_category'::regtype
    ) THEN
        ALTER TYPE alert_category ADD VALUE 'currency';
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum
        WHERE enumlabel = 'anomaly'
          AND enumtypid = 'alert_category'::regtype
    ) THEN
        ALTER TYPE alert_category ADD VALUE 'anomaly';
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum
        WHERE enumlabel = 'duplicate'
          AND enumtypid = 'alert_category'::regtype
    ) THEN
        ALTER TYPE alert_category ADD VALUE 'duplicate';
    END IF;
END $$;

-- ============================================================
-- 4. INDEXES — Composite indexes scoped by company_id
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_transactions_currency
  ON transactions(company_id, currency);

CREATE INDEX IF NOT EXISTS idx_transactions_reference
  ON transactions(company_id, reference);

CREATE INDEX IF NOT EXISTS idx_transactions_external_id
  ON transactions(company_id, external_transaction_id);

CREATE INDEX IF NOT EXISTS idx_transactions_source_provider
  ON transactions(company_id, source_provider);

CREATE INDEX IF NOT EXISTS idx_uploads_provider
  ON uploads(company_id, provider_detected);
