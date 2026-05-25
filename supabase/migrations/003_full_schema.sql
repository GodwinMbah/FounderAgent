-- FounderAgent Full Schema Migration
-- Creates all tables, enums, indexes, triggers, RLS policies

-- ============================================================
-- 1. CUSTOM ENUMS
-- ============================================================

DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('owner', 'admin', 'member', 'viewer');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE currency_code AS ENUM ('USD', 'GBP', 'EUR', 'AUD', 'CAD');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE account_type AS ENUM ('bank', 'credit_card', 'paypal', 'stripe', 'manual');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE upload_source AS ENUM ('bank_statement_csv', 'bank_statement_pdf', 'stripe', 'paypal', 'quickbooks', 'xero', 'manual_csv', 'receipt');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE upload_status AS ENUM ('pending', 'processing', 'completed', 'failed');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE transaction_type AS ENUM ('income', 'expense');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE transaction_status AS ENUM ('categorised', 'needs_review', 'possible_subscription', 'possible_duplicate', 'unusual_spend', 'ai_suggested', 'user_confirmed');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE subscription_status AS ENUM ('active', 'canceled', 'paused', 'expired');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE billing_cycle AS ENUM ('monthly', 'quarterly', 'yearly');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE alert_severity AS ENUM ('critical', 'warning', 'info', 'resolved');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE alert_category AS ENUM ('spending', 'subscription', 'revenue', 'cash_flow', 'budget', 'security', 'compliance');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE report_type AS ENUM ('p_and_l', 'cash_flow', 'balance_sheet', 'budget_variance', 'subscription_audit', 'runway_analysis', 'board_summary');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE report_status AS ENUM ('draft', 'generating', 'ready', 'archived');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE task_type AS ENUM (
    'find_cheaper_alternatives',
    'detect_duplicate_subscriptions',
    'flag_wasteful_spending',
    'forecast_runway',
    'identify_revenue_growth',
    'create_cost_reduction_plan',
    'generate_investor_summary',
    'review_renewals',
    'identify_unusual_transactions',
    'suggest_renegotiations',
    'categorise_transactions',
    'generate_report'
  );
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE task_status AS ENUM ('pending', 'queued', 'running', 'completed', 'failed', 'cancelled');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE task_priority AS ENUM ('low', 'medium', 'high', 'urgent');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE recommendation_status AS ENUM ('new', 'viewed', 'accepted', 'dismissed', 'implemented');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- ============================================================
-- 2. TABLES
-- ============================================================

-- 2.1 profiles — extends auth.users
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  phone TEXT,
  timezone TEXT DEFAULT 'UTC',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2.2 companies — business workspace
CREATE TABLE IF NOT EXISTS companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE,
  industry TEXT,
  currency currency_code NOT NULL DEFAULT 'USD',
  fiscal_year_start INT NOT NULL DEFAULT 1 CHECK (fiscal_year_start BETWEEN 1 AND 12),
  timezone TEXT NOT NULL DEFAULT 'UTC',
  tax_region TEXT,
  logo_url TEXT,
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2.3 company_members — connects users to companies
CREATE TABLE IF NOT EXISTS company_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role user_role NOT NULL DEFAULT 'member',
  is_active BOOLEAN NOT NULL DEFAULT true,
  invited_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (company_id, user_id)
);

-- 2.4 uploads — financial documents
CREATE TABLE IF NOT EXISTS uploads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  file_name TEXT NOT NULL,
  file_path TEXT,
  file_size INT NOT NULL DEFAULT 0,
  mime_type TEXT,
  source upload_source NOT NULL DEFAULT 'manual_csv',
  status upload_status NOT NULL DEFAULT 'pending',
  transaction_count INT,
  error_message TEXT,
  metadata JSONB DEFAULT '{}',
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2.5 transactions
CREATE TABLE IF NOT EXISTS transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  upload_id UUID REFERENCES uploads(id) ON DELETE SET NULL,
  date DATE NOT NULL,
  merchant TEXT,
  description TEXT NOT NULL DEFAULT '',
  category TEXT,
  amount NUMERIC(14,2) NOT NULL,
  type transaction_type NOT NULL,
  status transaction_status NOT NULL DEFAULT 'needs_review',
  confidence_score INT CHECK (confidence_score BETWEEN 0 AND 100),
  tags TEXT[] DEFAULT '{}',
  notes TEXT,
  is_recurring BOOLEAN DEFAULT false,
  subscription_id UUID,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2.6 subscriptions
CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
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
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Link transactions to subscriptions
ALTER TABLE transactions
  DROP CONSTRAINT IF EXISTS fk_transactions_subscription;
ALTER TABLE transactions
  ADD CONSTRAINT fk_transactions_subscription
  FOREIGN KEY (subscription_id) REFERENCES subscriptions(id) ON DELETE SET NULL;

-- 2.7 budgets
CREATE TABLE IF NOT EXISTS budgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  amount NUMERIC(14,2) NOT NULL,
  period TEXT NOT NULL DEFAULT 'monthly',
  start_date DATE NOT NULL,
  end_date DATE,
  alert_threshold NUMERIC(5,2) DEFAULT 80.00,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (company_id, category, period, start_date)
);

-- 2.8 alerts
CREATE TABLE IF NOT EXISTS alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  severity alert_severity NOT NULL DEFAULT 'info',
  category alert_category NOT NULL DEFAULT 'spending',
  resource_type TEXT,
  resource_id UUID,
  is_read BOOLEAN NOT NULL DEFAULT false,
  is_dismissed BOOLEAN NOT NULL DEFAULT false,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2.9 reports
CREATE TABLE IF NOT EXISTS reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type report_type NOT NULL,
  status report_status NOT NULL DEFAULT 'draft',
  file_path TEXT,
  file_size INT,
  period_start DATE,
  period_end DATE,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2.10 agent_tasks
CREATE TABLE IF NOT EXISTS agent_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  task_type task_type NOT NULL,
  status task_status NOT NULL DEFAULT 'pending',
  priority task_priority NOT NULL DEFAULT 'medium',
  input_data JSONB DEFAULT '{}',
  result_summary TEXT,
  recommended_actions JSONB DEFAULT '[]',
  error_message TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2.11 agent_recommendations
CREATE TABLE IF NOT EXISTS agent_recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  task_id UUID REFERENCES agent_tasks(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT,
  potential_savings NUMERIC(14,2),
  impact_score INT CHECK (impact_score BETWEEN 0 AND 100),
  effort_score INT CHECK (effort_score BETWEEN 0 AND 100),
  status recommendation_status NOT NULL DEFAULT 'new',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2.12 agent_activity_logs
CREATE TABLE IF NOT EXISTS agent_activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  task_id UUID REFERENCES agent_tasks(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  resource_type TEXT,
  resource_id TEXT,
  input_data JSONB,
  output_data JSONB,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 3. INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);

CREATE INDEX IF NOT EXISTS idx_company_members_company ON company_members(company_id);
CREATE INDEX IF NOT EXISTS idx_company_members_user ON company_members(user_id);
CREATE INDEX IF NOT EXISTS idx_company_members_active ON company_members(is_active);

CREATE INDEX IF NOT EXISTS idx_uploads_company ON uploads(company_id);
CREATE INDEX IF NOT EXISTS idx_uploads_status ON uploads(status);
CREATE INDEX IF NOT EXISTS idx_uploads_user ON uploads(user_id);

CREATE INDEX IF NOT EXISTS idx_transactions_company ON transactions(company_id);
CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date);
CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(type);
CREATE INDEX IF NOT EXISTS idx_transactions_category ON transactions(category);
CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status);
CREATE INDEX IF NOT EXISTS idx_transactions_merchant ON transactions USING gin(to_tsvector('simple', COALESCE(merchant, '')));
CREATE INDEX IF NOT EXISTS idx_transactions_upload ON transactions(upload_id);

CREATE INDEX IF NOT EXISTS idx_subscriptions_company ON subscriptions(company_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_next_billing ON subscriptions(next_billing_date);
CREATE INDEX IF NOT EXISTS idx_subscriptions_flagged ON subscriptions(is_flagged);

CREATE INDEX IF NOT EXISTS idx_budgets_company ON budgets(company_id);
CREATE INDEX IF NOT EXISTS idx_budgets_active ON budgets(is_active);

CREATE INDEX IF NOT EXISTS idx_alerts_company ON alerts(company_id);
CREATE INDEX IF NOT EXISTS idx_alerts_severity ON alerts(severity);
CREATE INDEX IF NOT EXISTS idx_alerts_dismissed ON alerts(is_dismissed);
CREATE INDEX IF NOT EXISTS idx_alerts_created ON alerts(created_at);

CREATE INDEX IF NOT EXISTS idx_reports_company ON reports(company_id);
CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status);
CREATE INDEX IF NOT EXISTS idx_reports_type ON reports(type);

CREATE INDEX IF NOT EXISTS idx_agent_tasks_company ON agent_tasks(company_id);
CREATE INDEX IF NOT EXISTS idx_agent_tasks_status ON agent_tasks(status);
CREATE INDEX IF NOT EXISTS idx_agent_tasks_type ON agent_tasks(task_type);
CREATE INDEX IF NOT EXISTS idx_agent_tasks_priority ON agent_tasks(priority);

CREATE INDEX IF NOT EXISTS idx_agent_recs_company ON agent_recommendations(company_id);
CREATE INDEX IF NOT EXISTS idx_agent_recs_status ON agent_recommendations(status);

CREATE INDEX IF NOT EXISTS idx_agent_logs_company ON agent_activity_logs(company_id);
CREATE INDEX IF NOT EXISTS idx_agent_logs_task ON agent_activity_logs(task_id);
CREATE INDEX IF NOT EXISTS idx_agent_logs_created ON agent_activity_logs(created_at);

-- ============================================================
-- 4. TRIGGERS
-- ============================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_profiles_updated_at ON profiles;
CREATE TRIGGER tr_profiles_updated_at BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS tr_companies_updated_at ON companies;
CREATE TRIGGER tr_companies_updated_at BEFORE UPDATE ON companies
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS tr_company_members_updated_at ON company_members;
CREATE TRIGGER tr_company_members_updated_at BEFORE UPDATE ON company_members
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS tr_uploads_updated_at ON uploads;
CREATE TRIGGER tr_uploads_updated_at BEFORE UPDATE ON uploads
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS tr_transactions_updated_at ON transactions;
CREATE TRIGGER tr_transactions_updated_at BEFORE UPDATE ON transactions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS tr_subscriptions_updated_at ON subscriptions;
CREATE TRIGGER tr_subscriptions_updated_at BEFORE UPDATE ON subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS tr_budgets_updated_at ON budgets;
CREATE TRIGGER tr_budgets_updated_at BEFORE UPDATE ON budgets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS tr_alerts_updated_at ON alerts;
CREATE TRIGGER tr_alerts_updated_at BEFORE UPDATE ON alerts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS tr_reports_updated_at ON reports;
CREATE TRIGGER tr_reports_updated_at BEFORE UPDATE ON reports
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS tr_agent_tasks_updated_at ON agent_tasks;
CREATE TRIGGER tr_agent_tasks_updated_at BEFORE UPDATE ON agent_tasks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS tr_agent_recs_updated_at ON agent_recommendations;
CREATE TRIGGER tr_agent_recs_updated_at BEFORE UPDATE ON agent_recommendations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- 5. RLS POLICIES
-- ============================================================

-- Helper: get user's company IDs
CREATE OR REPLACE FUNCTION get_user_company_ids(p_user_id UUID)
RETURNS UUID[] AS $$
DECLARE
  company_ids UUID[];
BEGIN
  SELECT ARRAY_AGG(company_id) INTO company_ids
  FROM company_members
  WHERE user_id = p_user_id AND is_active = true;
  RETURN COALESCE(company_ids, ARRAY[]::UUID[]);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE uploads ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_recommendations ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_activity_logs ENABLE ROW LEVEL SECURITY;

-- Profiles
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
CREATE POLICY "Users can view own profile" ON profiles
  FOR ALL USING (id = auth.uid());

-- Companies
DROP POLICY IF EXISTS "Members can view their companies" ON companies;
CREATE POLICY "Members can view their companies" ON companies
  FOR SELECT USING (id = ANY(get_user_company_ids(auth.uid())));

DROP POLICY IF EXISTS "Owners and admins can update company" ON companies;
CREATE POLICY "Owners and admins can update company" ON companies
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM company_members
      WHERE company_id = companies.id
      AND user_id = auth.uid()
      AND role IN ('owner', 'admin')
      AND is_active = true
    )
  );

-- Company members
DROP POLICY IF EXISTS "Members can view company members" ON company_members;
CREATE POLICY "Members can view company members" ON company_members
  FOR SELECT USING (company_id = ANY(get_user_company_ids(auth.uid())));

DROP POLICY IF EXISTS "Owners and admins can manage members" ON company_members;
CREATE POLICY "Owners and admins can manage members" ON company_members
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM company_members cm
      WHERE cm.company_id = company_members.company_id
      AND cm.user_id = auth.uid()
      AND cm.role IN ('owner', 'admin')
      AND cm.is_active = true
    )
  );

-- Uploads
DROP POLICY IF EXISTS "Members can view company uploads" ON uploads;
CREATE POLICY "Members can view company uploads" ON uploads
  FOR ALL USING (company_id = ANY(get_user_company_ids(auth.uid())));

-- Transactions
DROP POLICY IF EXISTS "Members can view company transactions" ON transactions;
CREATE POLICY "Members can view company transactions" ON transactions
  FOR ALL USING (company_id = ANY(get_user_company_ids(auth.uid())));

-- Subscriptions
DROP POLICY IF EXISTS "Members can view company subscriptions" ON subscriptions;
CREATE POLICY "Members can view company subscriptions" ON subscriptions
  FOR ALL USING (company_id = ANY(get_user_company_ids(auth.uid())));

-- Budgets
DROP POLICY IF EXISTS "Members can view company budgets" ON budgets;
CREATE POLICY "Members can view company budgets" ON budgets
  FOR ALL USING (company_id = ANY(get_user_company_ids(auth.uid())));

-- Alerts
DROP POLICY IF EXISTS "Members can view company alerts" ON alerts;
CREATE POLICY "Members can view company alerts" ON alerts
  FOR ALL USING (company_id = ANY(get_user_company_ids(auth.uid())));

-- Reports
DROP POLICY IF EXISTS "Members can view company reports" ON reports;
CREATE POLICY "Members can view company reports" ON reports
  FOR ALL USING (company_id = ANY(get_user_company_ids(auth.uid())));

-- Agent tasks
DROP POLICY IF EXISTS "Members can view company agent tasks" ON agent_tasks;
CREATE POLICY "Members can view company agent tasks" ON agent_tasks
  FOR ALL USING (company_id = ANY(get_user_company_ids(auth.uid())));

-- Agent recommendations
DROP POLICY IF EXISTS "Members can view company recommendations" ON agent_recommendations;
CREATE POLICY "Members can view company recommendations" ON agent_recommendations
  FOR ALL USING (company_id = ANY(get_user_company_ids(auth.uid())));

-- Agent activity logs
DROP POLICY IF EXISTS "Members can view company activity logs" ON agent_activity_logs;
CREATE POLICY "Members can view company activity logs" ON agent_activity_logs
  FOR SELECT USING (company_id = ANY(get_user_company_ids(auth.uid())));
