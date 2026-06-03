-- Database reconciliation proof support.
-- Idempotent: safe to re-run on live projects that already have these columns.

ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS posted_date DATE,
  ADD COLUMN IF NOT EXISTS fee_amount NUMERIC(14,2),
  ADD COLUMN IF NOT EXISTS running_balance NUMERIC(14,2);

COMMENT ON COLUMN public.transactions.posted_date IS
  'Provider posted/completed date when different from transaction date. Used for row lineage and statement reconciliation.';

COMMENT ON COLUMN public.transactions.fee_amount IS
  'Provider fee amount when supplied as a first-class CSV column. Original fee currency remains in metadata unless promoted later.';

COMMENT ON COLUMN public.transactions.running_balance IS
  'Statement running balance from the uploaded source row. Used to prove cash balance source rows.';

CREATE INDEX IF NOT EXISTS idx_transactions_upload_kpi
  ON public.transactions(company_id, upload_id, kpi_excluded);

CREATE INDEX IF NOT EXISTS idx_transactions_upload_provider
  ON public.transactions(company_id, upload_id, source_provider);
