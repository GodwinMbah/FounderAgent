-- FounderAgent Security Updates Migration
-- Adds composite indexes, ensures helper function, and tightens RLS policies.

-- ============================================================
-- 1. COMPOSITE INDEXES for multi-tenant query performance
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_transactions_company_status ON transactions(company_id, status);
CREATE INDEX IF NOT EXISTS idx_transactions_company_date ON transactions(company_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_subscriptions_company_status ON subscriptions(company_id, status);
CREATE INDEX IF NOT EXISTS idx_alerts_company_dismissed ON alerts(company_id, is_dismissed);
CREATE INDEX IF NOT EXISTS idx_agent_tasks_company_status ON agent_tasks(company_id, status);
CREATE INDEX IF NOT EXISTS idx_agent_recs_company_status ON agent_recommendations(company_id, status);
CREATE INDEX IF NOT EXISTS idx_uploads_company_status ON uploads(company_id, status);
CREATE INDEX IF NOT EXISTS idx_budgets_company_active ON budgets(company_id, is_active);

-- ============================================================
-- 2. HELPER FUNCTION (idempotent)
-- ============================================================

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

-- ============================================================
-- 3. TIGHTEN RLS POLICIES
-- ============================================================

-- Ensure agent_activity_logs has a tight SELECT policy
DROP POLICY IF EXISTS "Members can view company activity logs" ON agent_activity_logs;
CREATE POLICY "Members can view company activity logs" ON agent_activity_logs
  FOR SELECT USING (company_id = ANY(get_user_company_ids(auth.uid())));
