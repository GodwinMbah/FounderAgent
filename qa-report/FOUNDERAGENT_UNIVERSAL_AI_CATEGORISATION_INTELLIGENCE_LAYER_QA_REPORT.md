# FounderAgent Universal AI Categorisation Intelligence Layer QA Report

Date: 2026-06-03  
Branch: `codex/universal-categorisation-intelligence-recovery`  
Scope: Part B after the data trust foundation work. P4, P5, agentic actions, AI reasoning, and new KPIs were not built.

## Executive Summary

This branch fixes the core categorisation trust problem found after the data foundation work: upload preview and import categorisation were not using the same intelligence path, and the visible preview left too many obvious rows as `Uncategorised Review`.

The real 694-row Revolut Business GBP file is now parsed through a shared canonical categorisation runner for both preview and import. The preview result and canonical import result have `0` category/status/KPI-treatment parity differences in tests.

This is not a production-readiness or investor-readiness claim.

## Root Cause

- Preview used older categorisation/suggestion logic while import used the newer V3 path.
- Revolut `Description`, `Reference`, external transaction ID, and MCC fields were not clearly separated in the mapping UI.
- Pattern suggestions were too willing to infer categories from repeated merchants and references, including unsafe `Revenue` suggestions for personal-name counterparties.
- Transfer-style rows needed more precise categories and KPI exclusion, especially `Internal Transfer`, `International Transfer`, `Credit Card Payment`, and `Loan Repayment`.
- The taxonomy and merchant/reference rules were missing common founder-business categories such as AI tools, cloud infrastructure, vehicle/fuel, customer service, and revenue adjustments.

## What Changed

- Added shared canonical categorisation runner: `src/lib/upload/categorisation-runner.ts`.
- Routed upload preview and import pipeline through the same runner.
- Added evidence fields to preview rows: category reason, category confidence, grouping confidence, KPI treatment, business meaning, evidence list, transfer/subscription/recurrence flags.
- Fixed Revolut mapping display so `Reference`, `External Transaction ID`, and `Merchant Category Code (MCC)` are distinct.
- Added safer transfer/KPI exclusion handling across reporting filters.
- Improved deterministic evidence rules for commission, refunds, Stripe payouts, Klarna underlying merchants, internal transfers, credit card payments, loan repayments, hosting, printing/marketing collateral, customer service, AI tools, and common SaaS tools.
- Hardened Smart Suggestions so personal-name merchants do not receive broad auto-applied `Revenue` suggestions, and commission references resolve to `Sales Commission`.

## Real File Proof

File used:

`references/account-statement_01-Jan-2026_24-May-2026.csv`

Controlled preview/import parity test, mixed business settings:

- Rows: `694`
- Failed rows: `0`
- Detected currency: `GBP`
- Preview/canonical parity differences: `0`
- Categorised: `296`
- Suggested: `271`
- Needs review: `84`
- Uncategorised: `7`
- Ambiguous: `2`
- Transfer-style rows: `43`
- Credit card payments: `5`
- Subscription candidates: `14`
- Recurring candidates: `13`

Browser proof, demo agency profile:

- Rows: `694`
- GBP visible throughout preview.
- Income to add: `£78,356.69`
- Expenses to add: `-£79,624.56`
- Net movement: `-£1,267.87`
- Duplicates to skip: `0`
- Latest balance: `£21,739.60`
- Visible categorisation summary: `366` categorised, `247` suggested, `81` needs review, `43` transfers, `2` ambiguous.

Screenshots:

- `qa-report/screenshots/universal-categorisation-mapping-corrected.png`
- `qa-report/screenshots/universal-categorisation-preview-summary.png`

## Example Outcomes

- `Marketing Commission` → `Sales Commission`, KPI included.
- `Sales Rep Commision Fee` → `Sales Commission`, KPI included.
- `Canva` → `Software`, KPI included.
- `Gamma.app` → `Software`, KPI included.
- `Manus Ai` → `AI Tools`, KPI included.
- `Netflix` → `Subscriptions`, KPI included.
- `Remitly` → `International Transfer`, KPI excluded.
- `Refund Processed` → `Revenue Adjustment`, KPI included.
- `From British Pound` → `Internal Transfer`, KPI excluded.
- `Klarna*amazon` → `Office Costs`, with Klarna treated as payment context.
- `Moneyway` → `Loan Repayment`, KPI excluded.
- `Capital On Tap` → `Credit Card Payment`, KPI excluded.
- `Hostinger.com` → `Cloud Infrastructure`, KPI included.
- `Roller Banner Fee` → `Marketing`, KPI included.
- `Teleperformance Contac` → `Customer Service`, KPI included.

## Browser Proof Notes

The in-app browser backend does not support file uploads, so the upload proof used a controlled Playwright browser against `http://localhost:3000` with the demo test account. The flow uploaded the real file, reached mapping, corrected mapping labels were visible, then reached preview. I did not click `Confirm & Import` for this Part B browser proof.

Browser checks confirmed:

- Mapping reference examples show business references, not transaction IDs.
- `External Transaction ID` and `Merchant Category Code (MCC)` are separate mapping fields.
- `MARKETING COMMISSION PAYOUT` and `SALES REP COMMISION FEE` suggestions are `Sales Commission`, not `Revenue`.
- `Catherine Bull` and `Oluwatosin Akinwoleola` no longer surface broad `Revenue` merchant suggestions.
- `Internal Transfer` is explained as account/currency movement, not operating revenue or spend.
- `Manus AI`, `Remitly`, `Hostinger`, and `Stripe` suggestions use merchant/reference context with explicit reasons.

## Tests Added Or Updated

- `src/lib/upload/__tests__/smart-mapper.test.ts`
- `src/components/features/upload/__tests__/usePatternSuggestions.test.ts`
- `src/lib/intelligence/__tests__/categorisation-engine.test.ts`
- `src/lib/intelligence/__tests__/revolut-categorisation.test.ts`
- `src/lib/parser/__tests__/revolut-fields.test.ts`

Coverage now includes:

- Real 694-row preview/import parity.
- Real-file low manual-review threshold.
- Revolut field separation for bank description, reference, external ID, and MCC.
- Business-profile context.
- Open Banking-style canonical transaction input.
- Personal-name merchant guardrails.
- Commission/refund/transfer/Klarna/Stripe examples.

## Commands Run

- `npm run lint` → passed.
- `npm test` → passed, `26` files and `402` tests.
- `npm run build` → passed.
- `npm test -- src/lib/upload/__tests__/smart-mapper.test.ts src/lib/parser/__tests__/revolut-fields.test.ts` → passed.
- `npm test -- src/components/features/upload/__tests__/usePatternSuggestions.test.ts src/lib/upload/__tests__/smart-mapper.test.ts` → passed.
- `npx tsx -e ...` real-file metric/parity proof → passed, `0` parity diffs.
- Controlled Playwright browser upload proof → passed.

Build warning observed: Next.js reports the `middleware` convention is deprecated in favour of `proxy`. This is existing framework migration work and was not part of Part B.

## Known Limitations

- This is a deterministic evidence engine, not a live LLM/agent reasoning layer.
- Some rows remain correctly in review when merchant/reference context is genuinely unclear.
- Browser proof was preview-only. Database import/duplicate proof belongs to the data trust foundation PR.
- Suggestion counts are business-profile sensitive; the browser demo profile is `agency`, while parity tests use controlled `mixed` settings.
- The current UI still has a dense suggestion list; the categorisation is safer, but the review UX can be improved later without changing the data brain.

## Recommendation

This Part B categorisation layer is strong enough for PR review after the data trust foundation branch is reviewed. It should not be described as production ready or investor ready. The next phase should be to merge/review the data foundation, then run a combined end-to-end import proof from CSV row to persisted transaction to dashboard KPI using this categorisation branch on top.
