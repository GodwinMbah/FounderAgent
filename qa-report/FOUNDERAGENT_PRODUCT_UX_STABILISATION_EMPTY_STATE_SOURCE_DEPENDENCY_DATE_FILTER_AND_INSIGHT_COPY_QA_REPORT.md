# FounderAgent Product UX Stabilisation, Empty State, Source Dependency, Date Filter, and Insight Copy QA Report

Date: 2026-06-03
Branch: `codex/product-ux-stabilisation-source-dependency`

## What Was Wrong

- Deleted uploads left old analytics visible because transactions, subscriptions, alerts, AI recommendations, and tasks were not consistently tied back to active source uploads.
- Dashboard date filtering was not strict enough: `Today` could show stale cash balance even when there were no transactions in the selected range.
- Alerts and AI insights could show legacy records without upload lineage.
- The foreign-currency alert could miscount every row as foreign currency when company currency was unavailable during pipeline execution.
- Dashboard layout allowed more than eight main cards, leaving Rule of 40 awkwardly isolated.
- Chart axes used ambiguous labels like `01`, `02`, `03`.
- Upload deletion warning did not fully explain that generated analytics would be removed.

## What Was Fixed

- Added an active financial data source layer that treats active uploads and manual transactions as the source of truth.
- Added shared data coverage UI on Dashboard and Upload Centre.
- Added empty-state gating for Dashboard, Cash Flow, Runway, Expenses, Revenue, Subscriptions, Budgets, Reports, AI Insights, Alerts, Transactions, and P&L.
- Filtered transactions, metrics, subscriptions, alerts, recommendations, and tasks by active upload source.
- Tightened alerts, AI recommendations, and AI tasks so legacy unbacked records are hidden unless explicitly marked manual.
- Strengthened upload deletion cascade for transactions, generated subscriptions, alerts, recommendations, tasks, metrics cache, and path revalidation.
- Fixed dashboard `Today` with no rows to show `£0` for cash balance, revenue, expenses, profit, burn, and subscription spend.
- Kept dashboard main KPI cards to eight; extra KPIs move to Advanced Metrics.
- Added source-backed insight bulbs for Cash Balance, Monthly Revenue, Monthly Expenses, Net Profit, Subscription Spend, Top Expense Categories, Cash Flow, and Runway Analysis.
- Replaced ambiguous chart month labels with compact month/year labels.
- Fixed full-screen intelligence review overflow.
- Fixed foreign-currency alert copy to show actual count, currencies, base currency, and source rows.
- Duplicate-only imports now skip derived insight generation.

## Empty State Proof

After deleting the only active upload and its 694 transactions, browser checks showed the connect data source state on:

- `/dashboard`
- `/cash-flow`
- `/runway`
- `/expenses`
- `/revenue`
- `/subscriptions`
- `/alerts`
- `/ai-insights`
- `/transactions`
- `/reports`

Browser text proof: each page contained `Connect your first financial data source.` and no stale `£` metric values. Upload Centre settled to `No uploads yet. Upload a file to see it here.`

## Delete Cascade Proof

The live test deleted upload `c44eaf5e-ebeb-4d2f-b731-515fa959c5d7`, which had `transaction_count = 694`.

Post-delete proof:

- `uploads`: 0
- `transactions`: 0
- `company_metrics`: 0
- UI financial pages showed empty state
- Upload Centre showed no uploads

Legacy derived rows without upload metadata existed in the database, so source filtering was tightened to hide unbacked alerts/recommendations/tasks unless marked manual.

## Reimport And Duplicate Proof

Real file used:

`/Users/mbahg/Downloads/FounderAgent/references/account-statement_01-Jan-2026_24-May-2026.csv`

The file has 695 lines including the header, therefore 694 data rows.

First restored import via the real server pipeline:

- Upload id: `2d2e08d5-f89d-4f00-a97d-7f40e32092df`
- Rows parsed: 694
- Rows inserted: 694
- Rows failed: 0
- Duplicates skipped: 0
- Transfers: 43
- Needs review: 84
- Categorised: 685
- Linked to subscriptions: 13
- Reconciliation balanced: true

Duplicate import proof:

- Upload id: `53696aea-ac9d-49ca-a1ce-6b7796b8080a`
- Rows parsed: 694
- Rows inserted: 0
- Duplicates skipped: 694
- Rows failed: 0
- Alerts created: 0
- Tasks created: 0
- Reconciliation balanced: true

Browser Upload Centre proof showed `2 uploads`, one upload with `694 dup`, and the original import with `43 xfer`.

## GBP And Date Filter Proof

Dashboard All time:

- Data available: `01 Jan 2026 to 24 May 2026`
- Data coverage: `694 transactions from 2 uploads`
- KPI source: `694 transactions from 1 upload in this date range`
- GBP symbols visible
- Bad old foreign-currency copy not present

Dashboard Today:

- Coverage says no selected transactions
- Cash Balance: `£0`
- Monthly Revenue: `£0`
- Monthly Expenses: `£0`
- Net Profit: `£0`
- Monthly Burn: `£0`
- KPI source: `0 transactions from 0 uploads in this date range`

## Alert And AI Copy Proof

Corrected live foreign-currency alert:

`80 transaction(s) have original currency USD, EUR, AED and settle into GBP. Source rows: 2, 4, 10, 11, 32, 38, 70, 74, 103, 108, 119, 120, 122, 132, 148, 152, 153, 159, 165, 171.`

The old misleading copy `694 transaction(s) were imported in foreign currency` was not visible in the dashboard browser proof.

## Commands Run

- `npm run lint`
- `npm test`
- `npm run build`
- `npx --yes tsx ... runUploadPipeline(...)`
- Supabase admin verification scripts for upload counts, transaction counts, reconciliation metadata, and alert metadata
- Browser checks against `http://localhost:3000/dashboard`, `/upload-centre`, `/transactions`, `/alerts`, and `/ai-insights`

## Final Check Results

- Lint: passed
- Unit tests: passed, 30 files, 439 tests
- Build: passed
- Browser proof: passed for empty state, all-time restored data, Today strict range, Upload Centre duplicate proof, transactions visibility, source-backed insight drawer, and corrected foreign-currency alert copy

## Known Limitations

- In-app browser automation did not expose file-input upload control, so the reimport and duplicate proof used the real server pipeline with the real CSV file rather than drag-and-drop UI automation.
- Browser screenshot capture timed out in this session, so this report uses browser text evidence and command output rather than new saved screenshots.
- Legacy database rows that were created before upload lineage existed can still remain in raw tables. The UI now hides unbacked alerts/recommendations/tasks, but a future cleanup migration should mark or delete historical unbacked derived records.
- Data coverage counts active upload records, so after a duplicate-only upload it correctly says `694 transactions from 2 uploads`; KPI source now separately shows the exact contributing upload count: `694 transactions from 1 upload`.

## Recommendation Before P4

This foundation pass is ready for PR review. I recommend merging only after reviewing the branch diff and manually confirming one drag-and-drop upload in the browser, because browser automation could not operate the hidden file input in this environment. Do not start P4 until this source-dependency and stale-insight behavior is accepted.
