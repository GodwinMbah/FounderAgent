-- Open Banking connected data source foundation.
-- Idempotent: safe to re-run. Stores provider token references, not raw provider secrets.

CREATE TABLE IF NOT EXISTS public.connected_institutions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  provider_institution_id TEXT NOT NULL,
  institution_name TEXT NOT NULL,
  country_codes TEXT[] NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'connected',
  connected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  disconnected_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(company_id, provider, provider_institution_id)
);

CREATE TABLE IF NOT EXISTS public.provider_consents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  connected_institution_id UUID REFERENCES public.connected_institutions(id) ON DELETE SET NULL,
  provider TEXT NOT NULL,
  provider_item_id TEXT,
  provider_consent_id TEXT,
  token_reference TEXT,
  scopes TEXT[] NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'connected',
  consent_expires_at TIMESTAMPTZ,
  last_synced_at TIMESTAMPTZ,
  last_successful_sync_at TIMESTAMPTZ,
  reconnect_url TEXT,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.bank_accounts
  ADD COLUMN IF NOT EXISTS provider TEXT,
  ADD COLUMN IF NOT EXISTS provider_account_id TEXT,
  ADD COLUMN IF NOT EXISTS connected_institution_id UUID REFERENCES public.connected_institutions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS provider_consent_id UUID REFERENCES public.provider_consents(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS account_subtype TEXT,
  ADD COLUMN IF NOT EXISTS available_balance NUMERIC(14,2),
  ADD COLUMN IF NOT EXISTS credit_limit NUMERIC(14,2),
  ADD COLUMN IF NOT EXISTS connection_status TEXT NOT NULL DEFAULT 'connected',
  ADD COLUMN IF NOT EXISTS consent_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_successful_sync_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS sync_status TEXT,
  ADD COLUMN IF NOT EXISTS sync_error TEXT,
  ADD COLUMN IF NOT EXISTS kpi_routing JSONB NOT NULL DEFAULT '{}';

CREATE TABLE IF NOT EXISTS public.bank_account_balances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  bank_account_id UUID NOT NULL REFERENCES public.bank_accounts(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  provider_account_id TEXT NOT NULL,
  current_balance NUMERIC(14,2),
  available_balance NUMERIC(14,2),
  credit_limit NUMERIC(14,2),
  currency TEXT NOT NULL DEFAULT 'GBP',
  balance_as_of TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  raw_payload JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.open_banking_sync_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  provider_consent_id UUID REFERENCES public.provider_consents(id) ON DELETE SET NULL,
  connected_institution_id UUID REFERENCES public.connected_institutions(id) ON DELETE SET NULL,
  bank_account_id UUID REFERENCES public.bank_accounts(id) ON DELETE SET NULL,
  sync_type TEXT NOT NULL DEFAULT 'transactions',
  status TEXT NOT NULL DEFAULT 'queued',
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  cursor_before TEXT,
  cursor_after TEXT,
  accounts_synced INT NOT NULL DEFAULT 0,
  balances_synced INT NOT NULL DEFAULT 0,
  transactions_seen INT NOT NULL DEFAULT 0,
  transactions_inserted INT NOT NULL DEFAULT 0,
  duplicates_skipped INT NOT NULL DEFAULT 0,
  errors_count INT NOT NULL DEFAULT 0,
  error_message TEXT,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.open_banking_sync_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  sync_job_id UUID REFERENCES public.open_banking_sync_jobs(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  level TEXT NOT NULL DEFAULT 'info',
  event TEXT NOT NULL,
  message TEXT,
  provider_error_code TEXT,
  provider_error_type TEXT,
  raw_payload JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS source_connection_id UUID REFERENCES public.provider_consents(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS source_institution_id UUID REFERENCES public.connected_institutions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS source_sync_job_id UUID REFERENCES public.open_banking_sync_jobs(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS source_account_provider_id TEXT;

CREATE INDEX IF NOT EXISTS idx_connected_institutions_company
  ON public.connected_institutions(company_id, provider, status);

CREATE INDEX IF NOT EXISTS idx_provider_consents_company
  ON public.provider_consents(company_id, provider, status);

CREATE INDEX IF NOT EXISTS idx_bank_accounts_provider
  ON public.bank_accounts(company_id, provider, provider_account_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_bank_accounts_provider_unique
  ON public.bank_accounts(company_id, provider, provider_account_id)
  WHERE provider IS NOT NULL AND provider_account_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_bank_account_balances_account
  ON public.bank_account_balances(company_id, bank_account_id, balance_as_of DESC);

CREATE INDEX IF NOT EXISTS idx_open_banking_sync_jobs_company
  ON public.open_banking_sync_jobs(company_id, provider, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_open_banking_sync_logs_job
  ON public.open_banking_sync_logs(company_id, sync_job_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_transactions_open_banking_source
  ON public.transactions(company_id, source_provider, source_connection_id, source_account_provider_id);

COMMENT ON COLUMN public.provider_consents.token_reference IS
  'Reference to a server-side encrypted token vault location. Do not store raw provider access tokens here.';

COMMENT ON COLUMN public.bank_accounts.kpi_routing IS
  'Account-to-KPI routing flags for connected account treatment, e.g. cash balance source, debt tracking, P&L inclusion.';

COMMENT ON COLUMN public.transactions.source_connection_id IS
  'Open Banking provider consent that produced this transaction, when applicable.';

ALTER TABLE public.connected_institutions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.provider_consents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bank_account_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.open_banking_sync_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.open_banking_sync_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "connected_institutions_select" ON public.connected_institutions;
CREATE POLICY "connected_institutions_select" ON public.connected_institutions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.company_members cm
      WHERE cm.company_id = connected_institutions.company_id
        AND cm.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "connected_institutions_write" ON public.connected_institutions;
CREATE POLICY "connected_institutions_write" ON public.connected_institutions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.company_members cm
      WHERE cm.company_id = connected_institutions.company_id
        AND cm.user_id = auth.uid()
        AND cm.role IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.company_members cm
      WHERE cm.company_id = connected_institutions.company_id
        AND cm.user_id = auth.uid()
        AND cm.role IN ('owner', 'admin')
    )
  );

DROP POLICY IF EXISTS "provider_consents_select" ON public.provider_consents;
CREATE POLICY "provider_consents_select" ON public.provider_consents
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.company_members cm
      WHERE cm.company_id = provider_consents.company_id
        AND cm.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "provider_consents_write" ON public.provider_consents;
CREATE POLICY "provider_consents_write" ON public.provider_consents
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.company_members cm
      WHERE cm.company_id = provider_consents.company_id
        AND cm.user_id = auth.uid()
        AND cm.role IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.company_members cm
      WHERE cm.company_id = provider_consents.company_id
        AND cm.user_id = auth.uid()
        AND cm.role IN ('owner', 'admin')
    )
  );

DROP POLICY IF EXISTS "bank_account_balances_select" ON public.bank_account_balances;
CREATE POLICY "bank_account_balances_select" ON public.bank_account_balances
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.company_members cm
      WHERE cm.company_id = bank_account_balances.company_id
        AND cm.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "bank_account_balances_write" ON public.bank_account_balances;
CREATE POLICY "bank_account_balances_write" ON public.bank_account_balances
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.company_members cm
      WHERE cm.company_id = bank_account_balances.company_id
        AND cm.user_id = auth.uid()
        AND cm.role IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.company_members cm
      WHERE cm.company_id = bank_account_balances.company_id
        AND cm.user_id = auth.uid()
        AND cm.role IN ('owner', 'admin')
    )
  );

DROP POLICY IF EXISTS "open_banking_sync_jobs_select" ON public.open_banking_sync_jobs;
CREATE POLICY "open_banking_sync_jobs_select" ON public.open_banking_sync_jobs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.company_members cm
      WHERE cm.company_id = open_banking_sync_jobs.company_id
        AND cm.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "open_banking_sync_jobs_write" ON public.open_banking_sync_jobs;
CREATE POLICY "open_banking_sync_jobs_write" ON public.open_banking_sync_jobs
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.company_members cm
      WHERE cm.company_id = open_banking_sync_jobs.company_id
        AND cm.user_id = auth.uid()
        AND cm.role IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.company_members cm
      WHERE cm.company_id = open_banking_sync_jobs.company_id
        AND cm.user_id = auth.uid()
        AND cm.role IN ('owner', 'admin')
    )
  );

DROP POLICY IF EXISTS "open_banking_sync_logs_select" ON public.open_banking_sync_logs;
CREATE POLICY "open_banking_sync_logs_select" ON public.open_banking_sync_logs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.company_members cm
      WHERE cm.company_id = open_banking_sync_logs.company_id
        AND cm.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "open_banking_sync_logs_write" ON public.open_banking_sync_logs;
CREATE POLICY "open_banking_sync_logs_write" ON public.open_banking_sync_logs
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.company_members cm
      WHERE cm.company_id = open_banking_sync_logs.company_id
        AND cm.user_id = auth.uid()
        AND cm.role IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.company_members cm
      WHERE cm.company_id = open_banking_sync_logs.company_id
        AND cm.user_id = auth.uid()
        AND cm.role IN ('owner', 'admin')
    )
  );

