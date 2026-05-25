-- FounderAgent Seed Data for New Schema
-- Run after applying 003_full_schema.sql

-- ============================================================
-- DEMO COMPANY
-- ============================================================

INSERT INTO companies (id, name, slug, industry, currency, fiscal_year_start, timezone, tax_region, settings)
VALUES (
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'Acme Labs',
  'acme-labs',
  'Technology',
  'USD',
  1,
  'America/New_York',
  'US',
  '{"demo": true}'::jsonb
)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- DEMO PROFILE (link to auth.users manually)
-- ============================================================

-- INSERT INTO profiles (id, email, full_name, timezone)
-- VALUES ('YOUR_AUTH_USER_ID', 'demo@acmelabs.com', 'Alex Founder', 'America/New_York')
-- ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- COMPANY MEMBER (link user to company)
-- ============================================================

-- INSERT INTO company_members (company_id, user_id, role, is_active)
-- VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'YOUR_AUTH_USER_ID', 'owner', true)
-- ON CONFLICT (company_id, user_id) DO NOTHING;

-- ============================================================
-- TRANSACTIONS
-- ============================================================

INSERT INTO transactions (id, company_id, date, merchant, description, category, amount, type, status, confidence_score)
VALUES
  ('11111111-1111-1111-1111-111111111001', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '2026-05-20', 'Stripe Payout', 'Customer payment received', 'Revenue', 4200.00, 'income', 'categorised', 98),
  ('11111111-1111-1111-1111-111111111002', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '2026-05-19', 'AWS', 'Amazon Web Services - EC2', 'Cloud Infrastructure', 843.20, 'expense', 'categorised', 95),
  ('11111111-1111-1111-1111-111111111003', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '2026-05-18', 'Meta Ads', 'Facebook advertising campaign', 'Advertising', 1250.00, 'expense', 'categorised', 92),
  ('11111111-1111-1111-1111-111111111004', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '2026-05-17', 'Notion', 'Team workspace subscription', 'Software', 96.00, 'expense', 'ai_suggested', 88),
  ('11111111-1111-1111-1111-111111111005', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '2026-05-16', 'Gusto', 'Payroll processing', 'Payroll', 8750.00, 'expense', 'categorised', 99),
  ('11111111-1111-1111-1111-111111111006', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '2026-05-15', 'Stripe Payout', 'Customer payment received', 'Revenue', 3800.00, 'income', 'categorised', 98),
  ('11111111-1111-1111-1111-111111111007', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '2026-05-14', 'Figma', 'Design tool subscription', 'Software', 45.00, 'expense', 'ai_suggested', 85),
  ('11111111-1111-1111-1111-111111111008', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '2026-05-13', 'Upwork', 'Contractor payment - frontend dev', 'Contractors', 2400.00, 'expense', 'categorised', 90),
  ('11111111-1111-1111-1111-111111111009', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '2026-05-12', 'Slack', 'Team communication', 'Software', 150.00, 'expense', 'ai_suggested', 94),
  ('11111111-1111-1111-1111-111111111010', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '2026-05-11', 'Stripe Payout', 'Customer payment received', 'Revenue', 5100.00, 'income', 'categorised', 98),
  ('11111111-1111-1111-1111-111111111011', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '2026-05-10', 'Google Workspace', 'Business email & docs', 'Software', 72.00, 'expense', 'ai_suggested', 96),
  ('11111111-1111-1111-1111-111111111012', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '2026-05-09', 'HubSpot', 'CRM subscription', 'Marketing Tools', 450.00, 'expense', 'ai_suggested', 91),
  ('11111111-1111-1111-1111-111111111013', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '2026-05-08', 'WeWork', 'Office space rental', 'Office', 2200.00, 'expense', 'categorised', 97),
  ('11111111-1111-1111-1111-111111111014', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '2026-05-07', 'Stripe Payout', 'Customer payment received', 'Revenue', 2950.00, 'income', 'categorised', 98)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- SUBSCRIPTIONS
-- ============================================================

INSERT INTO subscriptions (id, company_id, name, vendor, category, amount, billing_cycle, next_billing_date, status, start_date, is_flagged, flag_reason)
VALUES
  ('22222222-2222-2222-2222-222222222001', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'AWS EC2', 'Amazon Web Services', 'Cloud Infrastructure', 843.20, 'monthly', '2026-06-19', 'active', '2024-01-15', false, null),
  ('22222222-2222-2222-2222-222222222002', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Notion Team', 'Notion Labs', 'Software', 96.00, 'monthly', '2026-06-18', 'active', '2024-03-01', false, null),
  ('22222222-2222-2222-2222-222222222003', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Figma Professional', 'Figma', 'Software', 45.00, 'monthly', '2026-06-14', 'active', '2024-02-10', false, null),
  ('22222222-2222-2222-2222-222222222004', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Slack Pro', 'Slack Technologies', 'Software', 150.00, 'monthly', '2026-06-12', 'active', '2023-11-01', false, null),
  ('22222222-2222-2222-2222-222222222005', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'GitHub Team', 'GitHub', 'Software', 88.00, 'monthly', '2026-06-10', 'active', '2023-09-15', false, null),
  ('22222222-2222-2222-2222-222222222006', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'HubSpot Starter', 'HubSpot', 'Marketing Tools', 450.00, 'monthly', '2026-06-09', 'active', '2024-05-01', true, 'Low usage, consider downgrading'),
  ('22222222-2222-2222-2222-222222222007', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Google Workspace', 'Google', 'Software', 72.00, 'monthly', '2026-06-10', 'active', '2023-08-01', false, null),
  ('22222222-2222-2222-2222-222222222008', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Linear', 'Linear', 'Software', 32.00, 'monthly', '2026-06-11', 'active', '2024-01-20', false, null),
  ('22222222-2222-2222-2222-222222222009', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Datadog', 'Datadog', 'Cloud Infrastructure', 520.00, 'monthly', '2026-06-08', 'active', '2024-02-15', true, 'High cost, evaluate alternatives'),
  ('22222222-2222-2222-2222-222222222010', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Zoom Pro', 'Zoom', 'Software', 149.90, 'monthly', '2026-06-07', 'active', '2023-10-01', false, null)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- BUDGETS
-- ============================================================

INSERT INTO budgets (id, company_id, category, amount, period, start_date, alert_threshold, is_active)
VALUES
  ('33333333-3333-3333-3333-333333333001', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Payroll', 10000, 'monthly', '2026-01-01', 90, true),
  ('33333333-3333-3333-3333-333333333002', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Advertising', 1500, 'monthly', '2026-01-01', 80, true),
  ('33333333-3333-3333-3333-333333333003', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Cloud Infrastructure', 1000, 'monthly', '2026-01-01', 85, true),
  ('33333333-3333-3333-3333-333333333004', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Software', 600, 'monthly', '2026-01-01', 80, true),
  ('33333333-3333-3333-3333-333333333005', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Office', 2500, 'monthly', '2026-01-01', 90, true),
  ('33333333-3333-3333-3333-333333333006', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Contractors', 3000, 'monthly', '2026-01-01', 80, true)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- ALERTS
-- ============================================================

INSERT INTO alerts (id, company_id, title, description, severity, category, is_read, is_dismissed)
VALUES
  ('44444444-4444-4444-4444-444444444001', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'HubSpot subscription flagged for review', 'Paying $450/mo but only 2 team members actively use it.', 'critical', 'subscription', false, false),
  ('44444444-4444-4444-4444-444444444002', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Datadog cost exceeded budget threshold', 'Monthly spend reached $520, exceeding the $500 budget.', 'warning', 'spending', false, false),
  ('44444444-4444-4444-4444-444444444003', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Cash runway extended to 14 months', 'Strong revenue growth and controlled expenses.', 'info', 'cash_flow', true, false),
  ('44444444-4444-4444-4444-444444444004', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Contractor costs up 18% this quarter', 'Increased from $1,800 to $2,400/month.', 'warning', 'spending', false, false),
  ('44444444-4444-4444-4444-444444444005', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Possible duplicate subscription detected', 'Notion and Confluence both active.', 'warning', 'subscription', false, false),
  ('44444444-4444-4444-4444-444444444006', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Advertising spend within budget', 'Current spend is $1,250 of $1,500 budget.', 'info', 'budget', true, false)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- REPORTS
-- ============================================================

INSERT INTO reports (id, company_id, name, type, status, file_size, period_start, period_end)
VALUES
  ('55555555-5555-5555-5555-555555555001', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'May 2026 P&L Report', 'p_and_l', 'ready', 245000, '2026-05-01', '2026-05-31'),
  ('55555555-5555-5555-5555-555555555002', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Q2 2026 Board Summary', 'board_summary', 'ready', 890000, '2026-04-01', '2026-06-30'),
  ('55555555-5555-5555-5555-555555555003', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Subscription Audit April', 'subscription_audit', 'ready', 120000, '2026-04-01', '2026-04-30'),
  ('55555555-5555-5555-5555-555555555004', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Runway Analysis', 'runway_analysis', 'ready', 180000, '2026-05-01', '2026-05-31'),
  ('55555555-5555-5555-5555-555555555005', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Budget Variance Q2', 'budget_variance', 'generating', null, '2026-04-01', '2026-06-30'),
  ('55555555-5555-5555-5555-555555555006', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Cash Flow May 2026', 'cash_flow', 'ready', 156000, '2026-05-01', '2026-05-31'),
  ('55555555-5555-5555-5555-555555555007', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Balance Sheet Q1', 'balance_sheet', 'archived', 310000, '2026-01-01', '2026-03-31')
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- AGENT TASKS
-- ============================================================

INSERT INTO agent_tasks (id, company_id, title, task_type, status, priority, result_summary, recommended_actions)
VALUES
  ('66666666-6666-6666-6666-666666666001', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Find cheaper alternatives to Datadog', 'find_cheaper_alternatives', 'completed', 'high', 'Grafana Cloud ($150/mo) and New Relic ($280/mo) are viable alternatives. Potential savings: $240-370/mo.', '["Evaluate Grafana Cloud free trial", "Compare feature parity with Datadog"]'),
  ('66666666-6666-6666-6666-666666666002', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Detect duplicate subscriptions', 'detect_duplicate_subscriptions', 'completed', 'medium', 'Found 2 potential duplicates: Notion + Confluence, Slack + Microsoft Teams.', '["Audit team usage of Confluence", "Consolidate to single communication tool"]'),
  ('66666666-6666-6666-6666-666666666003', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Forecast runway scenarios', 'forecast_runway', 'running', 'high', null, null),
  ('66666666-6666-6666-6666-666666666004', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Flag wasteful spending', 'flag_wasteful_spending', 'pending', 'medium', null, null),
  ('66666666-6666-6666-6666-666666666005', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Generate investor summary', 'generate_investor_summary', 'pending', 'high', null, null),
  ('66666666-6666-6666-6666-666666666006', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Review upcoming renewals', 'review_renewals', 'completed', 'low', '5 subscriptions renew in next 30 days. Total: $1,659. HubSpot and Datadog are candidates for renegotiation.', '["Contact HubSpot for downgrade options", "Request Datadog annual discount"]')
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- AGENT RECOMMENDATIONS
-- ============================================================

INSERT INTO agent_recommendations (id, company_id, title, description, category, potential_savings, impact_score, effort_score, status)
VALUES
  ('77777777-7777-7777-7777-777777777001', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Switch from Datadog to Grafana Cloud', 'Grafana Cloud provides similar APM features at $150/mo vs Datadog $520/mo.', 'cost_saving', 4440, 85, 40, 'new'),
  ('77777777-7777-7777-7777-777777777002', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Downgrade HubSpot to free tier', 'Only 2 of 12 team members use HubSpot CRM actively.', 'cost_saving', 5400, 90, 20, 'new'),
  ('77777777-7777-7777-7777-777777777003', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Negotiate annual billing for AWS', 'Reserved instances could reduce EC2 costs by 30-40%.', 'cost_saving', 3035, 75, 50, 'viewed'),
  ('77777777-7777-7777-7777-777777777004', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Consolidate communication tools', 'Using both Slack ($150/mo) and partial Zoom ($149.90/mo). Teams plan covers both.', 'efficiency', 1798.80, 60, 70, 'new'),
  ('77777777-7777-7777-7777-777777777005', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Increase ad spend on high-ROAS channels', 'Meta Ads showing 4.2x ROAS. Consider increasing budget by 20%.', 'growth', 0, 80, 30, 'accepted')
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- UPLOADS
-- ============================================================

INSERT INTO uploads (id, company_id, file_name, file_size, source, status, transaction_count)
VALUES
  ('88888888-8888-8888-8888-888888888001', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'chase_may_2026.csv', 24580, 'bank_statement_csv', 'completed', 142),
  ('88888888-8888-8888-8888-888888888002', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'amex_may_2026.csv', 18340, 'bank_statement_csv', 'completed', 89),
  ('88888888-8888-8888-8888-888888888003', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'stripe_payouts_may.csv', 12500, 'stripe', 'completed', 56),
  ('88888888-8888-8888-8888-888888888004', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'quickbooks_export.qbo', 45600, 'quickbooks', 'processing', null)
ON CONFLICT (id) DO NOTHING;
