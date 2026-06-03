-- Data trust recovery: make every imported CSV row queryable from DB columns.
-- Safe to re-run; adds lineage, row outcome, and KPI inclusion/exclusion proof.

ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS source_row_number INTEGER,
  ADD COLUMN IF NOT EXISTS raw_row_hash TEXT,
  ADD COLUMN IF NOT EXISTS row_status TEXT,
  ADD COLUMN IF NOT EXISTS kpi_excluded BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS kpi_exclusion_reason TEXT,
  ADD COLUMN IF NOT EXISTS duplicate_of_transaction_id UUID REFERENCES public.transactions(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.transactions.source_row_number IS
  '1-based source row number from the uploaded CSV, including header offset. Used to trace CSV row -> DB transaction.';

COMMENT ON COLUMN public.transactions.raw_row_hash IS
  'Stable non-cryptographic hash of the raw provider row for lineage and duplicate proof.';

COMMENT ON COLUMN public.transactions.row_status IS
  'Import row outcome such as valid, imported, transfer, duplicate_skipped, failed, or needs_review.';

COMMENT ON COLUMN public.transactions.kpi_excluded IS
  'True when this transaction is intentionally excluded from KPI/reporting calculations.';

COMMENT ON COLUMN public.transactions.kpi_exclusion_reason IS
  'Reason for KPI exclusion, for example transfer, duplicate, failed, or refunded.';

CREATE INDEX IF NOT EXISTS idx_transactions_upload_row
  ON public.transactions(company_id, upload_id, source_row_number);

CREATE INDEX IF NOT EXISTS idx_transactions_raw_row_hash
  ON public.transactions(company_id, raw_row_hash);

CREATE INDEX IF NOT EXISTS idx_transactions_row_status
  ON public.transactions(company_id, row_status);

CREATE INDEX IF NOT EXISTS idx_transactions_kpi_excluded
  ON public.transactions(company_id, kpi_excluded);
