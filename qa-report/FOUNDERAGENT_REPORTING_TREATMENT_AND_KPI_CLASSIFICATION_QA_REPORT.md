# FounderAgent Reporting Treatment and KPI Classification QA Report

Date: 2026-06-03

Branch: `codex/reporting-treatment-kpi-classification`

Base branch: `codex/categorisation-finalisation-kpi-feed`

## Scope

This phase implemented the deterministic reporting treatment layer only.

Not included: P4, P5, AI reasoning, agentic actions, or new KPIs.

## What Was Built

- Added `src/lib/reporting/treatment-engine.ts`, a deterministic engine that assigns every transaction a structured reporting treatment.
- Each treatment records category, subcategory, treatment code, confidence, source evidence, explanation, and inclusion/exclusion flags for operating KPIs, operating revenue, operating expenses, P&L, cash flow, cash movement, balance sheet movement, debt tracking, owner movement, subscriptions, recurring revenue, tax, data quality, and audit trail.
- Persisted the treatment into `transactions.metadata.reporting_treatment` during upload import and recategorisation.
- Updated reporting filters so revenue, expenses, profit, cash flow, and cash movement no longer share one broad `kpi_excluded` interpretation.
- Updated Dashboard/Cash Flow aggregation paths so operating KPIs use P&L rows, while cash movement can still include transfers and repayment movement.
- Added UI explanations on transaction rows, upload preview, upload detail rows, and KPI drilldowns.
- Fixed Upload Centre blank rendering by removing a `useSearchParams` client bailout and the `fallback={null}` Suspense wrapper.

## Why `kpi_excluded` Was Too Broad

`kpi_excluded` only answered whether a row should affect operating KPIs. It did not explain where that same row still belonged. Internal transfers, credit card repayments, loan repayments, duplicates, tax payments, and owner movements all need different reporting destinations. A single boolean made it too easy to exclude a row from revenue and expenses while also losing its relevance to cash movement, debt tracking, data quality, or audit trail.

## Treatment Examples

- Internal transfer: saved and visible; excluded from revenue, expenses, profit, burn, and runway; included in cash movement and audit trail.
- Credit card repayment: saved and visible; excluded from operating expenses/P&L; included in cash movement, debt tracking, and audit trail.
- Loan repayment: principal is excluded from normal operating expenses; included in debt/balance-sheet movement.
- Duplicate row: excluded from financial KPIs; included in data quality reporting and audit trail.
- Stripe/payment processor payout: treated as operating revenue when imported from the Revolut TOPUP/payout pattern and not user-confirmed as another non-operating category.
- Refund: kept as a revenue or expense adjustment based on direction/context.

## Real 694-Row Revolut Proof

File used: `/Users/mbahg/Downloads/FounderAgent/test_data/csv/revolut_694.csv`

Signed-in company: `Pathway To Salesforce Limited`

Company ID: `925fc8e0-2d08-4422-a878-14c3872195a7`

Company currency: `GBP`

First upload ID: `ae2a5090-233b-485c-8e59-af07fe91a62e`

Duplicate upload ID: `85877373-fffc-40a2-9039-7f9b5f30dd29`

First upload reconciliation:

- Rows in file: 694
- Rows parsed: 694
- Rows valid: 694
- Rows inserted: 694
- Duplicate skipped: 0
- Transfers: 43
- KPI-excluded rows: 127
- Revenue rows: 86
- Expense rows: 481
- Cash flow rows: 567
- Cash movement rows: 694
- P&L rows: 567
- Debt rows: 7
- Data quality rows: 84
- Failed rows: 0
- Row outcomes: 694
- Balanced: yes

Duplicate reupload reconciliation:

- Rows in file: 694
- Rows parsed: 694
- Rows inserted: 0
- Duplicate skipped: 694
- KPI-excluded rows: 694
- Cash movement rows: 0
- Data quality rows: 694
- Failed rows: 0
- Row outcomes: 694
- Balanced: yes

Database proof:

- DB transactions for first upload: 694
- Transaction currencies: GBP only
- Missing reporting treatment: 0
- Missing lineage fields: 0
- Payment processor payout rows included as revenue: 86
- Stripe rows misclassified as transfer: 0
- Debt tracking rows: 7
- Data quality rows: 84
- Cash movement rows: 694

Treatment counts:

- `operating_expense`: 446
- `payment_processor_payout`: 86
- `internal_transfer`: 13
- `subscription_expense`: 6
- `credit_card_repayment`: 5
- `international_transfer`: 23
- `refund_or_adjustment`: 10
- `loan_repayment`: 2
- `bank_fee`: 18
- `data_quality_review`: 84
- `tax_payment`: 1

## Browser Proof

The in-app browser was signed in as the user account and verified:

- Upload Centre renders after the Suspense fix.
- Upload History shows both `account-statement_01-Jan-2026_24-May-2026.csv` uploads.
- Upload History shows the duplicate replay as `694 dup`.
- Upload History shows the original import as `43 xfer`.
- Upload Detail shows reconciliation fields including rows in file, parsed, valid, imported, duplicates, transfers, excluded KPIs, revenue rows, expense rows, cash flow rows, cash movement, P&L rows, debt rows, tax rows, quality rows, and balanced status.
- Upload Detail shows `Showing 100 of 694 matching rows` and row-level reporting treatment explanations.
- Transactions page shows `Showing 100 of 694 total transactions from account-statement_01-Jan-2026_24-May-2026.csv`.
- Transactions page shows GBP and pound-formatted amounts only.
- Transactions page shows `Payment processor payout: KPI included`.
- Transactions page shows `Credit card repayment: KPI excluded (credit card repayment)`.
- Cash Flow page shows GBP values, `Cash In`, `Cash Out`, and net cash movement copy.
- Dashboard all-time KPI source shows `694 transactions from 1 upload in this date range`.
- Dashboard/Cash Flow/Transactions browser text contained GBP/pound values and no dollar signs during this pass.

Screenshot limitation: browser screenshot capture repeatedly timed out with `Page.captureScreenshot`. Browser proof is therefore DOM/text evidence plus live Supabase proof, not image proof.

File-picker limitation: the in-app browser runtime could not programmatically set the local file input for the upload control. The real CSV was imported through the same storage row plus `runUploadPipeline` path, then verified in the browser from persisted Supabase records.

## Commands Run

- `npm run lint` - passed.
- `npm test` - passed, 29 files and 431 tests.
- `npm run build` - passed. Only warning: Next.js middleware convention is deprecated in favor of proxy.
- `npx tsx scripts/verify-schema.ts` - passed all MUST columns. Non-blocking SHOULD warnings remain for `bank_accounts.account_number`, `bank_accounts.sort_code`, `company_metrics.mrr`, and `agent_tasks.description/due_date/assigned_to`.
- `npx tsx scripts/audit-secrets.ts` - passed with no findings.
- Read-only Supabase proof query - passed after wrapping inline TypeScript in an async function.

## Test Coverage Added

New tests in `src/lib/reporting/__tests__/treatment-engine.test.ts` cover:

- Internal transfers
- Credit card repayments
- Loan repayments
- Owner drawings
- Stripe payouts
- PayPal payouts
- Shopify payouts
- Refunds
- Tax payments
- Bank fees
- Software subscriptions
- Advertising spend
- Contractor payments
- Commission payments
- Payroll
- Inventory
- COGS
- Shipping
- Cash injections
- Capital injections
- Duplicate rows
- Ambiguous/review rows

Updated aggregate tests prove revenue/expenses/profit stay operating-only while cash movement can still include relevant movement rows.

## Files Responsible

Core reporting engine and tests:

- `src/lib/reporting/treatment-engine.ts`
- `src/lib/reporting/__tests__/treatment-engine.test.ts`
- `src/lib/reporting/filters.ts`
- `src/lib/reporting/aggregates.ts`
- `src/lib/reporting/__tests__/aggregates.test.ts`

Upload/import persistence and reconciliation:

- `src/lib/upload/pipeline.ts`
- `src/lib/upload/categorisation-runner.ts`
- `src/lib/upload/categoriser-v3-adapter.ts`
- `src/lib/upload/smart-mapper.ts`
- `src/lib/upload/reconciliation.ts`
- `src/lib/upload/wizard-types.ts`
- `src/lib/upload/recategorisation.ts`
- `src/lib/providers/canonical-model.ts`
- `src/lib/providers/canonical-adapter.ts`
- `src/lib/types.ts`

Database/reporting consumers:

- `src/lib/db/metrics.ts`
- `src/lib/db/transactions.ts`
- `src/lib/actions/transactions.ts`

UI proof surfaces:

- `src/app/(dashboard)/upload-centre/page.tsx`
- `src/app/(dashboard)/upload-centre/WizardClient.tsx`
- `src/app/(dashboard)/upload-centre/wizard-actions.ts`
- `src/app/(dashboard)/upload-centre/upload-history-actions.ts`
- `src/components/features/upload/UploadHistoryList.tsx`
- `src/app/(dashboard)/transactions/content.tsx`
- `src/app/(dashboard)/cash-flow/CashFlowClient.tsx`
- `src/components/features/dashboard/KPIDrilldownDrawer.tsx`

## Known Limitations

- No SQL migration was required for this phase because reporting treatment is stored in existing JSONB metadata.
- Existing historical transactions that were imported before this change are interpreted by fallback logic, but they are not automatically backfilled with persisted `metadata.reporting_treatment`.
- AI/alert copy may still produce misleading narrative text from older layers; AI reasoning and alert rewrite work are explicitly outside this phase.
- Screenshot capture failed in the in-app browser transport, so this report relies on DOM/browser text and Supabase proof.
- Browser file-picker automation was unavailable, so the real CSV import was executed through the same backend storage and pipeline path rather than by clicking the file input.

## Recommendation On P4

The deterministic data trust and reporting treatment layer is ready for PR review based on live database proof and browser proof from CSV row to transactions, upload reconciliation, dashboard, and cash flow.

Do not start P4 yet. First review and merge this PR, decide whether to backfill historical transactions, and clean up AI/alert wording that can still misrepresent otherwise-correct GBP/import facts.
