# FounderAgent — Comprehensive Data Flow Audit Report
**Auditor:** Riley (QA Integration & Testing Agent)  
**Date:** 2026-05-23  
**Scope:** All 15 dashboard routes + 4 specific integration flows

---

## Executive Summary

| Category | Count | Status |
|----------|-------|--------|
| Routes audited | 15 | ✅ Complete |
| Async server component pages | 15/15 | ✅ Pass |
| Uses `requireAuthCompany()` | 15/15 | ✅ Pass |
| Passes `companyId` to DB layer | 15/15 | ✅ Pass |
| DB uses `.eq('company_id', ...)` | 15/15 | ✅ Pass |
| No mock data fallback | 0/15 | ❌ **Fail** — All routes fall back to mocks |
| Hardcoded values detected | 3 routes | ⚠️ Warning |
| Missing auth guards (internal fns) | 3 functions | ⚠️ Warning |
| Data type mismatches | 4 issues | ⚠️ Warning |

---

## 1. Route-by-Route Data Flow Traces

### 1. /dashboard
```
DashboardPage (async SC)
  └─→ requireAuthCompany() → { companyId }
  ├─→ getDashboardMetrics(companyId)
  │     └─→ supabase.from("transactions").select(...).eq("company_id", companyId)
  │     └─→ supabase.from("subscriptions").select(...).eq("company_id", companyId)
  │     ⚠️ Falls back to getMockDashboardMetrics() if !supabase OR table missing (42P01)
  │     ⚠️ cashBalance: 127340.50 is HARDCODED
  ├─→ getMonthlyMetrics(companyId)
  │     └─→ supabase.from("transactions").eq("company_id", companyId)
  │     ⚠️ Falls back to getMockMonthlyMetrics()
  ├─→ getSubscriptions(companyId)
  │     └─→ supabase.from("subscriptions").eq("company_id", companyId)
  │     ⚠️ Falls back to getMockSubscriptions()
  ├─→ getAlerts(companyId)
  │     └─→ supabase.from("alerts").eq("company_id", companyId)
  │     ⚠️ Falls back to getMockAlerts()
  ├─→ getTransactions(companyId)
  │     └─→ supabase.from("transactions").eq("company_id", companyId)
  │     ⚠️ Falls back to getMockTransactions()
  └─→ <DashboardContent metrics monthlyMetrics subscriptions alerts topExpenses />
        ⚠️ KPI change percentages are HARDCODED ("+12.4%", "+12.5%", etc.)
```
**Verdict:** ✅ Auth & scoping correct. ❌ Mock fallback on every getter. ❌ Hardcoded cashBalance.

---

### 2. /transactions
```
TransactionsPage (async SC)
  └─→ requireAuthCompany() → { companyId }
  ├─→ getTransactions(companyId)
  │     └─→ .eq("company_id", companyId) ✅
  │     ⚠️ Falls back to getMockTransactions()
  └─→ getTransactionStats(companyId)
        └─→ delegates to getTransactions(companyId) ✅
  └─→ <TransactionsContent transactions stats />
```
**Verdict:** ✅ Auth & scoping correct. ❌ Mock fallback in getter.

---

### 3. /subscriptions
```
SubscriptionsPage (async SC)
  └─→ requireAuthCompany() → { companyId }
  ├─→ getSubscriptions(companyId)
  │     └─→ .eq("company_id", companyId) ✅
  │     ⚠️ Falls back to getMockSubscriptions()
  └─→ getSubscriptionStats(companyId)
        └─→ delegates to getSubscriptions(companyId) ✅
  └─→ <SubscriptionsContent subscriptions stats />
```
**Verdict:** ✅ Auth & scoping correct. ❌ Mock fallback in getter.

---

### 4. /revenue
```
RevenuePage (async SC)
  └─→ requireAuthCompany() → { companyId }
  ├─→ getTransactions(companyId) ✅
  └─→ getMonthlyMetrics(companyId) ✅
  └─→ <RevenueContent transactions monthlyMetrics />
```
**Verdict:** ✅ Auth & scoping correct. ❌ Mock fallback in both getters.

---

### 5. /expenses
```
ExpensesPage (async SC)
  └─→ requireAuthCompany() → { companyId }
  ├─→ getTransactions(companyId) ✅
  └─→ getMonthlyMetrics(companyId) ✅
  └─→ <ExpensesContent transactions monthlyMetrics />
```
**Verdict:** ✅ Auth & scoping correct. ❌ Mock fallback in both getters.

---

### 6. /cash-flow
```
CashFlowPage (async SC)
  └─→ requireAuthCompany() → { companyId }
  ├─→ getMonthlyMetrics(companyId) ✅
  └─→ getTransactions(companyId) ✅
  └─→ <CashFlowClient monthlyMetrics transactions />
```
**Verdict:** ✅ Auth & scoping correct. ❌ Mock fallback in both getters.

---

### 7. /runway
```
RunwayPage (async SC)
  └─→ requireAuthCompany() → { companyId }
  ├─→ getDashboardMetrics(companyId) ✅
  └─→ getMonthlyMetrics(companyId) ✅
  └─→ <RunwayClient metrics monthlyMetrics />
```
**Verdict:** ✅ Auth & scoping correct. ❌ Mock fallback in both getters. ❌ Hardcoded cashBalance in metrics.

---

### 8. /pl-report
```
PLReportPage (async SC)
  └─→ requireAuthCompany() → { companyId }
  ├─→ getMonthlyMetrics(companyId) ✅
  └─→ getTransactions(companyId) ✅
  └─→ <PLReportClient monthlyMetrics transactions />
```
**Verdict:** ✅ Auth & scoping correct. ❌ Mock fallback in both getters.

---

### 9. /budgets
```
BudgetsPage (async SC)
  └─→ requireAuthCompany() → { companyId }
  ├─→ getTransactions(companyId) ✅
  ├─→ getBudgets(companyId)
  │     └─→ .eq("company_id", companyId) ✅
  │     ⚠️ Falls back to getMockBudgets()
  └─→ getBudgetStats(companyId, transactions) ✅
  └─→ <BudgetsClient totalBudget spent remaining percentUsed categories alerts />
```
**Verdict:** ✅ Auth & scoping correct. ❌ Mock fallback in getter.

---

### 10. /alerts
```
AlertsPage (async SC)
  └─→ requireAuthCompany() → { companyId }
  ├─→ getAlerts(companyId)
  │     └─→ .eq("company_id", companyId).eq("is_dismissed", false) ✅
  │     ⚠️ Falls back to getMockAlerts()
  └─→ maps alerts → mappedAlerts
  └─→ <AlertsClient alertsData criticalCount warningCount infoCount resolvedCount />
```
**Verdict:** ✅ Auth & scoping correct. ❌ Mock fallback in getter. ⚠️ `severity` cast excludes "resolved" from DB enum.

---

### 11. /reports
```
ReportsPage (async SC)
  └─→ requireAuthCompany() → { companyId }
  ├─→ getReports(companyId)
  │     └─→ .eq("company_id", companyId) ✅
  │     ⚠️ Falls back to getMockReports()
  └─→ maps reports → reportsData
  └─→ <ReportsClient reportsData />
        ⚠️ Status cast as "ready" | "generating" — misses "draft" and "archived" from DB enum
```
**Verdict:** ✅ Auth & scoping correct. ❌ Mock fallback in getter. ⚠️ Status type mismatch.

---

### 12. /agent-tasks
```
AgentTasksPage (async SC)
  └─→ requireAuthCompany() → { companyId }
  ├─→ getAgentTasks(companyId)
  │     └─→ .eq("company_id", companyId) ✅
  │     ⚠️ Falls back to getMockAgentTasks()
  └─→ getAgentTaskStats(companyId) ✅
  └─→ <AgentTasksContent tasks stats />
```
**Verdict:** ✅ Auth & scoping correct. ❌ Mock fallback in getter.

---

### 13. /ai-insights
```
AIInsightsPage (async SC)
  └─→ requireAuthCompany() → { companyId }
  ├─→ getAgentRecommendations(companyId)
  │     └─→ .eq("company_id", companyId) ✅
  │     ⚠️ Falls back to getMockAgentRecommendations()
  └─→ getAgentTasks(companyId) ✅
  └─→ Renders UI directly (no separate Content component)
        ⚠️ Maps rec.category to priority logic — "cost_saving" | "growth" → "opportunity",
            "efficiency" → "info", everything else → "info"
        ⚠️ task.priority "high" | "medium" → "warning", else "info"
```
**Verdict:** ✅ Auth & scoping correct. ❌ Mock fallback in getter. ⚠️ Renders directly instead of delegating to Content component (minor pattern deviation).

---

### 14. /upload-centre
```
UploadCentrePage (async SC)
  └─→ requireAuthCompany() → { companyId }
  ├─→ getUploads(companyId)
  │     └─→ .eq("company_id", companyId) ✅
  │     ⚠️ Falls back to getMockUploads()
  └─→ maps uploads → uploadsData
  └─→ <UploadCentreClient uploadsData uploadAction={uploadStatement} />
```
**Verdict:** ✅ Auth & scoping correct. ❌ Mock fallback in getter.

---

### 15. /settings
```
SettingsPage (async SC)
  └─→ requireAuthCompany() → discarded
  ├─→ getUserWithProfile()      // from @/lib/auth
  │     └─→ queries profiles by user.id (user-level, not company-scoped — acceptable)
  └─→ getCurrentCompany()       // from @/lib/auth
        └─→ queries company_members by user_id + is_active=true
        └─→ returns companies row
  ⚠️ SettingsPage calls requireAuthCompany() but ignores the returned companyId,
      then re-queries company via getCurrentCompany(). Redundant auth work.
  └─→ <SettingsClient profile company />
        ⚠️ Role field is HARDCODED to "CEO / Founder"
        ⚠️ Tax Region is HARDCODED to "United States"
        ⚠️ Notification toggles are hardcoded ON with no-op onClick handlers
```
**Verdict:** ✅ Auth & scoping correct. ⚠️ Redundant company query. ❌ Multiple hardcoded UI values.

---

## 2. Specific Flow Verifications

### 2.1 AI Assistant Flow
```
AssistantDrawer (client)
  └─→ processAssistantMessage(message)     // server action
        └─→ requireAuthCompany() → { companyId, userId } ✅
        ├─→ detectIntent(message)          // pure function, no DB
        ├─→ fetchContextForIntent(intent, companyId)
        │     ├─→ getDashboardMetrics(companyId) ✅
        │     ├─→ getMonthlyMetrics(companyId) ✅
        │     ├─→ getSubscriptions(companyId) ✅
        │     ├─→ getBudgets(companyId) ✅
        │     ├─→ getTransactions(companyId) ✅
        │     ├─→ getAlerts(companyId) ✅
        │     ├─→ getAgentTasks(companyId) ✅
        │     └─→ getAgentRecommendations(companyId) ✅
        │     All DB calls scoped by companyId ✅
        ├─→ getLLM(intent, data, message)  // no DB
        ├─→ llm.generate(message)          // no DB
        ├─→ createTaskFromChat(companyId, message)
        │     └─→ triggerAgentTask(companyId, taskType) ✅
        └─→ logAssistantInteraction(companyId, userId, message)
              └─→ inserts into agent_activity_logs with company_id ✅
```
**Verdict:** ✅ Fully authenticated. ✅ companyId passed through entire chain. ✅ All DB queries scoped.

---

### 2.2 Upload Flow
```
UploadCentreClient (client)
  └─→ uploadStatement(formData)            // server action
        └─→ requireAuthCompany() → { companyId, userId } ✅
        ├─→ uploadFileToStorage(file, companyId)
        │     └─→ storage path: `${companyId}/${uuid}.${ext}` ✅
        ├─→ adminClient.from("uploads").insert({ company_id: companyId, user_id: userId, ... }) ✅
        └─→ processUpload(uploadId, companyId)
              ├─→ adminClient.from("uploads").select().eq("id", uploadId).eq("company_id", companyId) ✅
              ├─→ parseBankCsv(text, companyId)
              │     └─→ returns rows with company_id: companyId ✅
              └─→ adminClient.from("transactions").insert(rows with upload_id & company_id) ✅
              └─→ agent_activity_logs.insert({ company_id: companyId, ... }) ✅
```
**Verdict:** ✅ Fully authenticated. ✅ companyId on every DB write. ✅ Upload record verified against company before processing.

---

### 2.3 Agent Runner Flow
```
processAssistantMessage / triggerAgentTask
  └─→ triggerAgentTask(companyId, taskType)
        ├─→ createAgentTask({ companyId, title, taskType, priority, inputData })
        │     └─→ adminClient.from("agent_tasks").insert({ company_id: companyId, ... }) ✅
        └─→ runAgentTask(task.id)
              ├─→ adminClient.from("agent_tasks").select("*").eq("id", taskId).single()
              │     ⚠️ NO AUTH CHECK — uses admin client, does not verify caller owns this task
              ├─→ const companyId = task.company_id ✅
              ├─→ getSubscriptions(companyId)
              │     └─→ internally validates companyId against auth context ✅
              ├─→ updateAgentTaskStatus(taskId, "running")
              │     ⚠️ NO AUTH CHECK — updates by task ID only
              ├─→ createAgentRecommendation({ companyId, taskId, ... })
              │     └─→ adminClient.from("agent_recommendations").insert({ company_id: companyId, ... }) ✅
              │     ⚠️ NO AUTH CHECK in function itself
              └─→ agent_activity_logs.insert({ company_id: companyId, ... }) ✅
```
**Verdict:** ⚠️ **Security gap.** `runAgentTask`, `createAgentTask`, `updateAgentTaskStatus`, and `createAgentRecommendation` do not verify the caller's company membership. They rely on being called only from authenticated contexts. If `runAgentTask` were ever invoked directly with an arbitrary `taskId`, it would execute against any company's data.

---

### 2.4 Onboarding Flow
```
OnboardingPage (async SC)
  └─→ getUserWithProfile()
  └─→ userHasCompany() → redirects if true
  └─→ <OnboardingContent userId email fullName />
        └─→ submitOnboarding(formData)     // server action
              ├─→ onboardUser({ userId, email, fullName, companyName, ... })
              │     └─→ createOnboardedCompany(data)
              │           ├─→ admin.from("companies").insert({ name, slug, industry, currency, ... }) ✅
              │           ├─→ admin.from("profiles").upsert({ id: userId, email, full_name: fullName }) ✅
              │           └─→ admin.from("company_members").insert({
              │                 company_id: company.id,
              │                 user_id: userId,
              │                 role: "owner",
              │                 is_active: true
              │               }) ✅
              └─→ cookies().set("fa_has_company", "true") ✅
              └─→ redirect("/dashboard") ✅
```
**Verdict:** ✅ Company created. ✅ Profile upserted. ✅ Membership linked as owner. ✅ Cookie set.

---

## 3. Issues Found

### 🔴 Critical: Mock Data Fallbacks on Every DB Getter

**Affected:** `src/lib/db/transactions.ts`, `subscriptions.ts`, `budgets.ts`, `alerts.ts`, `reports.ts`, `agent-tasks.ts`, `agent-recommendations.ts`, `uploads.ts`, `metrics.ts`

**Pattern:**
```typescript
if (!supabase) return getMockTransactions(effectiveCompanyId);
// ...
if (error.code === "42P01") return getMockTransactions(effectiveCompanyId);
```

**Impact:** If Supabase is not configured OR the table does not exist, the application silently returns realistic demo data instead of failing or showing empty states. This violates the requirement: **"No mock data is used as fallback (except decorative empty states)."**

**Recommendation:** Remove all `getMock*` fallbacks. Return empty arrays `[]` or throw explicit errors. Keep `mock-data.ts` only for Storybook/tests or decorative empty-state illustrations.

---

### 🟡 High: Hardcoded Values in Production Data

**Location:** `src/lib/db/metrics.ts:66`
```typescript
cashBalance: 127340.50, // Would come from accounts table when implemented
```

**Location:** `src/app/(dashboard)/dashboard/content.tsx` — All KPI "change" percentages are hardcoded:
```typescript
{ label: "Cash Balance", change: "+12.4%", ... }
{ label: "Monthly Revenue", change: "+12.5%", ... }
// etc.
```

**Location:** `src/app/(dashboard)/settings/SettingsClient.tsx`
```typescript
defaultValue="CEO / Founder"   // Role hardcoded
defaultValue="United States"   // Tax region hardcoded
```

**Impact:** Users see fabricated variance data and incorrect profile defaults.

**Recommendation:**
- Remove hardcoded `cashBalance` from `getDashboardMetrics`. Return `0` or `null` until accounts table is implemented.
- Compute change percentages from real month-over-month data in `monthlyMetrics`.
- Fetch actual role from `company_members` and actual tax region from `companies.tax_region`.

---

### 🟡 High: Missing Auth Guards in Internal DB Mutation Functions

**Affected functions:**
- `createAgentTask()` in `agent-tasks.ts`
- `updateAgentTaskStatus()` in `agent-tasks.ts`
- `createAgentRecommendation()` in `agent-recommendations.ts`
- `runAgentTask()` in `agent/runner.ts`

**Impact:** These functions use `adminClient` (service role) and do not verify the caller's identity or company membership. They are safe *only* because all call sites currently pass through authenticated wrappers. However, if exported and called from new code paths, they could expose data across company boundaries.

**Recommendation:** Add `requireAuthCompany()` or `getActiveCompanyForUser()` guards at the top of each mutation function and validate the provided `companyId` against the auth context.

---

### 🟡 Medium: Data Type Mismatches Between DB Enum and UI

| DB Enum | UI Type | Location | Issue |
|---------|---------|----------|-------|
| `report_status`: draft, generating, ready, archived | `"ready" \| "generating"` | ReportsPage.tsx:34 | Missing "draft" and "archived" |
| `alert_severity`: critical, warning, info, resolved | `"critical" \| "warning" \| "info"` | AlertsPage.tsx:12 | Missing "resolved" |
| `transaction_status`: categorised, needs_review, … | Checked as `"categorised" \| "categorized"` | transactions/content.tsx:22 | Accepts both spellings (defensive but inconsistent) |
| `subscription_status`: active, canceled, paused, expired | Not fully typed | Subscription types | "canceled" (US) vs DB enum may need alignment |

**Recommendation:** Generate TypeScript union types directly from Supabase schema (or keep a single source of truth in `types.ts`) and ensure all UI casts match.

---

### 🟡 Medium: Settings Page Redundant Auth

**Location:** `src/app/(dashboard)/settings/page.tsx`

```typescript
await requireAuthCompany();  // Called but result discarded
const [userData, company] = await Promise.all([
  getUserWithProfile(),     // Re-fetches user separately
  getCurrentCompany(),      // Re-queries membership
]);
```

**Impact:** Two extra DB round-trips per settings page load.

**Recommendation:** Use the `companyId` from `requireAuthCompany()` and fetch the company directly with `getCompanyById(companyId)`.

---

### 🟢 Low: AI Insights Page Renders Directly

**Location:** `src/app/(dashboard)/ai-insights/page.tsx`

The page is an async server component that renders the full UI inline instead of delegating to a separate `*Content` client component.

**Impact:** Minimal. The pattern is slightly inconsistent with other routes but functionally correct.

**Recommendation:** Optional — extract to `AIInsightsContent.tsx` for consistency.

---

## 4. Routes Using Mock Data or Hardcoded Values

| Route | Mock Fallback | Hardcoded Values |
|-------|--------------|------------------|
| /dashboard | metrics, monthly, subs, alerts, txs | cashBalance, KPI changes |
| /transactions | txs, stats | — |
| /subscriptions | subs, stats | — |
| /revenue | txs, monthly | — |
| /expenses | txs, monthly | — |
| /cash-flow | monthly, txs | — |
| /runway | metrics, monthly | cashBalance |
| /pl-report | monthly, txs | — |
| /budgets | budgets, stats | — |
| /alerts | alerts | — |
| /reports | reports | status type cast |
| /agent-tasks | tasks, stats | — |
| /ai-insights | recommendations, tasks | — |
| /upload-centre | uploads | — |
| /settings | — | Role, Tax Region, toggles |

---

## 5. Missing companyId Scoping Summary

| Function | File | Has companyId check? | Risk |
|----------|------|---------------------|------|
| `getTransactions` | db/transactions.ts | ✅ Yes | Low |
| `getDashboardMetrics` | db/metrics.ts | ✅ Yes | Low |
| `getSubscriptions` | db/subscriptions.ts | ✅ Yes | Low |
| `getAlerts` | db/alerts.ts | ✅ Yes | Low |
| `getBudgets` | db/budgets.ts | ✅ Yes | Low |
| `getReports` | db/reports.ts | ✅ Yes | Low |
| `getAgentTasks` | db/agent-tasks.ts | ✅ Yes | Low |
| `getAgentRecommendations` | db/agent-recommendations.ts | ✅ Yes | Low |
| `getUploads` | db/uploads.ts | ✅ Yes | Low |
| `createAgentTask` | db/agent-tasks.ts | ❌ **No** | High |
| `updateAgentTaskStatus` | db/agent-tasks.ts | ❌ **No** | High |
| `createAgentRecommendation` | db/agent-recommendations.ts | ❌ **No** | High |
| `runAgentTask` | agent/runner.ts | ❌ **No** | High |
| `processUpload` | upload/processor.ts | ✅ Yes (param) | Medium |

---

## 6. Recommendations (Prioritised)

### P0 — Remove Mock Data Fallbacks
- Edit all 9 DB getter files to remove `getMock*` imports and fallback returns.
- On `!supabase`: throw `new Error("Database not configured")`.
- On `42P01`: throw `new Error("Table not found — run migrations")`.
- Keep `mock-data.ts` for unit tests or empty-state decorations only.

### P1 — Add Auth Guards to Mutations
- Add `requireAuthCompany()` to `createAgentTask`, `updateAgentTaskStatus`, `createAgentRecommendation`.
- Add `requireAuthCompany()` to `runAgentTask` and validate `task.company_id === ctx.companyId`.

### P1 — Fix Hardcoded Values
- Replace `cashBalance: 127340.50` with `0` or fetch from `accounts` table if available.
- Compute real MoM changes in DashboardPage or omit them until implemented.
- Fetch actual `role` and `tax_region` in SettingsPage.

### P2 — Align TypeScript Types with DB Enums
- Update `ReportsPage` status type to include `"draft" | "archived"`.
- Update `AlertsPage` severity type to include `"resolved"`.
- Standardise on DB enum spellings (e.g., `"categorised"` not `"categorized"`).

### P2 — Optimise Settings Auth
- Use `const { companyId } = await requireAuthCompany()` then `getCompanyById(companyId)`.

---

*End of Report*
