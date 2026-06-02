-- ============================================================
-- 13. BUSINESS INTELLIGENCE COLUMNS
-- Add business intelligence columns to company_settings.
-- These support the KPI eligibility engine, smart categorisation v3,
-- and user correction learning.
-- ============================================================

-- RLS POLICY DISCREPANCY NOTE:
-- Migration 005 (company_settings) SELECT policy uses:
--   company_id = ANY(get_user_company_ids(auth.uid()))
-- Migration 012 (onboarding_complete_setup) SELECT policy uses:
--   EXISTS (SELECT 1 FROM company_members ... WHERE is_active = true)
-- Both restrict to active company members; 005 relies on a helper
-- function while 012 uses an inline EXISTS. No cross-company leak.
-- The ALL (UPDATE/INSERT/DELETE) policy is identical in both:
--   role IN ('owner', 'admin') AND is_active = true.
-- ============================================================

-- Add business intelligence columns to company_settings
ALTER TABLE company_settings
  ADD COLUMN IF NOT EXISTS business_model TEXT,
  ADD COLUMN IF NOT EXISTS revenue_models TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS cost_structure TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS category_rules JSONB DEFAULT '[]';

-- Backfill from onboarding_data JSONB if present
UPDATE company_settings
SET
  business_model = COALESCE(business_model, onboarding_data->>'business_model'),
  revenue_models = COALESCE(revenue_models, ARRAY(SELECT jsonb_array_elements_text(onboarding_data->'revenue_models'))),
  cost_structure = COALESCE(cost_structure, ARRAY(SELECT jsonb_array_elements_text(onboarding_data->'cost_structure'))),
  category_rules = COALESCE(category_rules, onboarding_data->'category_rules', '[]')
WHERE onboarding_data IS NOT NULL;

-- Add comments for documentation
COMMENT ON COLUMN company_settings.business_model IS 'Business model enum: saas, ecommerce, agency, consulting, services, physical_products, marketplace, digital_products, membership, mixed, other';
COMMENT ON COLUMN company_settings.revenue_models IS 'Array of revenue models: subscription, one_time, project, retainer, marketplace_commission, affiliate, digital_product, physical_product, usage_based, donation, mixed';
COMMENT ON COLUMN company_settings.cost_structure IS 'Array of cost structure flags: cogs, inventory, shipping, contractors, payroll, advertising, software, cloud, payment_fees, office, professional_services, other';
COMMENT ON COLUMN company_settings.category_rules IS 'JSON array of user correction rules: [{merchantPattern, category, confidenceBoost}]';
