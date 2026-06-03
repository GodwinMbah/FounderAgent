# FounderAgent Foundation Acceptance and P4 Readiness Gate QA Report

Date: 2026-06-03

## Branch And PR State

- Current branch: `codex/product-ux-stabilisation-source-dependency`
- Existing PR: #9, `codex/product-ux-stabilisation-source-dependency` into `codex/reporting-treatment-kpi-classification`
- Repository: `GodwinMbah/FounderAgent`
- Stack status: this branch is stacked. It contains the reporting treatment branch, categorisation finalisation branch, final data foundation consolidation branch, and core data trust recovery branch as ancestors.
- Correct merge order:
  1. `codex/core-data-trust-recovery`
  2. `codex/universal-smart-categorisation-engine`
  3. `codex/full-db-reconciliation-traceability`
  4. `codex/final-data-foundation-consolidation`
  5. `codex/universal-categorisation-intelligence-recovery`
  6. `codex/categorisation-finalisation-kpi-feed`
  7. `codex/reporting-treatment-kpi-classification`
  8. `codex/product-ux-stabilisation-source-dependency`

Do not merge PR #9 directly into `main` until the dependency chain is merged or a deliberate consolidation PR is created with the full stack included.

## What Was Fixed In This Pass

- Upload Centre file input is now accessible and testable: stable `id`, `data-testid`, `aria-label`, `sr-only` instead of `hidden`, and a label/dropzone wired with `htmlFor`.
- Empty-state `Upload Statement` buttons now route directly to `/upload-centre?focus=upload`, avoiding the duplicate setup upload concept.
- Upload Centre focus mode scrolls to the upload area and focuses the file input.
- Refreshed subscription source filtering now treats `last_detected_from_upload` as valid active lineage, while hiding generated subscriptions whose upload markers are all inactive.
- Generic debit/credit CSV provider proof now expects and detects `generic_bank`, not a fake Wise match.
- Added `scripts/legacy-derived-data-cleanup.ts` with dry run, `--mark-stale`, `--mark-manual`, and guarded generated-record deletion.
- Added `scripts/prove-foundation-acceptance.ts` for live 694-row, GBP, duplicate, date filter, source dependency, empty-state, accessibility, and deletion cascade proof.

## Files Changed

- `src/app/(dashboard)/upload-centre/WizardClient.tsx`
- `src/components/features/shared/ConnectDataSourceState.tsx`
- `src/lib/db/source-filters.ts`
- `src/lib/db/__tests__/data-source.test.ts`
- `src/lib/providers/adapters/generic-bank.ts`
- `scripts/test-provider-detection.ts`
- `scripts/legacy-derived-data-cleanup.ts`
- `scripts/prove-foundation-acceptance.ts`
- `qa-report/FOUNDERAGENT_FOUNDATION_ACCEPTANCE_AND_P4_READINESS_GATE_QA_REPORT.md`

## Live 694 Row Proof

Live owner company proof used company `925fc8e0-2d08-4422-a878-14c3872195a7`.

- CSV: `references/account-statement_01-Jan-2026_24-May-2026.csv`
- Parsed rows: 694
- Failed rows: 0
- Detected provider: `revolut_business_csv`
- Detected currency: GBP
- Active uploads: 2
- Active transactions: 694
- First upload ID: `2d2e08d5-f89d-4f00-a97d-7f40e32092df`
- Duplicate upload ID: `53696aea-ac9d-49ca-a1ce-6b7796b8080a`
- Duplicate upload: 0 DB transactions, 694 duplicate skipped row outcomes
- Lineage proof on first upload: 694 upload IDs, 694 source row numbers, 694 external transaction IDs, 694 raw row hashes, 694 merchants, 694 posted dates, 694 fee amounts, 694 running balances
- References populated where present in source: 219 rows

## Reconciliation And KPI Proof

- Rows in file: 694
- Rows parsed: 694
- Rows valid: 694
- Rows inserted: 694
- Rows marked transfer: 43
- Rows excluded from KPIs: 127
- Rows failed: 0
- Rows needing review: 84
- Rows categorised: 685
- Rows linked to subscriptions: 13
- Revenue rows: 86
- Expense rows: 481
- KPI upload count: 1 source upload with transactions
- All imported transaction currency values: GBP

All-time calculated proof:

- Revenue: GBP 78,356.69
- Expenses: GBP 76,088.90
- Net profit: GBP 2,267.79
- Cash in: GBP 81,801.61
- Cash out: GBP 93,359.80

## Date Filter Proof

- Earliest transaction date: 2026-01-01
- Latest transaction date: 2026-05-24
- All time: 694 transactions
- Last 30 days, 2026-05-05 to 2026-06-03: 66 transactions
- Today, 2026-06-03: 0 transactions
- Today date-sensitive KPIs: revenue 0, expenses 0, net profit 0, cash in 0, cash out 0
- Cash balance treatment: current implementation constrains dashboard cash balance to selected active source rows; Today with no selected rows shows zero.

## Source Dependency Proof

Live raw table state still contains old generated rows from inactive uploads, but source filters now prevent stale visible analytics:

- Alerts: 18 source-backed visible, 68 hidden legacy, 0 unsafe visible
- Recommendations: 22 source-backed visible, 99 hidden legacy, 0 unsafe visible
- Tasks: 8 source-backed visible, 34 hidden legacy, 0 unsafe visible
- Subscriptions: 4 source-backed visible, 2 generated legacy hidden, cleanup required

The remaining raw legacy records are not deleted automatically. Use the cleanup script after owner review.

## Legacy Cleanup Strategy

Dry run command:

```bash
npx tsx scripts/legacy-derived-data-cleanup.ts --company-id 925fc8e0-2d08-4422-a878-14c3872195a7
```

Dry run result:

- Total findings: 208
- Alerts: 68
- Agent recommendations: 99
- Agent tasks: 34
- Subscriptions: 2
- Company metrics: 5
- Recommended `delete_generated_legacy`: 201
- Recommended `mark_stale`: 7

Guarded actions:

```bash
npx tsx scripts/legacy-derived-data-cleanup.ts --company-id <company-id> --apply --mark-stale
npx tsx scripts/legacy-derived-data-cleanup.ts --company-id <company-id> --apply --mark-manual
npx tsx scripts/legacy-derived-data-cleanup.ts --company-id <company-id> --apply --delete-safe --confirm-delete-generated-legacy
```

Safety rules: no user rules, no company settings, no manual records, and no manual subscriptions are deleted. Transactions are review-only.

## Empty State And Upload Proof

Static route proof confirms these pages use the shared source-dependent empty state:

- Dashboard
- Transactions
- Cash Flow
- Subscriptions
- Alerts
- AI Insights
- Runway
- Expenses
- Revenue
- Budgets
- Reports
- P&L

Browser proof on `http://localhost:3000/upload-centre?focus=upload`:

- `financial-upload-input` exists
- `aria-label`: `Upload financial statement`
- `class`: `sr-only`
- `display`: `block`
- `visibility`: `visible`
- `tabIndex`: 0
- `disabled`: false
- active focused element: `financial-upload-input`
- dropzone `htmlFor`: `financial-upload-input`

Manual file picker proof is now unblocked. I did not re-delete and re-upload owner data in this final pass, to preserve the current signed-in test dataset.

## Upload Deletion Cascade Proof

Static proof confirms `deleteUploadAndTransactions` deletes source-tied:

- alerts
- agent recommendations
- agent tasks
- subscriptions generated from the upload
- company metrics
- transactions
- upload row

It also resets bank balance to zero when no uploads or manual transactions remain, and revalidates the source-dependent pages.

## Browser Speed Notes

Local warm-route browser timings:

- Dashboard all time: 2679 ms
- Transactions all time: 1143 ms
- Cash Flow all time: 1363 ms
- Subscriptions all time: 424 ms
- Alerts all time: 3438 ms
- AI Insights all time: 1425 ms
- Upload Centre focus: 660 ms

Transactions and upload details are paginated. Alerts remains the slowest route in this run and should be watched in P4 performance work.

## Commands Run

```bash
npm run lint
npm test
npm run build
npx tsx scripts/verify-schema.ts
npx tsx scripts/audit-secrets.ts
npx tsx scripts/prove-reconciliation-694.ts --reset
npx tsx scripts/prove-foundation-acceptance.ts --company-id 925fc8e0-2d08-4422-a878-14c3872195a7 --today 2026-06-03
npx tsx scripts/legacy-derived-data-cleanup.ts --company-id 925fc8e0-2d08-4422-a878-14c3872195a7
npx tsx scripts/test-unified-parser.ts
npx tsx scripts/test-provider-detection.ts
npx vitest run src/lib/reporting/__tests__/treatment-engine.test.ts src/lib/db/__tests__/data-source.test.ts src/lib/parser/__tests__/revolut-fields.test.ts
```

Results:

- Lint: passed
- Unit tests: 30 files passed, 439 tests passed
- Build: passed
- Schema verification: passed, all MUST columns present
- Secret audit: passed, no findings
- 694 reconciliation proof: passed
- Foundation acceptance proof: passed
- Unified parser proof: passed, 13/13
- Provider detection proof: initially failed on a stale Wise expectation, fixed, then passed 17/17
- Focused reporting/source/parser tests: passed, 3 files, 49 tests

Build warning: Next.js reports the `middleware` convention is deprecated in favor of `proxy`. This is not a data trust blocker.

## Owner Manual Test Steps

1. Pull this branch and start the app.
2. In Supabase or the app, delete existing upload data only when ready to reset the test company.
3. Confirm empty state on Dashboard, Transactions, Cash Flow, Subscriptions, Alerts, AI Insights, Runway, Expenses, Revenue, Budgets, Reports, P&L, and Upload Centre.
4. Click any `Upload Statement` button.
5. Confirm it opens Upload Centre and focuses the upload area.
6. Select `references/account-statement_01-Jan-2026_24-May-2026.csv`.
7. Confirm mapping.
8. Confirm preview.
9. Confirm intelligence summary.
10. Confirm import.
11. Confirm reconciliation shows 694 rows in file, 694 parsed, 694 valid, 694 inserted, 0 failed.
12. Confirm Upload History shows the upload.
13. Open Upload Detail and verify all rows can be reached through pagination/load more.
14. Open Transactions all time and verify 694 source transactions.
15. Open Dashboard all time and confirm GBP currency.
16. Open Cash Flow all time and confirm GBP currency.
17. Open a KPI drilldown and confirm source transaction/upload counts.
18. Upload the same file again.
19. Confirm duplicate upload skips 694 rows and inserts 0 transactions.
20. Delete the upload data.
21. Confirm source-dependent pages return to empty state and stale alerts/AI/subscription analytics disappear.

## Known Limitations

- Raw legacy generated rows still exist until the owner runs the guarded cleanup script. They are hidden from source-backed UI where the app can identify inactive source lineage.
- Two old generated subscriptions are currently hidden by source filtering but should be marked stale by cleanup.
- Browser automation verified the file input can now be operated, but the final owner-style file picker upload/delete-to-empty loop remains a manual acceptance step.
- Alerts route was the slowest route in this local pass.
- No P4/P5/AI reasoning/agentic action work was started.

## Merge And P4 Gate

This branch is safe to review as the final foundation acceptance layer, but it should merge only after the stacked dependency chain is handled in order. P4 can start after PR #9 or a clean consolidation PR is merged and the owner completes the manual upload/delete acceptance steps above.
