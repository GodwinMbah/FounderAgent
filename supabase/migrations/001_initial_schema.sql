-- FounderAgent Initial Schema Migration
-- Creates all enums, tables, indexes, triggers, and RLS policies
-- Run this in your Supabase SQL Editor

-- ============================================================
-- 1. CUSTOM ENUMS
-- ============================================================

CREATE TYPE user_role AS ENUM ('founder', 'accountant', 'admin');
CREATE TYPE currency_code AS ENUM ('USD', 'GBP', 'EUR', 'AUD', 'CAD');
CREATE TYPE account_type AS ENUM ('bank', 'credit_card', 'paypal', 'stripe', 'manual');
CREATE TYPE upload_source AS ENUM ('bank_statement_csv', 'bank_statement_pdf', 'stripe', 'paypal', 'quickbooks', 'xero', 'manual_csv');
CREATE TYPE upload_status AS ENUM ('pending', 'processing', 'completed', 'failed');
CREATE TYPE transaction_type AS ENUM ('income', 'expense');
CREATE TYPE transaction_status AS ENUM ('Categorised', 'Needs Review', 'Possible Subscription', 'Possible Duplicate', 'Unusual Spend', 'AI Suggested', 'User Confirmed');
CREATE TYPE duplicate_check_status AS ENUM ('checked', 'unchecked', 'possible_duplicate');
CREATE TYPE subscription_status AS ENUM ('active', 'canceled', 'paused', 'expired');
CREATE TYPE billing_cycle AS ENUM ('monthly', 'quarterly', 'yearly');
CREATE TYPE health_status AS ENUM ('strong', 'healthy', 'watch', 'risk');
CREATE TYPE insight_type AS ENUM (
  'revenue_increased_profit_dropped',
  'subscription_increase',
  'ad_spend_growth',
  'payroll_stable',
  'contractor_increase',
  'duplicate_subscription',
  'cash_runway_improved',
  'refunds_increase',
  'expense_spike',
  'cost_saving_opportunity',
  'runway_risk',
  'burn_increase',
  'margin_drop',
  'subscription_renewal',
  'unusual_transaction',
  'growth_opportunity',
  'cash_flow_warning',
  'trend_alert'
);
CREATE TYPE insight_priority AS ENUM ('critical', 'warning', 'opportunity', 'info');
CREATE TYPE condition_field AS ENUM ('merchant', 'description', 'amount_range');
CREATE TYPE condition_operator AS ENUM ('contains', 'equals', 'starts_with', 'between');

-- ============================================================
-- 2. TABLES
-- ============================================================

-- 2.1 users — linked to auth.users
CREATE TABLE users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  name TEXT,
  role user_role NOT NULL DEFAULT 'founder',
  business_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2.2 businesses — core multi-tenant entity
CREATE TABLE businesses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  industry TEXT,
  currency currency_code NOT NULL DEFAULT 'USD',
  fiscal_year_start INT NOT NULL DEFAULT 1 CHECK (fiscal_year_start BETWEEN 1 AND 12),
  timezone TEXT NOT NULL DEFAULT 'UTC',
  tax_region TEXT,
  owner_id UUID REFERENCES users(id) ON DELETE SET NULL,
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add FK from users to businesses (after businesses exists)
ALTER TABLE users ADD CONSTRAINT fk_users_business
  FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE SET NULL;

-- 2.3 financial_accounts
CREATE TABLE financial_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type account_type NOT NULL DEFAULT 'bank',
  account_number TEXT,
  currency TEXT NOT NULL DEFAULT 'USD',
  is_active BOOLEAN NOT NULL DEFAULT true,
  balance NUMERIC(14,2),
  last_synced_at TIMESTAMPTZ,
  api_key_encrypted TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2.4 transaction_categories
CREATE TABLE transaction_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT,
  color TEXT,
  is_system_defined BOOLEAN NOT NULL DEFAULT false,
  parent_id UUID REFERENCES transaction_categories(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2.5 uploaded_statements
CREATE TABLE uploaded_statements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  account_id UUID REFERENCES financial_accounts(id) ON DELETE SET NULL,
  file_name TEXT NOT NULL,
  source upload_source NOT NULL DEFAULT 'manual_csv',
  status upload_status NOT NULL DEFAULT 'pending',
  file_size INT NOT NULL DEFAULT 0,
  file_path TEXT,
  transaction_count INT,
  error_message TEXT,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ
);

-- 2.6 transactions
CREATE TABLE transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  account_id UUID REFERENCES financial_accounts(id) ON DELETE SET NULL,
  date DATE NOT NULL,
  merchant TEXT,
  description TEXT NOT NULL DEFAULT '',
  category_id UUID REFERENCES transaction_categories(id) ON DELETE SET NULL,
  category TEXT,
  amount NUMERIC(14,2) NOT NULL,
  type transaction_type NOT NULL,
  status transaction_status NOT NULL DEFAULT 'Needs Review',
  confidence_score INT CHECK (confidence_score BETWEEN 0 AND 100),
  tags TEXT[] DEFAULT '{}',
  notes TEXT,
  duplicate_check_status duplicate_check_status NOT NULL DEFAULT 'unchecked',
  subscription_id UUID,
  uploaded_statement_id UUID REFERENCES uploaded_statements(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2.7 subscriptions
CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  vendor TEXT,
  category TEXT,
  amount NUMERIC(14,2) NOT NULL,
  billing_cycle billing_cycle NOT NULL DEFAULT 'monthly',
  next_billing_date DATE NOT NULL,
  status subscription_status NOT NULL DEFAULT 'active',
  start_date DATE NOT NULL,
  end_date DATE,
  notes TEXT,
  is_flagged BOOLEAN NOT NULL DEFAULT false,
  flag_reason TEXT,
  transaction_links UUID[] DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add FK from transactions to subscriptions
ALTER TABLE transactions ADD CONSTRAINT fk_transactions_subscription
  FOREIGN KEY (subscription_id) REFERENCES subscriptions(id) ON DELETE SET NULL;

-- 2.8 monthly_p_and_l_reports
CREATE TABLE monthly_p_and_l_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  month DATE NOT NULL,
  revenue NUMERIC(14,2) NOT NULL DEFAULT 0,
  cost_of_sales NUMERIC(14,2) NOT NULL DEFAULT 0,
  gross_profit NUMERIC(14,2) NOT NULL DEFAULT 0,
  gross_margin NUMERIC(5,2) NOT NULL DEFAULT 0,
  operating_expenses NUMERIC(14,2) NOT NULL DEFAULT 0,
  net_profit NUMERIC(14,2) NOT NULL DEFAULT 0,
  profit_margin NUMERIC(5,2) NOT NULL DEFAULT 0,
  category_breakdown JSONB DEFAULT '[]',
  top_cost_drivers JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (business_id, month)
);

-- 2.9 cash_flow_summaries
CREATE TABLE cash_flow_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  month DATE NOT NULL,
  opening_balance NUMERIC(14,2) NOT NULL DEFAULT 0,
  operating_cash_flow NUMERIC(14,2) NOT NULL DEFAULT 0,
  investing_cash_flow NUMERIC(14,2) NOT NULL DEFAULT 0,
  financing_cash_flow NUMERIC(14,2) NOT NULL DEFAULT 0,
  closing_balance NUMERIC(14,2) NOT NULL DEFAULT 0,
  details JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (business_id, month)
);

-- 2.10 ai_insights
CREATE TABLE ai_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  type insight_type NOT NULL,
  priority insight_priority NOT NULL DEFAULT 'info',
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  data JSONB,
  recommended_action TEXT,
  action_url TEXT,
  related_transactions UUID[] DEFAULT '{}',
  related_subscriptions UUID[] DEFAULT '{}',
  date_range_start DATE,
  date_range_end DATE,
  is_read BOOLEAN NOT NULL DEFAULT false,
  is_dismissed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2.11 financial_health_scores
CREATE TABLE financial_health_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  score INT NOT NULL CHECK (score BETWEEN 0 AND 100),
  status health_status NOT NULL,
  cash_runway_score INT NOT NULL CHECK (cash_runway_score BETWEEN 0 AND 100),
  cash_runway_status health_status NOT NULL,
  cash_runway_days INT,
  revenue_growth_score INT NOT NULL CHECK (revenue_growth_score BETWEEN 0 AND 100),
  revenue_growth_status health_status NOT NULL,
  revenue_growth_rate NUMERIC(6,2),
  expense_control_score INT NOT NULL CHECK (expense_control_score BETWEEN 0 AND 100),
  expense_control_status health_status NOT NULL,
  expense_growth_rate NUMERIC(6,2),
  subscription_health_score INT NOT NULL CHECK (subscription_health_score BETWEEN 0 AND 100),
  subscription_health_status health_status NOT NULL,
  subscription_monthly_spend NUMERIC(14,2),
  factors TEXT[] DEFAULT '{}',
  recommendations TEXT[] DEFAULT '{}',
  calculated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2.12 categorisation_rules
CREATE TABLE categorisation_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  condition_field condition_field NOT NULL,
  condition_operator condition_operator NOT NULL,
  condition_value JSONB NOT NULL,
  condition_case_sensitive BOOLEAN NOT NULL DEFAULT false,
  suggested_category TEXT NOT NULL,
  priority INT NOT NULL DEFAULT 0,
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2.13 audit_logs
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id TEXT NOT NULL,
  changes JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 3. INDEXES
-- ============================================================

-- users
CREATE INDEX idx_users_business_id ON users(business_id);
CREATE INDEX idx_users_email ON users(email);

-- businesses
CREATE INDEX idx_businesses_owner_id ON businesses(owner_id);
CREATE INDEX idx_businesses_created_at ON businesses(created_at);

-- financial_accounts
CREATE INDEX idx_financial_accounts_business_id ON financial_accounts(business_id);
CREATE INDEX idx_financial_accounts_is_active ON financial_accounts(is_active);

-- transaction_categories
CREATE INDEX idx_transaction_categories_business_id ON transaction_categories(business_id);
CREATE INDEX idx_transaction_categories_is_system ON transaction_categories(is_system_defined);

-- uploaded_statements
CREATE INDEX idx_uploaded_statements_business_id ON uploaded_statements(business_id);
CREATE INDEX idx_uploaded_statements_account_id ON uploaded_statements(account_id);
CREATE INDEX idx_uploaded_statements_status ON uploaded_statements(status);
CREATE INDEX idx_uploaded_statements_uploaded_at ON uploaded_statements(uploaded_at);

-- transactions
CREATE INDEX idx_transactions_business_id ON transactions(business_id);
CREATE INDEX idx_transactions_account_id ON transactions(account_id);
CREATE INDEX idx_transactions_date ON transactions(date);
CREATE INDEX idx_transactions_type ON transactions(type);
CREATE INDEX idx_transactions_category ON transactions(category);
CREATE INDEX idx_transactions_status ON transactions(status);
CREATE INDEX idx_transactions_merchant ON transactions USING gin(to_tsvector('simple', merchant));
CREATE INDEX idx_transactions_subscription_id ON transactions(subscription_id);
CREATE INDEX idx_transactions_uploaded_statement ON transactions(uploaded_statement_id);

-- subscriptions
CREATE INDEX idx_subscriptions_business_id ON subscriptions(business_id);
CREATE INDEX idx_subscriptions_status ON subscriptions(status);
CREATE INDEX idx_subscriptions_next_billing ON subscriptions(next_billing_date);
CREATE INDEX idx_subscriptions_is_flagged ON subscriptions(is_flagged);

-- monthly_p_and_l_reports
CREATE INDEX idx_monthly_pl_business_month ON monthly_p_and_l_reports(business_id, month);

-- cash_flow_summaries
CREATE INDEX idx_cash_flow_business_month ON cash_flow_summaries(business_id, month);

-- ai_insights
CREATE INDEX idx_ai_insights_business_id ON ai_insights(business_id);
CREATE INDEX idx_ai_insights_priority ON ai_insights(priority);
CREATE INDEX idx_ai_insights_is_dismissed ON ai_insights(is_dismissed);
CREATE INDEX idx_ai_insights_created_at ON ai_insights(created_at);

-- financial_health_scores
CREATE INDEX idx_health_scores_business_calculated ON financial_health_scores(business_id, calculated_at);

-- categorisation_rules
CREATE INDEX idx_categorisation_rules_business ON categorisation_rules(business_id);
CREATE INDEX idx_categorisation_rules_enabled ON categorisation_rules(enabled);
CREATE INDEX idx_categorisation_rules_priority ON categorisation_rules(priority);

-- audit_logs
CREATE INDEX idx_audit_logs_business_id ON audit_logs(business_id);
CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_resource_type ON audit_logs(resource_type);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);

-- ============================================================
-- 4. TRIGGERS
-- ============================================================

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER tr_businesses_updated_at BEFORE UPDATE ON businesses
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER tr_financial_accounts_updated_at BEFORE UPDATE ON financial_accounts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER tr_transaction_categories_updated_at BEFORE UPDATE ON transaction_categories
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER tr_uploaded_statements_updated_at BEFORE UPDATE ON uploaded_statements
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER tr_transactions_updated_at BEFORE UPDATE ON transactions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER tr_subscriptions_updated_at BEFORE UPDATE ON subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER tr_monthly_pl_updated_at BEFORE UPDATE ON monthly_p_and_l_reports
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER tr_cash_flow_updated_at BEFORE UPDATE ON cash_flow_summaries
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER tr_ai_insights_updated_at BEFORE UPDATE ON ai_insights
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER tr_health_scores_updated_at BEFORE UPDATE ON financial_health_scores
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER tr_categorisation_rules_updated_at BEFORE UPDATE ON categorisation_rules
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- 5. ROW LEVEL SECURITY (RLS)
-- ============================================================

-- Helper: get current user's business_id
CREATE OR REPLACE FUNCTION get_current_user_business_id()
RETURNS UUID AS $$
DECLARE
  biz_id UUID;
BEGIN
  SELECT business_id INTO biz_id FROM users WHERE id = auth.uid();
  RETURN biz_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE financial_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE transaction_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE uploaded_statements ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE monthly_p_and_l_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE cash_flow_summaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_insights ENABLE ROW LEVEL SECURITY;
ALTER TABLE financial_health_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE categorisation_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Users: can see own profile + profiles in same business
CREATE POLICY "Users can view own profile" ON users
  FOR SELECT USING (id = auth.uid() OR business_id = get_current_user_business_id());
CREATE POLICY "Users can update own profile" ON users
  FOR UPDATE USING (id = auth.uid());

-- Businesses: members can view/update their business
CREATE POLICY "Users can view their business" ON businesses
  FOR SELECT USING (id = get_current_user_business_id());
CREATE POLICY "Users can update their business" ON businesses
  FOR UPDATE USING (id = get_current_user_business_id());
CREATE POLICY "Users can create business" ON businesses
  FOR INSERT WITH CHECK (owner_id = auth.uid());

-- Financial accounts
CREATE POLICY "Users can view business accounts" ON financial_accounts
  FOR ALL USING (business_id = get_current_user_business_id());

-- Transaction categories
CREATE POLICY "Users can view business categories" ON transaction_categories
  FOR ALL USING (business_id = get_current_user_business_id());

-- Uploaded statements
CREATE POLICY "Users can view business uploads" ON uploaded_statements
  FOR ALL USING (business_id = get_current_user_business_id());

-- Transactions
CREATE POLICY "Users can view business transactions" ON transactions
  FOR ALL USING (business_id = get_current_user_business_id());

-- Subscriptions
CREATE POLICY "Users can view business subscriptions" ON subscriptions
  FOR ALL USING (business_id = get_current_user_business_id());

-- Monthly P&L
CREATE POLICY "Users can view business P&L" ON monthly_p_and_l_reports
  FOR ALL USING (business_id = get_current_user_business_id());

-- Cash flow
CREATE POLICY "Users can view business cash flow" ON cash_flow_summaries
  FOR ALL USING (business_id = get_current_user_business_id());

-- AI insights
CREATE POLICY "Users can view business insights" ON ai_insights
  FOR ALL USING (business_id = get_current_user_business_id());

-- Health scores
CREATE POLICY "Users can view business health" ON financial_health_scores
  FOR ALL USING (business_id = get_current_user_business_id());

-- Categorisation rules
CREATE POLICY "Users can manage business rules" ON categorisation_rules
  FOR ALL USING (business_id = get_current_user_business_id());

-- Audit logs: append-only, view-only
CREATE POLICY "Users can view business audit logs" ON audit_logs
  FOR SELECT USING (business_id = get_current_user_business_id());
CREATE POLICY "System can insert audit logs" ON audit_logs
  FOR INSERT WITH CHECK (business_id = get_current_user_business_id());

-- ============================================================
-- 6. STORAGE BUCKETS (referenced by uploaded_statements.file_path)
-- ============================================================

-- Note: Create buckets via Supabase Dashboard or Storage API
-- Bucket names: financial_uploads, generated_reports, brand_assets
-- Recommended settings: public = false, file size limit = 10MB
