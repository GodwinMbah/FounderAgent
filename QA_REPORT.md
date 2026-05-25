# FounderAgent — Full Functional QA Report
**Auditor:** Riley (QA Integration & Testing)  
**Date:** 2026-05-24  
**Build:** ✅ Pass (23 routes, 0 TS errors, 0 ESLint errors)  
**Test User:** `demo@acmelabs.com` / `Demo1234!`  
**Demo Company:** `aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa` (Acme Labs)

---

## ✅ Completed Items

### Build & Tooling
| Item | Status |
|------|--------|
| `npm run build` | ✅ Pass — 23 routes compiled, 0 TypeScript errors |
| `npx tsc --noEmit` | ✅ Pass |
| `npm run lint` | ✅ Pass — 0 errors, 20 warnings (all unused vars) |

### Security (10-point audit)
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

### Critical Fixes Applied
| Issue | File | Fix |
|-------|------|-----|
| IDOR: `runAgentTask()` executed any company's task | `src/lib/agent/runner.ts` | Added `requireAuthCompany()` + company validation |
| IDOR: `updateAgentTaskStatus()` updated any task by ID | `src/lib/db/agent-tasks.ts` | Added `companyId` param + `.eq("company_id", companyId)` filter |
| IDOR: `createAgentRecommendation()` accepted any companyId | `src/lib/db/agent-recommendations.ts` | Added `getActiveCompanyForUser()` auth check |
| Runtime: setState in effect caused cascading renders | `dashboard/content.tsx`, `AgentOrb.tsx`, `useAuth.ts` | Replaced with direct computation or init-state pattern |
| Runtime: Variable reassignment in render | `DonutChart.tsx`, `SimpleChart.tsx` | Replaced `let` mutation with precomputed `offsets` array |
| Silent failure: Empty CSV uploads marked "completed" | `src/lib/upload/processor.ts` | Now throws error if CSV has ≥2 lines but 0 parseable transactions |
| Mock data fallbacks in all DB getters | 9 files in `src/lib/db/` | Removed all `getMock*()` fallbacks — now throw proper errors |
| Hardcoded `cashBalance: $127,340.50` | `src/lib/db/metrics.ts` | Replaced with derived `revenue - expenses` |

### Data Integrity Verified
| Table | Rows | Company-Scoped |
|-------|------|----------------|
| transactions | 14 | ✅ |
| subscriptions | 10 | ✅ |
| budgets | 6 | ✅ |
| alerts | 6 | ✅ |
| reports | 7 | ✅ |
| agent_tasks | 6 | ✅ |
| agent_recommendations | 5 | ✅ |
| uploads | 4 | ✅ |

---

## ✅ Working Flows

### 1. Authentication
- `/login` → authenticate with demo user → middleware redirects to `/dashboard`
- `/signup` → creates auth user → onboarding collects company info
- `/onboarding` → creates company + profile + membership → sets cookie → redirects to dashboard

### 2. Dashboard (`/dashboard`)
- Loads real metrics from Supabase: `$2,446.10` subscriptions, `$16,050` revenue, `-$206.20` net profit
- Monthly metrics grouped by transaction dates
- Top expenses, active alerts, subscription preview all from real data

### 3. All Sidebar Pages
Every page is an async server component that calls `requireAuthCompany()` and passes `companyId` to DB functions:
- `/transactions` — real transaction list with filters
- `/subscriptions` — real subscription list + stats
- `/revenue` — real income transactions + monthly metrics
- `/expenses` — real expense transactions
- `/cash-flow`, `/runway`, `/pl-report` — derived from real transaction data
- `/budgets`, `/alerts`, `/reports` — real table data
- `/agent-tasks` — real task list + stats
- `/upload-centre` — real upload list + drag-drop CSV upload
- `/settings` — real company profile

### 4. AI Assistant Drawer
- `processAssistantMessage()` is a server action with `requireAuthCompany()`
- `detectIntent()` covers: runway, expenses, subscriptions, cash flow, revenue, budgets, transactions, agent tasks
- `fetchContextForIntent()` queries real tables with `companyId`
- `generateResponse()` produces natural language from live data
- `createTaskFromChat()` creates real `agent_tasks` rows

### 5. Upload Pipeline
- `uploadStatement()` server action → Supabase Storage (`${companyId}/${uuid}`)
- `processUpload()` downloads file → detects CSV source → `parseBankCsv()`
- `parseBankCsv()` normalizes dates (YYYY-MM-DD), amounts, income/expense detection
- Inserts transactions with `company_id` + `upload_id`
- Upload record updated with `status: "completed"` and `transaction_count`
- **Fails explicitly** if CSV has content but no parseable transactions

### 6. Agent Task Execution
- `triggerAgentTask()` creates task with `company_id`
- `runAgentTask()` validates caller owns the task before executing
- Supported tasks: `review_renewals`, `find_cheaper_alternatives`, `detect_duplicate_subscriptions`, `flag_wasteful_spending`
- Creates real `agent_recommendations` with `company_id`
- Updates task status lifecycle: `pending → running → completed/failed`

---

## ⚠️ Remaining Risks

| Risk | Severity | Location | Mitigation |
|------|----------|----------|------------|
| Agent Tasks page buttons are non-functional | **Medium** | `agent-tasks/content.tsx:94-134` | Buttons have no `onClick` or server action bound. Users cannot trigger tasks from the UI. |
| AI Drawer shows fake tasks in empty state | **Low** | `AssistantDrawer.tsx:32-37` | `mockTasks` array is hardcoded decorative UI. Does not affect functional task creation via chat. |
| Dashboard KPI % changes are hardcoded | **Low** | `dashboard/content.tsx` | Change percentages (e.g., `+12.4%`) are static strings, not computed from historical data. |
| Settings page hardcodes Role & Tax Region | **Low** | `SettingsClient.tsx` | Role shows `"CEO / Founder"`, tax region shows `"United States"` regardless of actual data. |
| `createAgentTask` lacks auth guard | **Low** | `src/lib/db/agent-tasks.ts:51` | Function accepts any `companyId`. Mitigation: only called via `triggerAgentTask()` which validates auth. |
| Middleware uses cookie heuristics | **Low** | `src/middleware.ts` | Checks cookie names rather than validating JWT. Acceptable for middleware layer but could be hardened. |
| Audit log INSERT requires admin client | **Low** | `agent_activity_logs` RLS | RLS policy is SELECT-only. Audit inserts bypass RLS via `createAdminClient()`. This is intentional but should be documented. |
| `upload-centre` useCallback dependency warning | **Low** | `UploadCentreClient.tsx:52` | `handleSubmit` causes exhaustive-deps warning. Non-breaking but should be refactored. |

---

## 📋 Known Limitations

1. **No accounts table** — Cash balance is derived from `revenue - expenses` rather than a true bank account balance. When an `accounts` table is added, `getDashboardMetrics()` should query it.
2. **Agent task types limited** — Only 4 task types have deterministic implementations. Others (`forecast_runway`, `identify_revenue_growth`, `create_cost_reduction_plan`, etc.) return "not yet implemented".
3. **CSV parser only supports bank CSV** — Stripe, PayPal, QuickBooks, Xero parsers are architected but not implemented.
4. **AI uses deterministic responses** — No LLM integration yet. `OpenAILLM` class exists but returns a placeholder. Add `OPENAI_API_KEY` to enable.
5. **No email/Slack notifications** — Agent alerts are in-app only.
6. **No scheduled recurring tasks** — Agent tasks must be triggered manually or via chat.

---

## 🚀 Recommended Next Build Phase

### Phase 6: Functional Polish & Agent Task UI Wiring
**Goal:** Make every interactive element functional. No dead buttons.

1. **Wire Agent Tasks page buttons**
   - Bind "Run Task" button to `triggerAgentTask(companyId, taskType)` server action
   - Bind suggested task buttons to create + run tasks
   - Show task execution status in real-time

2. **Replace AI Drawer mockTasks**
   - Pass real recent tasks as prop or fetch on drawer open
   - Show last 3-5 agent tasks with actual status

3. **Compute real KPI changes**
   - Compare current month vs previous month for revenue, expenses, subscriptions
   - Replace hardcoded `+12.4%` strings with live calculations

4. **Settings page real data**
   - Query actual user role from `company_members`
   - Query actual tax region from `companies.settings`

5. **Add more CSV parsers**
   - Implement Stripe payout CSV parser
   - Implement PayPal transaction CSV parser

6. **OpenAI integration**
   - Wire `OPENAI_API_KEY` to `OpenAILLM.generate()`
   - Add streaming responses to AI Drawer

---

## 📝 Files Modified in This QA Pass

- `src/lib/db/agent-tasks.ts` — Added auth guards, removed mock fallbacks
- `src/lib/db/agent-recommendations.ts` — Added auth guards, removed mock fallbacks
- `src/lib/db/transactions.ts` — Removed mock fallbacks
- `src/lib/db/subscriptions.ts` — Removed mock fallbacks
- `src/lib/db/alerts.ts` — Removed mock fallbacks
- `src/lib/db/budgets.ts` — Removed mock fallbacks
- `src/lib/db/reports.ts` — Removed mock fallbacks
- `src/lib/db/uploads.ts` — Removed mock fallbacks
- `src/lib/db/metrics.ts` — Removed mock fallbacks, fixed const reassignment, derived cashBalance
- `src/lib/agent/runner.ts` — Added `requireAuthCompany()` + company validation
- `src/lib/upload/processor.ts` — Added empty-CSV failure check
- `src/lib/auth.ts` — Fixed `any` type
- `src/lib/ai/llm.ts` — Typed `data` parameter
- `src/lib/ai/responder.ts` — Typed `data` parameter, fixed `any` in filter/reduce
- `src/lib/categorisation.ts` — Added `UserCategoryRule` interface, fixed `any`
- `src/lib/data.ts` — Typed `recentTransactions`
- `src/lib/hooks/useAuth.ts` — Fixed setState in effect
- `src/app/onboarding/actions.ts` — Fixed `catch (error: any)`
- `src/app/(dashboard)/dashboard/content.tsx` — Fixed setState in effect, removed unused imports
- `src/app/(dashboard)/cash-flow/CashFlowClient.tsx` — Fixed `any` types
- `src/app/(dashboard)/expenses/content.tsx` — Fixed `any` types
- `src/app/(dashboard)/revenue/content.tsx` — Fixed `any` types
- `src/app/(dashboard)/runway/RunwayClient.tsx` — Fixed `any` types
- `src/app/(dashboard)/pl-report/PLReportClient.tsx` — Fixed `any` types
- `src/components/AgentOrb.tsx` — Fixed setState in effect
- `src/components/ui/DonutChart.tsx` — Fixed variable reassignment in render
- `src/components/ui/SimpleChart.tsx` — Fixed variable reassignment in render
- `src/app/login/page.tsx` — Fixed unescaped apostrophe
