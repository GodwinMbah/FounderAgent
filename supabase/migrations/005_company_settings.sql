-- ============================================================
-- 5. COMPANY_SETTINGS TABLE
-- Stores extended onboarding and business configuration data
-- ============================================================

-- Create company_settings table
CREATE TABLE IF NOT EXISTS company_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  industry TEXT,
  business_stage TEXT,
  country TEXT,
  currency TEXT,
  fiscal_year_start TEXT,
  timezone TEXT,
  primary_goal TEXT,
  revenue_model TEXT,
  monthly_recurring_revenue NUMERIC,
  one_time_revenue NUMERIC,
  average_monthly_revenue NUMERIC,
  top_revenue_channels JSONB DEFAULT '[]',
  payment_tools JSONB DEFAULT '[]',
  average_monthly_expenses NUMERIC,
  biggest_cost_category TEXT,
  active_subscription_count INT,
  tools_used JSONB DEFAULT '[]',
  payroll_spend NUMERIC,
  advertising_spend NUMERIC,
  cloud_spend NUMERIC,
  agent_focus JSONB DEFAULT '[]',
  alert_sensitivity TEXT,
  weekly_digest_enabled BOOLEAN DEFAULT true,
  agent_autonomy_level TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (company_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_company_settings_company ON company_settings(company_id);

-- Updated at trigger
DROP TRIGGER IF EXISTS tr_company_settings_updated_at ON company_settings;
CREATE TRIGGER tr_company_settings_updated_at
  BEFORE UPDATE ON company_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS
ALTER TABLE company_settings ENABLE ROW LEVEL SECURITY;

-- RLS: Members can view settings for their companies
DROP POLICY IF EXISTS "Members can view company settings" ON company_settings;
CREATE POLICY "Members can view company settings" ON company_settings
  FOR SELECT USING (company_id = ANY(get_user_company_ids(auth.uid())));

-- RLS: Owners and admins can manage settings
DROP POLICY IF EXISTS "Owners and admins can manage company settings" ON company_settings;
CREATE POLICY "Owners and admins can manage company settings" ON company_settings
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM company_members cm
      WHERE cm.company_id = company_settings.company_id
      AND cm.user_id = auth.uid()
      AND cm.role IN ('owner', 'admin')
      AND cm.is_active = true
    )
  );
