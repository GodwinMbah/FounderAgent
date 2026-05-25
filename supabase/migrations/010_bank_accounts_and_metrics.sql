-- Bank accounts and cached company metrics
-- Fixes cash balance, runway, and date-filtered reporting

-- 1. Bank accounts (per company, per institution)
CREATE TABLE IF NOT EXISTS bank_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'bank',
  currency TEXT NOT NULL DEFAULT 'GBP',
  current_balance NUMERIC(14,2) NOT NULL DEFAULT 0,
  last_statement_date DATE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bank_accounts_company ON bank_accounts(company_id);
CREATE INDEX IF NOT EXISTS idx_bank_accounts_active ON bank_accounts(company_id, is_active);

-- 2. Link transactions to bank accounts
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS bank_account_id UUID REFERENCES bank_accounts(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_transactions_bank_account ON transactions(bank_account_id);

-- 3. Cached company metrics (updated by pipeline after each upload)
CREATE TABLE IF NOT EXISTS company_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  metric_date DATE NOT NULL DEFAULT CURRENT_DATE,
  period_type TEXT NOT NULL DEFAULT 'monthly',

  -- Financials
  total_revenue NUMERIC(14,2) NOT NULL DEFAULT 0,
  total_expenses NUMERIC(14,2) NOT NULL DEFAULT 0,
  net_profit NUMERIC(14,2) NOT NULL DEFAULT 0,
  cash_balance NUMERIC(14,2) NOT NULL DEFAULT 0,
  monthly_burn NUMERIC(14,2) NOT NULL DEFAULT 0,
  runway_months NUMERIC(8,2) NOT NULL DEFAULT 0,

  -- Counts
  transaction_count INT NOT NULL DEFAULT 0,
  uncategorized_count INT NOT NULL DEFAULT 0,
  active_subscription_count INT NOT NULL DEFAULT 0,
  monthly_subscription_spend NUMERIC(14,2) NOT NULL DEFAULT 0,
  flagged_subscriptions INT NOT NULL DEFAULT 0,

  -- Health
  health_score INT NOT NULL DEFAULT 75,
  profit_margin NUMERIC(6,2) NOT NULL DEFAULT 0,

  -- Metadata
  calculated_from DATE,
  calculated_to DATE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (company_id, metric_date, period_type)
);

CREATE INDEX IF NOT EXISTS idx_company_metrics_company ON company_metrics(company_id);
CREATE INDEX IF NOT EXISTS idx_company_metrics_date ON company_metrics(company_id, metric_date);

-- 4. RLS policies
ALTER TABLE bank_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bank_accounts_select" ON bank_accounts
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM company_members cm
      WHERE cm.company_id = bank_accounts.company_id
        AND cm.user_id = auth.uid()
    )
  );

CREATE POLICY "bank_accounts_insert" ON bank_accounts
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM company_members cm
      WHERE cm.company_id = bank_accounts.company_id
        AND cm.user_id = auth.uid()
        AND cm.role IN ('owner', 'admin')
    )
  );

CREATE POLICY "bank_accounts_update" ON bank_accounts
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM company_members cm
      WHERE cm.company_id = bank_accounts.company_id
        AND cm.user_id = auth.uid()
        AND cm.role IN ('owner', 'admin')
    )
  );

CREATE POLICY "company_metrics_select" ON company_metrics
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM company_members cm
      WHERE cm.company_id = company_metrics.company_id
        AND cm.user_id = auth.uid()
    )
  );
