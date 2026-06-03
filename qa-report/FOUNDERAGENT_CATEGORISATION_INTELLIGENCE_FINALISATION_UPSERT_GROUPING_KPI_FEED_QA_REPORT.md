# FounderAgent Categorisation Intelligence Finalisation, Upsert, Grouping, and KPI Feed QA Report

Date: 2026-06-03  
Branch: `codex/categorisation-finalisation-kpi-feed`  
Base: `codex/universal-categorisation-intelligence-recovery`  
Scope: foundation work after Part B. P4, P5, agentic actions, AI reasoning, and new KPIs were not built.

## Executive Summary

This phase finalises the categorisation preview experience and category refresh path on top of the universal categorisation branch.

The upload preview now leads with a compact intelligence summary, shows only genuinely unresolved rows prominently, separates Reference from row details, exposes KPI treatment and KPI exclusion reasons, and carries grouping evidence from preview into import reconciliation.

The 694-row Revolut Business GBP file was reset, previewed, imported, checked in Transactions, checked in Dashboard and Cash Flow, re-uploaded for duplicate proof, and category-refreshed without duplicating rows.

This is not a production-readiness or investor-readiness claim.

## What Changed

- Added shared KPI treatment helpers in `src/lib/kpi-treatment.ts`.
- Added universal transaction grouping in `src/lib/upload/intelligence-groups.ts`.
- Added safe recategorisation helpers in `src/lib/upload/recategorisation.ts`.
- Extended canonical transaction metadata with category source, user-confirmed protection, and intelligence group fields.
- Routed grouping through the shared categorisation runner used by preview and import.
- Reworked upload preview UI:
  - removed the dense Smart Suggestions list from the default page;
  - added compact intelligence summary;
  - added Review Remaining Items panel;
  - renamed main preview columns to Row, Date, Merchant, Reference, Counterparty, Bank Type, Amount, Direction, Category, Confidence, Status, KPI Treatment;
  - moved Description, bank description, external transaction ID, MCC, account, and payer into row details.
- Added Upload History category refresh action.
- Marked user category edits as `user_confirmed` and protected them from automatic refresh.
- Surfaced friendly KPI exclusion reasons in Preview, Upload History, Transactions, and KPI drilldowns.

## KPI Excluded Meaning

KPI excluded means the row is saved, visible, traceable, and auditable, but excluded from operating KPI calculations.

Rows are not deleted or hidden. They are excluded from revenue, expenses, profit, burn, runway, cash flow, and margin calculations when they are internal transfers, duplicate rows, credit card repayments, loan repayments, unresolved review rows, or other non-operating movements.

## Browser Proof

Real file used:

`references/account-statement_01-Jan-2026_24-May-2026.csv`

Browser flow:

- Reset demo upload data.
- Uploaded the real 694-row Revolut CSV.
- Verified preview shows `Intelligence Summary`.
- Verified default page no longer shows the old dense `Smart Suggestions Review`.
- Verified preview shows Reference, Direction, KPI Treatment, GBP symbols, Sales Commission, and Internal Transfer wording.
- Opened Intelligence Review and verified KPI excluded count is visible.
- Imported the file.
- Verified Transactions shows `694` imported rows.
- Verified Dashboard uses GBP.
- Verified Cash Flow uses GBP.
- Re-uploaded the same file.
- Verified duplicate import summary completed with duplicate/skipped signal.
- Refreshed categories for the original upload and verified total DB transaction count stayed `694`.

Screenshots:

- `qa-report/screenshots/categorisation-final-first-preview.png`
- `qa-report/screenshots/categorisation-final-first-intelligence-review.png`
- `qa-report/screenshots/categorisation-final-first-summary.png`
- `qa-report/screenshots/categorisation-final-transactions.png`
- `qa-report/screenshots/categorisation-final-dashboard-gbp.png`
- `qa-report/screenshots/categorisation-final-cash-flow-gbp.png`
- `qa-report/screenshots/categorisation-final-duplicate-preview.png`
- `qa-report/screenshots/categorisation-final-duplicate-summary.png`
- `qa-report/screenshots/categorisation-final-category-refresh.png`

## Live Supabase Proof

Direct live query used `SUPABASE_SECRET_KEY`; the disabled legacy service key was not used for the final proof.

Final live database state after browser proof:

- Upload count: `2`
- Total persisted transactions: `694`
- Transaction currencies: `GBP`
- Missing lineage rows: `0`

First upload:

- Status: `completed`
- Rows in file: `694`
- Rows inserted: `694`
- DB transactions for upload: `694`
- Rows skipped duplicate: `0`
- Rows excluded from KPIs: `52`
- Rows needing review: `81`
- Reconciliation balanced: `true`
- Source currency: `GBP`

Duplicate upload:

- Status: `completed`
- Rows in file: `694`
- Rows inserted: `0`
- DB transactions for upload: `0`
- Rows skipped duplicate: `694`
- Rows excluded from KPIs: `694`
- Rows needing review: `0`
- Reconciliation balanced: `true`
- Source currency: `GBP`

KPI exclusion reasons persisted:

- `international_transfer`: `23`
- `internal_transfer`: `13`
- `needs_review`: `9`
- `credit_card_repayment`: `5`
- `loan_repayment`: `2`

Category refresh proof:

- Category refresh ran from Upload History.
- Total transactions after refresh: `694`
- Original upload refresh metadata: `lastCategoryRefreshCount: 694`
- No duplicate rows were created.

## Top Persisted Categories

- Advertising: `131`
- Revenue: `122`
- Food and Meals: `82`
- Software: `77`
- Office Costs: `41`
- AI Tools: `31`
- International Transfer: `23`
- Sales Commission: `21`
- Vehicle and Fuel: `21`
- Professional Services: `17`
- Contractors: `15`
- Internal Transfer: `13`

## Commands Run

- `npm test -- src/lib/upload/__tests__/intelligence-groups.test.ts src/lib/upload/__tests__/recategorisation.test.ts src/lib/upload/__tests__/smart-mapper.test.ts` → passed.
- `npm run lint` → passed.
- `npm test` → passed, `28` files and `409` tests.
- `npm run build` → passed.
- `npx tsx scripts/reset-demo-upload-data.ts` → passed.
- Controlled Playwright browser proof → passed.
- `npx tsx scripts/verify-schema.ts` → passed for all MUST columns.
- Direct Supabase reconciliation query with `SUPABASE_SECRET_KEY` → passed.

Build warning observed: Next.js still reports the `middleware` convention is deprecated in favour of `proxy`. This is existing framework migration work and not part of this phase.

## Tests Added Or Updated

- `src/lib/upload/__tests__/intelligence-groups.test.ts`
- `src/lib/upload/__tests__/recategorisation.test.ts`
- `src/lib/upload/__tests__/smart-mapper.test.ts`

Coverage added:

- Grouping similar transactions.
- Grouping lifts low-confidence rows only when evidence is strong.
- Grouping does not overwrite user-confirmed corrections.
- Preview summary counts KPI excluded and review rows.
- Recategorisation protects user corrections.
- Recategorisation update payload does not include insert/lineage fields.
- Transfer refresh status is normalised to a valid DB status.
- 694-row preview/import parity includes intelligence group IDs.

## Known Limitations

- This remains a deterministic evidence engine, not a live LLM reasoning layer.
- Some rows remain in review when merchant/reference evidence is genuinely unclear.
- Category refresh currently updates existing transaction category metadata and upload metadata; it does not rewrite historical import reconciliation row outcomes.
- The Upload History refresh action is intentionally scoped to existing imported rows only.
- The dense full-screen review still exists for inspection, but it is no longer the default preview experience.

## Recommendation

This branch is ready for PR review as the finalisation layer on top of the universal categorisation branch. It should be reviewed after PR #6 because it depends on the Part B shared categorisation runner.

Do not describe this as production ready or investor ready.
