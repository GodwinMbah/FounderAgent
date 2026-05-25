# FounderAgent — Supabase Database Schema

## Project
- **URL**: `https://xuhelthxbytxafnsccso.supabase.co`
- **Status**: Connected

## Tables

### 1. `profiles`
Extends `auth.users` with user profile data.
- `id` (UUID, PK → auth.users)
- `email`, `full_name`, `avatar_url`, `phone`, `timezone`
- RLS: Users can only access their own profile

### 2. `companies`
Business workspace / tenant.
- `id` (UUID, PK)
- `name`, `slug`, `industry`, `currency`, `fiscal_year_start`, `timezone`, `tax_region`, `logo_url`, `settings`
- RLS: Members can view their companies; owners/admins can update

### 3. `company_members`
Links users to companies with roles.
- `id` (UUID, PK)
- `company_id`, `user_id`, `role` (owner/admin/member/viewer), `is_active`
- RLS: Members can view; owners/admins can manage

### 4. `transactions`
Core financial transactions.
- `id` (UUID, PK)
- `company_id`, `date`, `merchant`, `description`, `category`, `amount`, `type` (income/expense)
- `status`, `confidence_score`, `tags`, `notes`, `is_recurring`, `subscription_id`
- RLS: Company-scoped

### 5. `subscriptions`
Recurring software/service costs.
- `id` (UUID, PK)
- `company_id`, `name`, `vendor`, `category`, `amount`, `billing_cycle`, `next_billing_date`
- `status`, `is_flagged`, `flag_reason`
- RLS: Company-scoped

### 6. `budgets`
Planned budgets by category.
- `id` (UUID, PK)
- `company_id`, `category`, `amount`, `period`, `start_date`, `end_date`, `alert_threshold`, `is_active`
- RLS: Company-scoped

### 7. `alerts`
Risk alerts, spending alerts, renewal alerts.
- `id` (UUID, PK)
- `company_id`, `title`, `description`, `severity`, `category`, `is_read`, `is_dismissed`
- RLS: Company-scoped

### 8. `reports`
Generated financial reports.
- `id` (UUID, PK)
- `company_id`, `name`, `type`, `status`, `file_path`, `file_size`, `period_start`, `period_end`
- RLS: Company-scoped

### 9. `uploads`
Uploaded financial documents.
- `id` (UUID, PK)
- `company_id`, `user_id`, `file_name`, `file_path`, `file_size`, `mime_type`, `source`, `status`
- `transaction_count`, `error_message`, `metadata`
- RLS: Company-scoped

### 10. `agent_tasks`
Agentic tasks (research, detect, forecast, etc.).
- `id` (UUID, PK)
- `company_id`, `created_by`, `title`, `task_type`, `status`, `priority`
- `input_data`, `result_summary`, `recommended_actions`, `error_message`
- `started_at`, `completed_at`
- RLS: Company-scoped

### 11. `agent_recommendations`
AI-generated recommendations.
- `id` (UUID, PK)
- `company_id`, `task_id`, `title`, `description`, `category`
- `potential_savings`, `impact_score`, `effort_score`, `status`
- RLS: Company-scoped

### 12. `agent_activity_logs`
Audit trail of agent actions.
- `id` (UUID, PK)
- `company_id`, `task_id`, `action`, `resource_type`, `resource_id`
- `input_data`, `output_data`, `metadata`
- RLS: Company-scoped (view-only)

## Enums
- `user_role`: owner, admin, member, viewer
- `currency_code`: USD, GBP, EUR, AUD, CAD
- `account_type`: bank, credit_card, paypal, stripe, manual
- `upload_source`: bank_statement_csv, bank_statement_pdf, stripe, paypal, quickbooks, xero, manual_csv, receipt
- `upload_status`: pending, processing, completed, failed
- `transaction_type`: income, expense
- `transaction_status`: categorised, needs_review, possible_subscription, possible_duplicate, unusual_spend, ai_suggested, user_confirmed
- `subscription_status`: active, canceled, paused, expired
- `billing_cycle`: monthly, quarterly, yearly
- `alert_severity`: critical, warning, info, resolved
- `alert_category`: spending, subscription, revenue, cash_flow, budget, security, compliance
- `report_type`: p_and_l, cash_flow, balance_sheet, budget_variance, subscription_audit, runway_analysis, board_summary
- `report_status`: draft, generating, ready, archived
- `task_type`: find_cheaper_alternatives, detect_duplicate_subscriptions, flag_wasteful_spending, forecast_runway, identify_revenue_growth, create_cost_reduction_plan, generate_investor_summary, review_renewals, identify_unusual_transactions, suggest_renegotiations, categorise_transactions, generate_report
- `task_status`: pending, queued, running, completed, failed, cancelled
- `task_priority`: low, medium, high, urgent
- `recommendation_status`: new, viewed, accepted, dismissed, implemented

## RLS Policy Pattern
All tables use `get_user_company_ids(auth.uid())` to scope queries to the user's company memberships. No table has public read/write access.

## Storage Buckets
- `financial_documents` (private) — Bank statements, CSVs, PDFs, receipts
- `report_exports` (private) — Generated PDF/Excel reports

## Setup Instructions
1. Apply `supabase/migrations/003_full_schema.sql` in Supabase SQL Editor
2. Run `supabase/seed_new_schema.sql` to populate demo data
3. Create auth user via Supabase Auth UI
4. Link user to company by inserting into `company_members`
