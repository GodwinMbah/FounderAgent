# FounderAgent — Full Functional QA Report
**Auditor:** Riley (QA Integration & Testing)  
**Date:** 2026-05-28 (Global Reporting Consistency Phase)  
**Build:** ✅ Pass (23 routes, 0 TS errors, 0 ESLint errors, 0 warnings)  
**Tests:** 56/56 Playwright tests passing across 5 viewports  
**Test User:** `demo@acmelabs.com` / `Demo1234!`  
**Demo Company:** `aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa` (Acme Labs)

---

## ✅ Global Reporting Consistency Phase — Completed Items

### Phase 1: Date Picker Expansion
| Page | Has DateRangePicker | Default Preset | Server Refetch | URL Params |
|------|---------------------|----------------|----------------|------------|
| Dashboard | ✅ | `last30` | ✅ | ❌ |
| Transactions | ✅ | `allTime` | ❌ (client filter) | ❌ |
| **Revenue** | ✅ NEW | `thisYear` | ✅ | ✅ |
| **Expenses** | ✅ NEW | `thisYear` | ✅ | ✅ |
| **Cash Flow** | ✅ NEW | `last12` | ✅ | ✅ |
| **Runway** | ✅ NEW | `last12` | ✅ | ✅ |
| **P&L Report** | ✅ NEW | `thisYear` | ✅ | ✅ |
| **Budgets** | ✅ NEW | `thisMonth` | ✅ | ✅ |
| Reports | ❌ (entity list) | — | — | — |
| Subscriptions | ❌ (entity list) | — | — | — |
| Alerts | ❌ (entity list) | — | — | — |
| AI Insights | ❌ (entity list) | — | — | — |
| Agent Tasks | ❌ (entity list) | — | — | — |

**New preset added:** `last12` (last 12 months) to `src/lib/date-range.ts`

### Phase 2: Central Reporting Service (`src/lib/reporting/`)
| File | Purpose |
|------|---------|
| `filters.ts` | `isTransfer()`, `isIncome()`, `isExpense()` — canonical rules |
| `aggregates.ts` | `groupByCategory()`, `sumByMonth()` — reusable aggregation |
| `kpis.ts` | `calculateChangePercent()`, `profitMargin()`, `monthlyBurn()`, `runwayMonths()` |
| `subscriptions.ts` | `normalizeSubscriptionSpend()`, `toMonthly()` |
| `index.ts` | Barrel export |

**DB modules now use shared functions:**
- `src/lib/db/metrics.ts` — uses `isIncome`/`isExpense` for transfer exclusion
- `src/lib/db/company-metrics.ts` — uses `isIncome`/`isExpense`, `normalizeSubscriptionSpend`, `profitMargin`, `monthlyBurn`, `runwayMonths`
- All 6 reporting client components import `calculateChangePercent` from `reporting/kpis`

### Phase 3: KPI Audit — Zero Hardcoded Values
| Page | Before | After |
|------|--------|-------|
| Revenue | `+50.8% YTD`, `+15% vs Jan` | Real MoM change from `monthlyMetrics` |
| Expenses | No change shown | Real MoM expense change |
| Cash Flow | `+12.5%`, `+3.2%`, `+18.1%` | Real MoM cash in/out/net changes |
| Runway | `+3.2% vs last month` | Real MoM burn change |
| P&L | `+12.5%`, `+3.2%`, `+18.1%`, `+4.3%` | Real MoM revenue/expense/profit/margin changes |
| Reports | `needsReview: 0` (hardcoded) | Counts `status === "draft" \|\| "needs_review"` |

### Phase 4: Mobile Card Layouts
| Page | Component | Mobile State |
|------|-----------|-------------|
| **Transactions** | DataTable → cards added | ✅ `.sm:hidden` card list with merchant, date, amount, category, status, confidence |
| **Alerts** | DataTable → cards added | ✅ `.sm:hidden` card list with severity dot, title, description, category, status |
| **Reports** | DataTable → cards added | ✅ `.sm:hidden` card list with name, type, date, status, size |
| Dashboard | Charts + cards | ✅ Already responsive |
| Subscriptions | Custom flex rows | ✅ Already responsive |
| Agent Tasks | Custom cards | ✅ Already responsive |
| Expenses | Custom list | ✅ Already responsive |
| Revenue | Custom cards | ✅ Already responsive |
| Runway | Custom cards | ✅ Already responsive |

### Phase 5: AI Insights Readiness
- `fetchContextForIntent()` now accepts optional `fromDate`/`toDate` parameters
- Added `financial_summary` intent with keyword detection (`summary`, `overview`, `financial health`, `how are we doing`)
- New `buildCompanyContext(companyId, from?, to?)` exports structured LLM-ready context object
- Revenue query now uses the provided date range instead of hardcoded YTD

### Phase 6: Cache & Pipeline Fixes
- **Pipeline 30d recalculation:** `src/lib/upload/pipeline.ts` now recalculates `30d` cache after every upload (fixes stale cache on dashboard default view)
- **Dead code removed:** `src/lib/hooks/useDashboardData.ts` deleted (legacy hook with hardcoded mock data)

---

## ✅ Build & Tooling
| Item | Status |
|------|--------|
| `npm run build` | ✅ Pass — 23 routes, 0 TypeScript errors |
| `npm run lint` | ✅ Pass — 0 errors, 0 warnings |
| `npx playwright test` | ✅ 56/56 passing (2.8 min) |

## ✅ Security (10-point audit)
| # | Check | Status |
|---|-------|--------|
| 1 | No hardcoded company IDs in app logic | ✅ Pass |
| 2 | No service role key in frontend/client code | ✅ Pass |
| 3 | All DB query functions accept and use `companyId` | ✅ Fixed |
| 4 | All pages use `requireAuthCompany()` | ✅ Pass (14/14 dashboard pages) |
| 5 | No async client components | ✅ Pass |
| 6 | Onboarding properly gates access | ✅ Pass |
| 7 | Middleware handles auth redirects | ✅ Pass |
| 8 | RLS policies exist for all 12 tables | ✅ Pass |
| 9 | No SQL injection vectors | ✅ Pass |
| 10 | Audit logging present for sensitive ops | ⚠️ Partial (see risks) |

---

## ✅ Working Flows

### 1. Authentication
- `/login` → authenticate with demo user → middleware redirects to `/dashboard`
- `/signup` → creates auth user → onboarding collects company info
- `/onboarding` → creates company + profile + membership → sets cookie → redirects to dashboard

### 2. Dashboard (`/dashboard`)
- Loads real metrics from Supabase with `last30` default date range
- Date picker changes trigger server refetch of metrics, monthly metrics, and transactions
- Top expenses computed from filtered transactions with transfer exclusion
- Real MoM change percentages computed from monthly metrics

### 3. Reporting Pages (All with Date Pickers)
- **Revenue** (`/revenue`) — Default `thisYear`, interactive date picker, real MoM growth
- **Expenses** (`/expenses`) — Default `thisYear`, interactive date picker, real category breakdown
- **Cash Flow** (`/cash-flow`) — Default `last12`, real cash in/out/net with MoM changes
- **Runway** (`/runway`) — Default `last12`, real burn trend with scenario analysis
- **P&L** (`/pl-report`) — Default `thisYear`, real revenue/expense/profit/margin with MoM changes
- **Budgets** (`/budgets`) — Default `thisMonth`, budget vs actual chart, over-budget alerts

### 4. Transactions (`/transactions`)
- All-time transaction list with date picker (client-side filter)
- Mobile card layout for <640px viewports
- Search, type filter, category filter, sort

### 5. AI Assistant Drawer
- `processAssistantMessage()` server action with `requireAuthCompany()`
- `detectIntent()` covers: cash flow, runway, subscriptions, budgets, transactions, revenue, agent tasks, financial summary
- `fetchContextForIntent()` now supports custom date ranges
- `buildCompanyContext()` prepares structured LLM-ready data

### 6. Upload Pipeline
- Full CSV → canonical → normalized → categorized → insert flow
- Transfer detection, duplicate detection, anomaly detection
- Subscription detection with historical data merging
- **Metric recalculation** for month, quarter, year, all, and **30d** periods
- `revalidatePath()` called for all major routes

---

## ⚠️ Remaining Risks

| Risk | Severity | Location | Mitigation |
|------|----------|----------|------------|
| Agent Tasks page buttons are non-functional | **Medium** | `agent-tasks/content.tsx` | Buttons have no `onClick` bound. Users cannot trigger tasks from the UI. |
| AI Drawer shows fake tasks in empty state | **Low** | `AssistantDrawer.tsx` | `mockTasks` array is hardcoded decorative UI. Does not affect functional task creation via chat. |
| Settings page hardcodes Role & Tax Region | **Low** | `SettingsClient.tsx` | Role shows `"CEO / Founder"`, tax region shows `"United States"` regardless of actual data. |
| `createAgentTask` lacks auth guard | **Low** | `src/lib/db/agent-tasks.ts` | Function accepts any `companyId`. Mitigation: only called via `triggerAgentTask()` which validates auth. |
| Middleware uses cookie heuristics | **Low** | `src/middleware.ts` | Checks cookie names rather than validating JWT. Acceptable for middleware layer but could be hardened. |
| Audit log INSERT requires admin client | **Low** | `agent_activity_logs` RLS | RLS policy is SELECT-only. Audit inserts bypass RLS via `createAdminClient()`. Intentional but should be documented. |

---

## 📋 Known Limitations

1. **No accounts table** — Cash balance is derived from `revenue - expenses` rather than a true bank account balance. When an `accounts` table is added, `getDashboardMetrics()` should query it.
2. **Agent task types limited** — Only 4 task types have deterministic implementations. Others return "not yet implemented".
3. **CSV parser supports bank + processor CSVs** — Stripe, PayPal, Square, GoCardless, Shopify parsers are architected but may need refinement.
4. **AI uses deterministic responses** — No LLM integration yet. `OpenAILLM` class exists but returns a placeholder. Add `OPENAI_API_KEY` to enable.
5. **No email/Slack notifications** — Agent alerts are in-app only.
6. **No scheduled recurring tasks** — Agent tasks must be triggered manually or via chat.

---

## 🚀 Recommended Next Build Phase

### Phase 7: Agent Task UI Wiring & Real-time Features
**Goal:** Make every interactive element functional. Add real-time capabilities.

1. **Wire Agent Tasks page buttons**
   - Bind "Run Task" button to `triggerAgentTask(companyId, taskType)` server action
   - Show task execution status in real-time

2. **Replace AI Drawer mockTasks**
   - Pass real recent tasks as prop or fetch on drawer open

3. **Settings page real data**
   - Query actual user role from `company_members`
   - Query actual tax region from `companies.settings`

4. **OpenAI integration**
   - Wire `OPENAI_API_KEY` to `OpenAILLM.generate()`
   - Add streaming responses to AI Drawer

5. **Scheduled recurring tasks**
   - Weekly scans, monthly reports via cron/edge function

---

## 📝 Files Modified in This Phase

### New Files
- `src/lib/reporting/filters.ts` — Canonical transaction filters
- `src/lib/reporting/aggregates.ts` — Category/month aggregation utilities
- `src/lib/reporting/kpis.ts` — Change percent, profit margin, burn, runway
- `src/lib/reporting/subscriptions.ts` — Subscription normalization
- `src/lib/reporting/index.ts` — Barrel export

### Modified Pages (Date Picker + Server Refetch)
- `src/app/(dashboard)/revenue/page.tsx` — Added searchParams, URL date range support
- `src/app/(dashboard)/revenue/content.tsx` — DateRangePicker + real MoM changes
- `src/app/(dashboard)/expenses/page.tsx` — Added searchParams
- `src/app/(dashboard)/expenses/content.tsx` — DateRangePicker + real MoM changes
- `src/app/(dashboard)/cash-flow/page.tsx` — Added searchParams
- `src/app/(dashboard)/cash-flow/CashFlowClient.tsx` — DateRangePicker + real MoM changes
- `src/app/(dashboard)/runway/page.tsx` — Added searchParams
- `src/app/(dashboard)/runway/RunwayClient.tsx` — DateRangePicker + real MoM changes
- `src/app/(dashboard)/pl-report/page.tsx` — Added searchParams
- `src/app/(dashboard)/pl-report/PLReportClient.tsx` — DateRangePicker + real MoM changes
- `src/app/(dashboard)/budgets/page.tsx` — Added searchParams
- `src/app/(dashboard)/budgets/BudgetsClient.tsx` — DateRangePicker + dynamic budget stats

### Modified for Mobile Cards
- `src/app/(dashboard)/transactions/content.tsx` — Added `.sm:hidden` mobile card layout
- `src/app/(dashboard)/alerts/AlertsClient.tsx` — Added `.sm:hidden` mobile card layout
- `src/app/(dashboard)/reports/ReportsClient.tsx` — Added `.sm:hidden` mobile card layout + fixed `needsReview`

### Modified DB / Core
- `src/lib/date-range.ts` — Added `last12` preset
- `src/lib/db/metrics.ts` — Uses `isIncome`/`isExpense` from reporting
- `src/lib/db/company-metrics.ts` — Uses reporting functions, added `type` to burn query
- `src/lib/ai/data.ts` — Added date range params, `financial_summary` intent, `buildCompanyContext()`
- `src/lib/ai/intent.ts` — Added `financial_summary` to IntentType + detection
- `src/lib/upload/pipeline.ts` — Added 30d cache recalculation

### Modified Dashboard
- `src/app/(dashboard)/dashboard/content.tsx` — Uses `calculateChangePercent` and `isExpense` from reporting

### Deleted
- `src/lib/hooks/useDashboardData.ts` — Dead code (legacy hook with hardcoded mock data)
