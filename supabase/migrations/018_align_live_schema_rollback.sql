-- Rollback: 018_align_live_schema
-- Reverses column additions and index creations from migration 018.
-- WARNING: PostgreSQL does NOT support removing values from an enum type.
--          The 'currency', 'anomaly', and 'duplicate' values added to
--          alert_category cannot be rolled back without recreating the
--          type (which would require dropping every column that uses it).
--          If you truly need to remove them, create a new enum, migrate
--          columns, and drop the old enum in a manual maintenance window.

-- ============================================================
-- 1. DROP INDEXES
-- ============================================================

DROP INDEX IF EXISTS idx_transactions_currency;
DROP INDEX IF EXISTS idx_transactions_reference;
DROP INDEX IF EXISTS idx_transactions_external_id;
DROP INDEX IF EXISTS idx_transactions_source_provider;
DROP INDEX IF EXISTS idx_uploads_provider;

-- ============================================================
-- 2. DROP COLUMNS
-- ============================================================
-- CASCADE is included to remove any dependent objects (e.g. views,
-- triggers) that may have been created on top of these columns.

ALTER TABLE transactions
  DROP COLUMN IF EXISTS currency CASCADE,
  DROP COLUMN IF EXISTS reference CASCADE,
  DROP COLUMN IF EXISTS external_transaction_id CASCADE,
  DROP COLUMN IF EXISTS source_provider CASCADE;

ALTER TABLE uploads
  DROP COLUMN IF EXISTS provider_detected CASCADE,
  DROP COLUMN IF EXISTS provider_confidence CASCADE;
