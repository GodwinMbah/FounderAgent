-- Migration 019: Add remaining genuinely missing columns
-- Applied after user confirmed Migration 018 success
-- Idempotent — safe to re-run

-- ============================================
-- company_metrics: add metadata and created_at
-- ============================================
ALTER TABLE company_metrics
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';

ALTER TABLE company_metrics
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- ============================================
-- alerts: add status (computed from is_dismissed in UI, but useful for querying)
-- ============================================
ALTER TABLE alerts
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'open';

-- Backfill existing alerts: dismissed ones become 'resolved'
UPDATE alerts
  SET status = 'resolved'
  WHERE is_dismissed = true AND status = 'open';

-- ============================================
-- Indexes for new columns
-- ============================================
CREATE INDEX IF NOT EXISTS idx_alerts_status
  ON alerts(company_id, status);

CREATE INDEX IF NOT EXISTS idx_company_metrics_created_at
  ON company_metrics(company_id, created_at DESC);
