-- Rollback for Migration 019
-- Removes columns added in 019

ALTER TABLE company_metrics
  DROP COLUMN IF EXISTS metadata;

ALTER TABLE company_metrics
  DROP COLUMN IF EXISTS created_at;

ALTER TABLE alerts
  DROP COLUMN IF EXISTS status;

DROP INDEX IF EXISTS idx_alerts_status;
DROP INDEX IF EXISTS idx_company_metrics_created_at;
