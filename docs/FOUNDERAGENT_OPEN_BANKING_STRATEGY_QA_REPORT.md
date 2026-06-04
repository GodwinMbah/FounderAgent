# FounderAgent Open Banking Strategy, Connected Account KPI Routing, and Performance Foundation QA Report

Date: 2026-06-04

## Direction Change

FounderAgent should move from CSV-first ingestion to Open Banking-first connected data. CSV import proved useful for the data trust, reconciliation, categorisation, and reporting treatment foundation, but Capital One testing confirmed the long-term risk: every bank and card provider exports CSV differently. Continuing to tune one provider file at a time would turn FounderAgent into a spreadsheet-cleaning product instead of a connected finance intelligence platform.

CSV remains supported for:

- Historical uploads
- Unsupported banks
- One-off statement import
- Accountant exports
- Users not ready to connect a bank
- Fallback when Open Banking is unavailable

CSV and Open Banking must feed the same canonical transaction model, categorisation engine, reporting treatment engine, duplicate detection, transaction persistence, metrics, and source trace.

## Provider Research Sources

Verified against official provider documentation/pages on 2026-06-04.

- Plaid Transactions API: https://plaid.com/docs/api/products/transactions/
- Plaid pricing and billing: https://plaid.com/docs/account/billing/
- Plaid Europe institution coverage: https://plaid.com/docs/institutions/europe/
- TrueLayer Data API basics: https://docs.truelayer.com/docs/data-api-basics
- TrueLayer sandbox note: https://support.truelayer.com/hc/en-us/articles/360002087954-Does-TrueLayer-offer-a-trial-period-and-a-Sandbox-environment
- Yapily categorisation: https://docs.yapily.com/data/data-plus/categorisation
- Tink transactions: https://tink.com/products/transactions/
- Tink pricing: https://tink.com/pricing/
- Tink FAQ business account note: https://tink.com/faq/
- GoCardless Bank Account Data overview: https://developer.gocardless.com/bank-account-data/overview
- Enable Banking coverage: https://enablebanking.com/

Important source-backed notes:

- Plaid Transactions supports `/transactions/sync`, transaction webhooks, categories, merchants, balances on associated accounts, and up to 24 months of historical transaction data where institution/product support allows it.
- TrueLayer documents free Sandbox access with no request limit during testing and Data API transaction/account/balance concepts suitable for a UK-first production evaluation.
- Yapily Data Plus categorisation explicitly supports UK and EU geographies, business and consumer accounts, merchant enrichment, payment processor enrichment, and recurrence signals, but requires contractual enablement.
- Tink positions Transactions and Business Transactions as European-scale products with simulated-data onboarding; its pricing page states new prospects should contact sales.
- GoCardless Bank Account Data remains a possible bank-data option, but its current developer surface is less obviously suited to a FounderAgent-style finance intelligence MVP than Plaid sandbox plus TrueLayer/Yapily UK evaluation.

## Provider Decision Table

| Provider | Best fit | Weakness | Sandbox availability | Pricing clarity | UK suitability | US suitability | Europe suitability | Business bank support | Categorisation support | Merchant enrichment | Recommended use case | Score |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Plaid | Fastest sandbox proof, US scale, decent UK/EU coverage, strong docs | UK/EU production usually custom/commercial approval; not the best UK-only SME specialist | Strong sandbox; sandbox API usage is free | Medium; US/Canada clearer, UK/EU custom | Good | Excellent | Medium-good | Available for supported institutions; verify each UK business bank | Personal finance categories, merchant/category fields | Merchant/category data in Transactions/Enrich | First sandbox and abstraction proof | 8.5 |
| TrueLayer | UK/EU Open Banking data and payment UX, strong UK product fit | Data API access and production approval are more compliance/sales-led | Free sandbox, no request limit per help docs | Medium-low; commercial conversation likely | Excellent | Weak | Good | Good UK retail/business fit; verify target banks in Console | Transaction category and merchant name in Data API | Good bank-data enrichment | Best candidate for UK production evaluation | 8.0 |
| Yapily | UK/EU coverage, business and consumer account categorisation, Data Plus enrichment | Enrichment/categorisation requires contract/scope enablement | Available | Medium-low; commercial | Excellent | Weak | Excellent | Explicit business and consumer support in categorisation docs | Strong Data Plus categorisation | Merchant, processor, recurrence enrichment | Strong UK/EU production contender after sandbox | 8.0 |
| Tink | Enterprise European scale, strong enrichment, Visa backing | Business account products are enterprise-only or limited by market; pricing is contact-sales | Account with simulated data available | Low; contact sales/custom | Good | Weak | Excellent | Business accounts supported in some European markets; contact sales | Strong categorisation/data enrichment | Strong merchant information | Later enterprise Europe option | 7.0 |
| GoCardless Bank Account Data | Low-level bank data and Nordigen heritage | New access path is less startup-friendly; rate limits can be tight; enrichment requires contact | Available if portal access granted | Low for new SaaS users | Good | Weak | Good | Depends on institution/access | Base data limited; enriched bank data via sales | Enriched data via sales | Secondary/backup only | 5.5 |
| Enable Banking | Broad Europe PSD2 API, strong data-security positioning | Less obvious UK-first SaaS onboarding and enrichment depth than TrueLayer/Yapily | Available through account flow | Medium-low | Medium | Weak | Excellent | Claims personal and business coverage across Europe | Not primary differentiator | Not primary differentiator | Europe expansion candidate | 6.5 |
| Salt Edge / other aggregators | Broad international aggregation alternatives | More evaluation needed on UK SME coverage, support, pricing, and enrichment | Varies | Varies | Medium | Medium | Good | Varies | Varies | Varies | Backup discovery list | 5.5 |

## Recommendation

Use Plaid sandbox first because it is the fastest way to prove connector flow, accounts, balances, transactions, webhooks/cursors, and canonical normalisation without touching production bank accounts. Do not hardcode the product to Plaid. Evaluate TrueLayer and Yapily next for UK business-bank production fit because FounderAgent's current test company is GBP/UK-oriented and needs SME/business account behaviour.

## Connector Architecture

The branch adds a provider-neutral Open Banking contract:

- `startConsentFlow`
- `exchangeConnectionToken`
- `syncAccounts`
- `syncBalances`
- `syncTransactions`
- `refreshTransactions`
- `disconnect`
- `normaliseTransaction`

Every provider must output:

- Connected institution
- Provider consent
- Connected bank account
- Provider balance
- Provider transaction
- FounderAgent canonical transaction

The canonical transaction then enters the same FounderAgent path used by CSV:

provider transaction -> canonical transaction -> account KPI routing -> categorisation -> reporting treatment -> duplicate detection -> transaction persistence -> dashboard metrics -> source trace

## Database Schema Plan

Migration `022_open_banking_connected_sources.sql` adds:

- `connected_institutions`
- `provider_consents`
- `bank_account_balances`
- `open_banking_sync_jobs`
- `open_banking_sync_logs`

It extends `bank_accounts` with:

- provider
- provider account ID
- connected institution
- provider consent
- account subtype
- available balance
- credit limit
- connection status
- consent expiry
- last synced timestamps
- sync status and error
- KPI routing JSON

It extends `transactions` with:

- source connection ID
- source institution ID
- source sync job ID
- source account provider ID

Raw provider access tokens must not be stored in browser-accessible data. `provider_consents.token_reference` is a reference to a server-side encrypted token store or vault, not the token itself.

## Migration 022 Application Result

Migration `022_open_banking_connected_sources.sql` was applied in the Supabase SQL editor on 2026-06-04 and returned success with no rows.

`npx tsx scripts/verify-schema.ts` now verifies the Open Banking first-class schema directly. Result:

- `connected_institutions`: present
- `provider_consents`: present
- `bank_account_balances`: present
- `open_banking_sync_jobs`: present
- `open_banking_sync_logs`: present
- `bank_accounts` provider, provider account ID, connected institution, consent, account subtype, available balance, credit limit, connection status, consent expiry, last sync, sync status, sync error, and KPI routing columns: present
- `transactions` source connection ID, source institution ID, source sync job ID, and source account provider ID columns: present

Schema verification result: all MUST columns present. Remaining warnings are older SHOULD columns with known metadata fallback (`bank_accounts.account_number`, `bank_accounts.sort_code`, `company_metrics.mrr`) and older `agent_tasks` SHOULD columns not part of this Open Banking scope.

## Security Plan

- Sandbox only in this phase.
- No production Open Banking credentials.
- Provider secrets remain server-side.
- `.env.example` contains placeholders only.
- Token exchange belongs on server routes/actions only.
- Token storage should use encrypted references or Supabase Vault before production.
- Connections, syncs, errors, and disconnects must be audit logged.
- Disconnect/reconnect flow must update consent and account status.

## Connected Account KPI Routing

The branch adds account-level routing for:

- Business current account
- Business savings account
- Business credit card
- Loan account
- Payment processor account
- Manual/unknown accounts

Critical rules:

- Bank transfers do not inflate revenue.
- Savings transfers do not inflate revenue.
- Savings interest can be revenue.
- Credit card repayments reduce debt and do not double count as expenses.
- Credit card purchases can feed expenses.
- Loan principal movement belongs in debt/balance sheet tracking, not normal operating expense.
- Payment processor sales can be richer revenue source.
- Payment processor payouts to bank are settlement movement if processor transactions are already imported.

## Duplicate Prevention Strategy

The existing duplicate detector already handles:

- Same external transaction ID
- Same source file and external ID
- Hash match
- Reference match
- Fuzzy cross-provider match by date, amount, currency, merchant, and different provider

This branch adds source-priority rules:

- Processor transaction detail outranks bank payout summaries for sales data.
- Open Banking bank/card data outranks CSV when both represent the same account transaction.
- CSV remains useful for history and fallback.
- Manual entries have lower priority unless explicitly user-confirmed later.

## Sandbox Implementation Result

Implemented local Plaid-shaped sandbox fixture:

- Consent session creation
- Consent exchange
- Account sync
- Balance sync
- Transaction sync
- Plaid amount sign normalisation
- GBP preservation
- Canonical transaction output
- Account KPI routing
- Reporting treatment
- Source proof as `sourceProvider = plaid`

Proof command:

```bash
npx tsx scripts/prove-open-banking-sandbox.ts --persist
```

Result:

- Accounts synced: 3
- Balances synced: 3
- Provider transactions: 6
- Canonical transactions: 6
- GBP rows: 6
- Revenue rows: 2
- Expense rows: 2
- Transfer rows: 1
- Debt rows: 1
- Duplicate replay result: 0 inserted, 6 duplicates skipped

First-class Supabase proof after migration 022:

- Connected institution rows: 1
- Provider consent rows: 1
- Connected bank account rows: 3
- Balance snapshot rows: 9 after three sandbox sync runs
- Sync job rows: 3
- Sync log rows: 3
- Transaction rows: 6
- Transaction rows with first-class source lineage columns populated: 6
- GBP rows: 6
- Latest sync job status: `succeeded`, `accounts_synced = 3`, `balances_synced = 3`, `transactions_seen = 6`, `transactions_inserted = 0`, `duplicates_skipped = 6`

This does not connect to a live bank account. It does not call Plaid production. It does not require or commit real Plaid secrets.

## Dashboard And Transactions Proof

Sandbox persistence is implemented and proved against Supabase with a Plaid-shaped fixture. After migration 022, connected institution, consent, balance snapshot, sync job, sync log, connected bank account, and transaction source-lineage data persists into first-class tables/columns. Metadata remains only a compatibility fallback, not the primary proof path.

Browser proof, signed-in account, 2026-06-04:

- Data Sources page renders with `Connect Bank Account` as primary and `Upload Statement` as fallback.
- Connected Accounts displays provider, institution, account name, account type, account subtype, currency, current balance, available balance, credit limit, cash-balance inclusion, sync status, last sync, consent expiry, transaction count, duplicate count, and reconnect/disconnect placeholders.
- Rerunning the sandbox source showed duplicate prevention in browser: `3 accounts, 3 balances, 0 inserted, 6 duplicate skipped`.
- Transactions page with `?sourceType=open_banking` showed 6 rows and rendered a compact source badge per row: `Open Banking`, `Plaid`, `Plaid Sandbox Bank`, and the connected account name.
- Transactions filters now include source type, provider, connected account, upload file, and CSV versus Open Banking separation.
- Dashboard showed GBP KPIs and source text including connected rows: `1006 source transactions across 1000 transactions from 3 uploads, 6 connected account transactions`.

Supabase proof for signed-in company `925fc8e0-2d08-4422-a878-14c3872195a7`:

- Connected institution rows: 1
- Provider consent rows: 1
- Connected bank account rows: 3
- Balance snapshots after browser and CLI duplicate reruns: 6
- Sync jobs: 2
- Sync logs: 2
- Plaid transaction rows: 6
- Plaid transaction rows with first-class source lineage: 6
- Currencies: GBP only
- External transaction IDs: `plaid-tx-canva-card-001`, `plaid-tx-card-repayment-001`, `plaid-tx-google-001`, `plaid-tx-interest-001`, `plaid-tx-saving-transfer-001`, `plaid-tx-stripe-001`

Screenshot evidence:

- `/tmp/founderagent-data-sources-migration022-proof.png`
- `/tmp/founderagent-transactions-source-badge-proof.png`
- `/tmp/founderagent-dashboard-migration022-source-proof.png`

KPI routing proof:

- Current account rows feed operating revenue, operating expenses, cash movement, profit and loss, and cash balance according to `getAccountKpiRouting("business_current")`.
- Savings transfers are classified as internal transfers and do not inflate revenue; genuine savings interest can feed revenue.
- Credit card purchases feed expenses, while credit card repayments are debt movement and not operating expenses.
- Loan repayments are debt movement and not operating expenses.
- Payment processor payouts are protected from double counting when a processor feed is the sales source.
- CSV and Open Banking overlap detection skips duplicates instead of inserting another KPI-impacting row.
- Tests covering this are in `src/lib/open-banking/__tests__/kpi-routing.test.ts`, `src/lib/open-banking/__tests__/plaid-sandbox.test.ts`, `src/lib/open-banking/__tests__/sandbox-sync.test.ts`, `src/lib/db/__tests__/bank-accounts.test.ts`, and `src/lib/reporting/__tests__/treatment-engine.test.ts`.

## CSV Fallback Regression Proof

CSV remains intact as fallback. The real 694-row Revolut Business file was rerun after the Open Banking work:

- File: `references/account-statement_01-Jan-2026_24-May-2026.csv`
- First upload: 694 rows inserted, 0 failed, 0 duplicates
- Duplicate replay: 0 inserted, 694 duplicate skipped
- Currency: GBP
- KPI proof: revenue `78356.69`, expenses `76088.90`, net profit `2267.79`
- Promoted CSV proof columns present for all 694 rows: posted date, fee amount, running balance
- Duplicate replay preserved KPI integrity: 0 rows inserted, 694 duplicate row outcomes, no KPI corruption.

## Performance Foundation

Performance is now a foundation concern, not a polish task. The current branch establishes the direction but does not claim full route performance remediation yet.

Browser timing pass on local dev server, signed-in session, 2026-06-04:

| Route | Warm timing observed | Status |
| --- | ---: | --- |
| `/upload-centre` | 2.06s | Loads correctly, above 1s target |
| `/dashboard?preset=allTime` | 5.53s | Loads correctly, materially above 1.5s target |
| `/transactions?preset=allTime` | 3.28s | Loads correctly, above 1.5s target; page text payload is very large |
| `/subscriptions?preset=allTime` | 0.73s | Within target |
| `/alerts?preset=allTime` | 0.87s | Improved versus prior multi-second concern in this dev pass |
| `/ai-insights?preset=allTime` | 0.91s | Within target in this dev pass |

Immediate performance targets:

- Upload Centre/Data Sources under 1 second warm
- Subscriptions under 1 second warm
- Transactions under 1.5 seconds for paginated all-time
- Dashboard under 1.5 seconds where possible
- Alerts improved from multi-second load

Likely performance work:

- Reduce sequential Supabase queries in dashboard pages.
- Avoid full-table transaction reads for dashboard summaries.
- Cache or pre-aggregate common KPI windows.
- Keep transaction and upload-detail pagination.
- Avoid loading hidden panels and large drawer payloads until needed.
- Add route timing scripts to CI-style QA.
- Add a paginated KPI drilldown data loader. Dashboard source counts now use audited source-status counts, but transaction arrays still hit Supabase's default 1,000-row return ceiling when loaded with a plain select.

## Commands Run

```bash
npx vitest run src/lib/open-banking/__tests__ src/lib/db/__tests__/data-source.test.ts src/lib/db/__tests__/bank-accounts.test.ts
npx tsx scripts/prove-open-banking-sandbox.ts --persist --company-id aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa
npm run lint
npm test
npm run build
npx tsx scripts/verify-schema.ts
npx tsx scripts/audit-secrets.ts
npx tsx scripts/prove-open-banking-sandbox.ts --persist
npx tsx scripts/prove-reconciliation-694.ts --reset
npx tsx scripts/test-provider-detection.ts
npx tsx scripts/test-unified-parser.ts
git diff --check
```

Results:

- Focused tests: 7 files passed, 30 tests passed
- Full tests: 36 files passed, 461 tests passed
- Lint: passed
- Build: passed, with existing Next.js `middleware` deprecation warning
- 694-row CSV proof: passed
- Open Banking sandbox persistence proof: passed with first-class migration-022 tables/columns
- Duplicate Open Banking sync proof: passed, 0 inserted and 6 skipped
- Schema verification: all MUST columns present, including migration 022 Open Banking tables and lineage columns
- Secret audit: passed

## Known Limitations

- No live Open Banking connection is enabled.
- No production provider approval has been requested.
- No real Plaid/TrueLayer/Yapily credentials are committed.
- `Connect Bank Account` is still a sandbox foundation control, not a live production bank connection.
- Reconnect and disconnect controls are placeholders only.
- Token storage still needs encrypted provider token references or Supabase Vault before production.
- Provider webhooks and real cursor refresh are not enabled.
- Dashboard KPI source counts now include connected rows, but full KPI drilldown row loading still needs a paginated source-backed loader beyond the current 1,000-row select ceiling.
- Route performance is measured and documented but not fully remediated in this branch.
- Stripe, PayPal, Shopify, and other future integrations are represented as source model targets only; live integrations are not implemented here.
- P4 AI reasoning and P5 agentic actions are intentionally not included.

## Next Steps

1. Replace the fixture button with server-only Plaid sandbox token exchange endpoints.
2. Store token references using encrypted storage or Supabase Vault.
3. Add provider webhooks and cursor refresh jobs for sandbox.
4. Implement reconnect and disconnect status flows.
5. Add paginated KPI drilldown loaders so Dashboard explanations can show every source row behind each KPI without a 1,000-row ceiling.
6. Evaluate TrueLayer and Yapily with UK business-bank sandbox/production criteria before live launch.
7. Continue performance remediation against the documented route targets.

Do not claim production readiness from this phase.
