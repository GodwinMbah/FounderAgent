# FounderAgent KPI Inventory and Formula Audit Report

**Prepared by:** Victor Huang, Senior Report Engineer  
**Date:** 2026-05-27  
**Scope:** Full-platform KPI inventory, formula correctness, data flow, and production readiness audit  
**Agents Consulted:** 7 specialist agents (Amelia Grant, Marcus Reed, Priya Shah, Ethan Brooks, Naomi Chen, Daniel Okafor, Oliver Stone)

---

## 1. Executive Summary

FounderAgent is an AI-powered finance intelligence platform built on Next.js 16, TypeScript, Tailwind, and Supabase. This report consolidates findings from a seven-agent specialist audit covering product architecture, financial metrics engineering, database/data flow, reporting service architecture, AI insight readiness, frontend visibility, and quality assurance.

### Headline Findings

| Category | Finding | Count |
|----------|---------|-------|
| **Critical Formula Bugs** | Formulas producing materially wrong financial figures in production | **3** |
| **Fake / Hardcoded Data** | Metrics rendered from hardcoded values or fabricated trends | **12** |
| **Orphaned Code** | Legacy calculation modules with zero imports but incorrect logic | **1** |
| **Cross-Page Inconsistencies** | Label, formatting, or semantic mismatches across views | **25** |
| **Missing KPIs** | SaaS-founder-critical metrics not yet implemented | **16+** |
| **Test Coverage** | KPI value-correctness tests | **0** |

### Most Urgent Issues (P0)
1. **Dashboard "MRR" is actually `monthlySubscriptionSpend`** — SaaS tool costs, not revenue. This is a fundamental product mislabel that destroys trust.
2. **Monthly Burn Double-Division Bug** — Profitable companies show positive burn, falsely shortening runway.
3. **Fake MRR Growth** — Hardcoded `+5.3%` regardless of actual data.
4. **Hardcoded Runway Scenarios** — Runway projections use fixed `-$9,650/mo` and `+4 months` instead of real modeling.

### Production Readiness Assessment

| Dimension | Score | Notes |
|-----------|-------|-------|
| Financial Formula Correctness | **4 / 10** | Core burn/runway/potentialSavings are wrong; transfer exclusion gaps exist |
| Data Flow Integrity | **6 / 10** | Solid pipeline but custom-range cache collision, missing composite indexes |
| AI Insight Quality | **3.5 / 10** | Deterministic template engine with no reasoning layer; missing context |
| Frontend Consistency | **5 / 10** | 25 cross-page inconsistencies; hardcoded dates; mock tasks in production |
| Test Coverage | **2 / 10** | E2E page-load tests exist; zero unit tests for financial calculations |
| Overall Production Readiness | **4 / 10** | Requires immediate P0/P1 remediation before scaling to paid users |

---

## 2. KPI Inventory Table

> **Legend:**
> - **Transfer Excluded?** — Whether internal transfers (e.g., bank-to-bank) are excluded from the numerator
> - **Duplicate Excluded?** — Whether duplicate transactions are de-duplicated
> - **Production Ready?** — Whether the displayed value is derived from real data with a correct formula
> - **Global Date Filter Ready?** — Whether the KPI correctly respects the user's selected date range
> - **Risk Level** — Critical = materially wrong financial figure; High = significant UX/mislabel risk; Medium = imprecise or incomplete; Low = minor inconsistency

### 2.1 Dashboard

| # | KPI Name | Page/Location | Formula / Calculation | Data Source | Transfer Excl.? | Dup. Excl.? | Prod. Ready? | Date Filter Ready? | Risk Level |
|---|----------|---------------|----------------------|-------------|-----------------|-------------|--------------|--------------------|------------|
| 1 | **Monthly Recurring Revenue (MRR)** — *mislabeled* | Dashboard KPI Card | `monthlySubscriptionSpend` (sum of subscription costs normalized to monthly) | `company_metrics.monthly_burn` (misused) | No | No | **No** — Label says revenue; value is SaaS spend | Needs Formula Update | **Critical** |
| 2 | Total SaaS Spend | Dashboard KPI Card | `monthlySubscriptionSpend` | `company_metrics.monthly_burn` (misused) | No | No | Partial — Value is real but label mismatch | Needs Formula Update | **High** |
| 3 | Cash Balance | Dashboard KPI Card | `getTotalCashBalance()` — sum of `bank_accounts.current_balance` | `bank_accounts.current_balance` | N/A | N/A | Yes | Ready | Low |
| 4 | Monthly Revenue | Dashboard KPI Card | Sum of `type = 'income'` transactions in period | `transactions` (type, amount, date) | Partial — `isTransfer` not checked in legacy paths | No | Partial — Correct in reporting lib, bypassed in some paths | Ready | Medium |
| 5 | Monthly Expenses | Dashboard KPI Card | Sum of `type = 'expense'` transactions in period | `transactions` (type, amount, date) | Partial — `isTransfer` not checked in legacy paths | No | Partial — Correct in reporting lib, bypassed in some paths | Ready | Medium |
| 6 | Net Profit | Dashboard KPI Card | `monthlyRevenue - monthlyExpenses` | Derived from transactions | Partial | No | Partial | Ready | Medium |
| 7 | Burn Rate | Dashboard KPI Card | `calcMonthlyBurn(revenue, totalBurn) / 3 || totalBurn / 3` | `company_metrics` | Partial | No | **No** — Double-division bug | Needs Formula Update | **Critical** |
| 8 | Runway | Dashboard KPI Card | `totalCashBalance / monthlyBurn` | Derived | Partial | No | **No** — Burn input is wrong | Needs Formula Update | **Critical** |
| 9 | Potential Savings | Dashboard KPI Card | `flaggedSubscriptions * monthlySubscriptionSpend` | `subscriptions` + `company_metrics` | No | No | **No** — Count × total = nonsensical estimate | Needs Formula Update | **High** |
| 10 | Top Expenses (progress bars) | Dashboard Chart Card | Inline aggregation of expenses by category | `transactions` | No | No | Partial — Inline calc, no reporting import | Ready | Medium |
| 11 | Revenue vs Expenses (chart) | Dashboard Chart Card | Monthly sums over selected range | `transactions` | Partial | No | Partial | Ready | Medium |
| 12 | Active Subscriptions | Dashboard Chart Card | Count of `is_recurring = true` subscriptions | `subscriptions` | N/A | N/A | Yes | Should Not Be Filtered | Low |
| 13 | AI Insight Feed | Dashboard Sidebar | Hardcoded / mock task list | `agent_tasks` (intended) | N/A | N/A | **No** — `mockTasks` hardcoded | N/A | **High** |

### 2.2 Revenue Page

| # | KPI Name | Page/Location | Formula / Calculation | Data Source | Transfer Excl.? | Dup. Excl.? | Prod. Ready? | Date Filter Ready? | Risk Level |
|---|----------|---------------|----------------------|-------------|-----------------|-------------|--------------|--------------------|------------|
| 14 | **Monthly Recurring** — should be "MRR" | Revenue KPI Card | Inline `toMonthly`-style calc on income tagged recurring | `transactions` (amount, metadata, date) | Yes — reporting path | No | Partial — Label should be "MRR" | Ready | High |
| 15 | Total Revenue | Revenue KPI Card | Sum of `type = 'income'` in period | `transactions` | Yes — reporting path | No | Yes | Ready | Low |
| 16 | Revenue Growth | Revenue KPI Card | `calculateChangePercent(current, previous)` | Derived | Yes — reporting path | No | Yes | Ready | Low |
| 17 | One-Time Revenue | Revenue KPI Card | `max(0, avgRevenue - mrr)` | Derived | Yes — reporting path | No | Partial — Crude assumption | Ready | Medium |
| 18 | MRR Growth (%) | Revenue KPI Card | `calculateChangePercent(mrr, mrr * 0.95)` | Derived | N/A | N/A | **No** — Always ~+5.3% | N/A | **Critical** |
| 19 | Revenue by Source (chart) | Revenue Chart Card | Group by `metadata.source` or `category` | `transactions` | Yes — reporting path | No | Partial | Ready | Medium |
| 20 | Revenue Trend (chart) | Revenue Chart Card | `sumByMonth` over range | `transactions` | Yes — reporting path | No | Yes | Ready | Low |

### 2.3 Expenses Page

| # | KPI Name | Page/Location | Formula / Calculation | Data Source | Transfer Excl.? | Dup. Excl.? | Prod. Ready? | Date Filter Ready? | Risk Level |
|---|----------|---------------|----------------------|-------------|-----------------|-------------|--------------|--------------------|------------|
| 21 | Total Expenses | Expenses KPI Card | Sum of `type = 'expense'` in period | `transactions` | Yes — reporting path | No | Yes | Ready | Low |
| 22 | Avg Monthly Expenses | Expenses KPI Card | Mean of monthly expense totals in range | `company_metrics` / derived | Yes — reporting path | No | Yes | Ready | Low |
| 23 | Largest Category | Expenses KPI Card | Category name with highest spend | `transactions` | Yes — reporting path | No | Partial — Shows name, not amount | Ready | Medium |
| 24 | Expense Growth | Expenses KPI Card | `calculateChangePercent(current, previous)` | Derived | Yes — reporting path | No | Yes | Ready | Low |
| 25 | Category Breakdown (chart) | Expenses Chart Card | Inline category aggregation | `transactions` | Yes — reporting path | No | Partial — Inline, duplicates `groupByCategory` | Ready | Medium |
| 26 | Expense Trend (chart) | Expenses Chart Card | Monthly expense totals | `transactions` | Yes — reporting path | No | Yes | Ready | Low |

### 2.4 Cash Flow Page

| # | KPI Name | Page/Location | Formula / Calculation | Data Source | Transfer Excl.? | Dup. Excl.? | Prod. Ready? | Date Filter Ready? | Risk Level |
|---|----------|---------------|----------------------|-------------|-----------------|-------------|--------------|--------------------|------------|
| 27 | Net Cash Flow | Cash Flow KPI Card | `inflow - outflow` | `transactions` | Yes — reporting path | No | Yes | Ready | Low |
| 28 | Total Inflow | Cash Flow KPI Card | Sum of `type = 'income'` | `transactions` | Yes — reporting path | No | Yes | Ready | Low |
| 29 | Total Outflow | Cash Flow KPI Card | Sum of `type = 'expense'` | `transactions` | Yes — reporting path | No | Yes | Ready | Low |
| 30 | Closing Balance | Cash Flow KPI Card | Label "Strong" + static value | `bank_accounts` (intended) | N/A | N/A | **No** — Hardcoded text "Strong" | Ready | **High** |
| 31 | Cash Flow Trend (chart) | Cash Flow Chart Card | Monthly inflow vs outflow | `transactions` | Yes — reporting path | No | Yes | Ready | Low |
| 32 | Category Inflow/Outflow (chart) | Cash Flow Chart Card | Group by category + type | `transactions` | Yes — reporting path | No | Yes | Ready | Low |

### 2.5 Runway Page

| # | KPI Name | Page/Location | Formula / Calculation | Data Source | Transfer Excl.? | Dup. Excl.? | Prod. Ready? | Date Filter Ready? | Risk Level |
|---|----------|---------------|----------------------|-------------|-----------------|-------------|--------------|--------------------|------------|
| 33 | Runway (months) | Runway KPI Card | `totalCashBalance / monthlyBurn` | Derived | Partial | No | **No** — Burn is wrong | Needs Formula Update | **Critical** |
| 34 | Cash Balance | Runway KPI Card | `getTotalCashBalance()` | `bank_accounts` | N/A | N/A | Yes | Ready | Low |
| 35 | Monthly Burn | Runway KPI Card | `calcMonthlyBurn(revenue, totalBurn) / 3 || totalBurn / 3` | `company_metrics` | Partial | No | **No** — Double division | Needs Formula Update | **Critical** |
| 36 | Cash Status | Runway KPI Card | "Healthy" hardcoded | N/A | N/A | N/A | **No** | N/A | **High** |
| 37 | Base Case Runway | Runway Scenario Card | `runwayMonths` as computed | Derived | Partial | No | **No** — Burn input wrong | Needs Formula Update | **Critical** |
| 38 | Best Case Runway | Runway Scenario Card | `runway * 1.5` | Derived | Partial | No | **No** — Label claims "20% growth, 5% reduction"; math is 1.5× | Needs Formula Update | **High** |
| 39 | Worst Case Runway | Runway Scenario Card | `runway * 0.7` | Derived | Partial | No | **No** — Hardcoded impacts | Needs Formula Update | High |
| 40 | Runway Recommendations | Runway Panel | "4 months" / "18+ months" hardcoded | N/A | N/A | N/A | **No** | N/A | High |

### 2.6 P&L Page

| # | KPI Name | Page/Location | Formula / Calculation | Data Source | Transfer Excl.? | Dup. Excl.? | Prod. Ready? | Date Filter Ready? | Risk Level |
|---|----------|---------------|----------------------|-------------|-----------------|-------------|--------------|--------------------|------------|
| 41 | Revenue | P&L KPI Card | Sum of income in period | `transactions` | Yes — reporting path | No | Yes | Ready | Low |
| 42 | Expenses | P&L KPI Card | Sum of expenses in period | `transactions` | Yes — reporting path | No | Yes | Ready | Low |
| 43 | Net Profit | P&L KPI Card | `revenue - expenses` | Derived | Yes — reporting path | No | Yes | Ready | Low |
| 44 | Avg Profit Margin | P&L KPI Card | Unweighted average of monthly margins | Derived | Yes — reporting path | No | **No** — Statistically wrong; should be weighted | Needs Formula Update | **High** |
| 45 | Revenue/Expense Trend (chart) | P&L Chart Card | Monthly sums | `transactions` | Yes — reporting path | No | Yes | Ready | Low |
| 46 | Expense Breakdown (pie) | P&L Chart Card | Category percentages | `transactions` | Yes — reporting path | No | **No** — Percentages always render 0 | Needs Formula Update | **High** |

### 2.7 Reports Page

| # | KPI Name | Page/Location | Formula / Calculation | Data Source | Transfer Excl.? | Dup. Excl.? | Prod. Ready? | Date Filter Ready? | Risk Level |
|---|----------|---------------|----------------------|-------------|-----------------|-------------|--------------|--------------------|------------|
| 47 | Total Reports | Reports KPI Card | Count of generated reports | `reports` / `files` | N/A | N/A | Yes | Should Not Be Filtered | Low |
| 48 | Reports This Month | Reports KPI Card | Count with `created_at` in current month | `reports` | N/A | N/A | Yes | Should Not Be Filtered | Low |
| 49 | Last Generated | Reports KPI Card | `MAX(created_at)` | `reports` | N/A | N/A | Yes | Should Not Be Filtered | Low |
| 50 | Favorite Reports | Reports KPI Card | Count with `is_favorite = true` | `reports` | N/A | N/A | Yes | Should Not Be Filtered | Low |

> **Amelia P1 Recommendation:** Remove all 4 Reports KPIs. They are file-management metrics, not financial intelligence.

### 2.8 Budgets Page

| # | KPI Name | Page/Location | Formula / Calculation | Data Source | Transfer Excl.? | Dup. Excl.? | Prod. Ready? | Date Filter Ready? | Risk Level |
|---|----------|---------------|----------------------|-------------|-----------------|-------------|--------------|--------------------|------------|
| 51 | Total Budgets | Budgets KPI Card | Count of budget rows | `budgets` | N/A | N/A | Yes | Should Not Be Filtered | Low |
| 52 | Total Budgeted | Budgets KPI Card | Sum of `budget_amount` | `budgets` | N/A | N/A | Yes | Should Not Be Filtered | Low |
| 53 | Total Spent | Budgets KPI Card | Sum of actuals against budgets | `transactions` + `budgets` | Yes — reporting path | No | Yes | Ready | Low |
| 54 | Spent Change | Budgets KPI Card | Utilization % (not period-over-period change) | Derived | N/A | N/A | Partial — Label says "change"; shows utilization | Needs Formula Update | Medium |
| 55 | Budget vs Actual (chart) | Budgets Chart Card | Category-level variance | `transactions` + `budgets` | Yes — reporting path | No | Partial — No reporting imports | Ready | Medium |
| 56 | Budget Recommendations | Budgets Panel | Hardcoded dollar amounts | N/A | N/A | N/A | **No** | N/A | **High** |

### 2.9 Subscriptions Page

| # | KPI Name | Page/Location | Formula / Calculation | Data Source | Transfer Excl.? | Dup. Excl.? | Prod. Ready? | Date Filter Ready? | Risk Level |
|---|----------|---------------|----------------------|-------------|-----------------|-------------|--------------|--------------------|------------|
| 57 | Monthly Spend | Subscriptions KPI Card | `toMonthly(normalizeSubscriptionSpend(...))` | `subscriptions` | N/A | N/A | Yes | Ready | Low |
| 58 | Active Subscriptions | Subscriptions KPI Card | Count of active rows | `subscriptions` | N/A | N/A | Yes | Should Not Be Filtered | Low |
| 59 | Annual Cost | Subscriptions KPI Card | `monthlySpend * 12` | Derived | N/A | N/A | Yes | Ready | Low |
| 60 | Subscription Growth | Subscriptions KPI Card | Hardcoded `+3.2%` | N/A | N/A | N/A | **No** | N/A | **Critical** |
| 61 | Subscription Trend (chart) | Subscriptions Chart Card | `monthlySpend * [0.88, 0.92, 0.96, 1.0, 1.04]` | N/A | N/A | N/A | **No** — Entirely fabricated | N/A | **Critical** |
| 62 | Category Breakdown (chart) | Subscriptions Chart Card | Inline category aggregation | `subscriptions` | N/A | N/A | Partial — Inline, duplicates `groupByCategory` | Ready | Medium |
| 63 | Subscription Insights | Subscriptions Panel | Hardcoded vendor names and amounts | N/A | N/A | N/A | **No** | N/A | **High** |

### 2.10 Transactions Page

| # | KPI Name | Page/Location | Formula / Calculation | Data Source | Transfer Excl.? | Dup. Excl.? | Prod. Ready? | Date Filter Ready? | Risk Level |
|---|----------|---------------|----------------------|-------------|-----------------|-------------|--------------|--------------------|------------|
| 64 | Total Transactions | Transactions KPI Card | Count of rows | `transactions` | N/A | N/A | Yes | Ready | Low |
| 65 | Categorised | Transactions KPI Card | Count where `category IS NOT NULL` | `transactions` | N/A | N/A | Yes | Ready | Low |
| 66 | Uncategorised | Transactions KPI Card | Count where `category IS NULL` | `transactions` | N/A | N/A | Yes | Ready | Low |
| 67 | Duplicate Risk | Transactions KPI Card | Heuristic count (e.g., same amount + date) | `transactions` | N/A | N/A | Partial — Threshold arbitrary | Ready | Medium |
| 68 | Transaction List | Transactions Table | Row-level data | `transactions` | N/A | N/A | Yes | Ready | Low |

> **Amelia P2 Recommendation:** Move Transactions KPIs into a Data Health panel. They are data-quality metrics, not financial KPIs.

### 2.11 Alerts Page

| # | KPI Name | Page/Location | Formula / Calculation | Data Source | Transfer Excl.? | Dup. Excl.? | Prod. Ready? | Date Filter Ready? | Risk Level |
|---|----------|---------------|----------------------|-------------|-----------------|-------------|--------------|--------------------|------------|
| 69 | Total Alerts | Alerts KPI Card | Count of alert rows | `alerts` | N/A | N/A | Yes | Should Not Be Filtered | Low |
| 70 | Unresolved | Alerts KPI Card | Count where `status = 'new'` | `alerts` | N/A | N/A | Yes | Should Not Be Filtered | Low |
| 71 | Resolved | Alerts KPI Card | Count where `status = 'resolved'` | `alerts` | N/A | N/A | Partial — Not time-filtered | Should Not Be Filtered | Medium |
| 72 | Critical | Alerts KPI Card | Count where `severity = 'critical'` | `alerts` | N/A | N/A | Yes | Should Not Be Filtered | Low |
| 73 | Info + Resolved | Alerts Panel | Collapsible list | `alerts` | N/A | N/A | Partial — Should be collapsed by default | N/A | Low |

> **Amelia P2 Recommendation:** Collapse Info and Resolved alerts by default.

### 2.12 AI Insights Page

| # | KPI Name | Page/Location | Formula / Calculation | Data Source | Transfer Excl.? | Dup. Excl.? | Prod. Ready? | Date Filter Ready? | Risk Level |
|---|----------|---------------|----------------------|-------------|-----------------|-------------|--------------|--------------------|------------|
| 74 | Total Insights | AI Insights KPI Card | Count of insight rows | `agent_recommendations` | N/A | N/A | Yes | Should Not Be Filtered | Low |
| 75 | New Insights | AI Insights KPI Card | Count where `status = 'new'` | `agent_recommendations` | N/A | N/A | Yes | Should Not Be Filtered | Low |
| 76 | Accepted | AI Insights KPI Card | Count where `status = 'accepted'` | `agent_recommendations` | N/A | N/A | Yes | Should Not Be Filtered | Low |
| 77 | Implemented | AI Insights KPI Card | Count where `status = 'implemented'` | `agent_recommendations` | N/A | N/A | Yes | Should Not Be Filtered | Low |
| 78 | Insight Content | AI Insights Panel | Recommendation text | `agent_recommendations` | N/A | N/A | Partial — Hardcoded in some paths | N/A | Medium |

> **Amelia P1 Recommendation:** Remove all 4 AI Insights count KPIs. They are status counters, not financial intelligence.

### 2.13 Agent Tasks Page

| # | KPI Name | Page/Location | Formula / Calculation | Data Source | Transfer Excl.? | Dup. Excl.? | Prod. Ready? | Date Filter Ready? | Risk Level |
|---|----------|---------------|----------------------|-------------|-----------------|-------------|--------------|--------------------|------------|
| 79 | Total Tasks | Agent Tasks KPI Card | Count of task rows | `agent_tasks` | N/A | N/A | Yes | Should Not Be Filtered | Low |
| 80 | Pending | Agent Tasks KPI Card | Count where `status = 'pending'` | `agent_tasks` | N/A | N/A | Yes | Should Not Be Filtered | Low |
| 81 | Running | Agent Tasks KPI Card | Count where `status = 'running'` | `agent_tasks` | N/A | N/A | Yes | Should Not Be Filtered | Low |
| 82 | Completed | Agent Tasks KPI Card | Count where `status = 'completed'` | `agent_tasks` | N/A | N/A | Yes | Should Not Be Filtered | Low |

> **Amelia P1 Recommendation:** Remove all 4 Agent Tasks count KPIs. They are queue-management metrics, not financial intelligence.

### 2.14 Upload Centre

| # | KPI Name | Page/Location | Formula / Calculation | Data Source | Transfer Excl.? | Dup. Excl.? | Prod. Ready? | Date Filter Ready? | Risk Level |
|---|----------|---------------|----------------------|-------------|-----------------|-------------|--------------|--------------------|------------|
| 83-90 | Upload Step Metrics | Upload Centre | Custom card components showing step status | `upload_sessions` | N/A | N/A | Yes — UI progress indicators | N/A | Low |

### 2.15 Settings Page

| # | KPI Name | Page/Location | Formula / Calculation | Data Source | Transfer Excl.? | Dup. Excl.? | Prod. Ready? | Date Filter Ready? | Risk Level |
|---|----------|---------------|----------------------|-------------|-----------------|-------------|--------------|--------------------|------------|
| — | *(No financial metrics)* | Settings | N/A | N/A | N/A | N/A | N/A | N/A | N/A |

> **Daniel's Finding:** Settings page contains massive hardcoding of form defaults and UI text. No financial risk, but maintenance burden.

### 2.16 Global / Layout-Level

| # | KPI Name | Page/Location | Formula / Calculation | Data Source | Transfer Excl.? | Dup. Excl.? | Prod. Ready? | Date Filter Ready? | Risk Level |
|---|----------|---------------|----------------------|-------------|-----------------|-------------|--------------|--------------------|------------|
| 91 | TopBar Date Range | All pages | "May 12 – May 18, 2024" hardcoded | N/A | N/A | N/A | **No** | N/A | **High** |
| 92 | Sidebar Plan Label | Sidebar | Static text from config | `companies.plan` (intended) | N/A | N/A | Partial | N/A | Low |
| 93 | Agent Prompts | Sidebar | Static suggestions | N/A | N/A | N/A | Yes | N/A | Low |
| 94 | Assistant Drawer Tasks | All pages (drawer) | `mockTasks` hardcoded array | N/A | N/A | N/A | **No** | N/A | **High** |

---

## 3. Formula Correctness Audit

This section consolidates findings from **Marcus Reed (Finance Metrics Architect)** and **Ethan Brooks (Reporting Engineer)**. Formulas are graded: ✅ Correct, ⚠️ Partial, ❌ Incorrect, 🗑️ Dead Code.

### 3.1 Critical Issues (Must Fix Before Production)

| # | Formula / Function | Location | Issue | Severity | Fix |
|---|-------------------|----------|-------|----------|-----|
| 1 | `monthlyBurn = calcMonthlyBurn(revenue, totalBurn) / 3 \|\| totalBurn / 3` | `company-metrics.ts:148` | Double division: `calcMonthlyBurn` already returns a monthly figure; dividing again makes profitable companies show positive burn, shortening runway | **Critical** | Remove `/ 3` postfix; use `calcMonthlyBurn(revenue, totalBurn) \|\| totalBurn / 3` only if `calcMonthlyBurn` returns non-monthly |
| 2 | `calculateChangePercent(mrr, mrr * 0.95)` | `revenue/content.tsx:115` | Fake growth: always computes ~+5.3% regardless of actual data | **Critical** | Replace with real MoM MRR comparison from `company_metrics` or `sumByMonth` |
| 3 | `potentialSavings = flaggedSubscriptions * monthlySubscriptionSpend` | `getDashboardMetrics` | Nonsensical estimate: count × total spend = orders of magnitude wrong | **Critical** | Replace with `sum(toMonthly(subscription.amount)) for flagged subs` |
| 4 | `monthlySpend * [0.88, 0.92, 0.96, 1.0, 1.04]` | `subscriptions/content.tsx` | Entirely fabricated trend data | **Critical** | Query real historical spend from `subscriptions` + `transactions` |
| 5 | `+3.2%` subscription growth | `subscriptions/content.tsx:80` | Hardcoded growth rate | **Critical** | Compute from real MoM subscription totals |
| 6 | Hardcoded `-$9,650/mo`, `+4 months` | `RunwayClient.tsx` | Scenario math is static, not modeled | **Critical** | Implement scenario engine using actual burn/revenue variance |
| 7 | Hardcoded budget recommendations | `BudgetsClient.tsx` | Dollar amounts are fake | **Critical** | Generate from actual variance > threshold logic |
| 8 | Hardcoded subscription insights | `subscriptions/content.tsx` | Vendor names and amounts are fake | **Critical** | Drive from `agent_recommendations` or anomaly detection |
| 9 | `isTransfer` exclusion missing | `src/lib/calculations.ts` (all functions) | Every function uses `type === "income"` without `isTransfer` check | **Critical** | File is orphaned — delete or fix; do not use |

### 3.2 High Issues (Significant UX / Trust Impact)

| # | Formula / Function | Location | Issue | Severity | Fix |
|---|-------------------|----------|-------|----------|-----|
| 10 | `getTransactionStats` lines 72-73 | `transactions.ts` | No `isTransfer` exclusion | **High** | Add `AND is_transfer = false` or use `isTransfer()` filter |
| 11 | `getBudgetStats` | `budgets.ts` | No `isTransfer` exclusion | **High** | Apply reporting filters |
| 12 | Pipeline Balance Fallback | `pipeline.ts` | Transfer inclusion in fallback path | **High** | Ensure fallback uses same `isTransfer` logic as primary |
| 13 | Potential Savings raw amount | `agent_recommendations` | Uses raw amount, not monthly-normalized | **High** | Normalize to monthly before aggregating |
| 14 | Average Margin (unweighted) | `PLReportClient.tsx` | Unweighted average of monthly margins is statistically wrong | **High** | Use weighted average: `totalProfit / totalRevenue` across entire range |
| 15 | Best Case Runway description/value mismatch | `RunwayClient.tsx` | Claims "20% growth, 5% reduction" but math is `runway * 1.5` | **High** | Align description to formula or rebuild scenario engine |
| 16 | Subscription Health Score | `subscriptions/content.tsx` | Absolute thresholds with no revenue context | **High** | Add revenue denominator or replace with founder-actionable metric |
| 17 | One-Time Revenue assumption | `revenue/content.tsx` | `max(0, avgRevenue - mrr)` is crude | **High** | Tag one-time transactions explicitly in metadata or use `is_recurring` |
| 18 | Custom range cache key collision | `company_metrics` | `period_type = "custom"` + `metric_date = TODAY` overwrites for different ranges | **High** | Include range start/end in cache key or hash |
| 19 | `getMetricsForRange` bypasses auth | `db/metrics.ts` | No RLS / auth check in function | **High** | Enforce `company_id` ownership before query |

### 3.3 Medium Issues (Imprecision / Edge Cases)

| # | Formula / Function | Location | Issue | Severity | Fix |
|---|-------------------|----------|-------|----------|-----|
| 20 | `calculateMonthlySummary` | Legacy `calculations.ts` | Still exists, may be imported indirectly | Medium | Verify all imports; delete if truly orphaned |
| 21 | Health Score simplistic formula | `company-metrics.ts` | Edge case: zero expenses = score 75 | Medium | Handle edge cases explicitly; document formula |
| 22 | Runway Recommendations | `RunwayClient.tsx` | "4 months" / "18+ months" hardcoded | Medium | Derive from actual runway bands |
| 23 | `calculateGrowthRate` division by zero | `reporting/kpis.ts` | Returns 100% when previous is 0; should be `Infinity` or `null` | Medium | Return `null` or `Infinity` with UI handling |
| 24 | `identifyMoneyLeaks` threshold | `reporting/kpis.ts` | Arbitrary threshold | Medium | Make threshold configurable or percentile-based |
| 25 | `calculateChangePercent` caveat | `reporting/kpis.ts` | Uses `Math.abs(previous)`; sign flips behave unexpectedly | Medium | Document behavior or switch to signed delta |
| 26 | `getMockDashboardMetrics` | `mock-data.ts` | Mock fallback present in production bundle | Medium | Remove from production; use empty-state UI instead |
| 27 | Missing composite index | `company_metrics` | No `(company_id, period_type, metric_date DESC)` | Medium | Add migration for triple composite index |
| 28 | No cache invalidation on manual edits | `company_metrics` | User edits transactions but cache stale for 60 min | Medium | Trigger invalidation on write operations |
| 29 | `RunwayClient` ignores selected date range | `runway/content.tsx` | Core metrics use `all` or `ytd` regardless of filter | Medium | Respect global date filter for burn/revenue inputs |
| 30 | Alert category enum drift | Schema / code | Enum values in code may not match DB | Medium | Audit and align enums |
| 31 | Metadata overload | 10 tables | `metadata` used as flexible bucket; schema discipline lost | Medium | Document metadata schema; validate writes |
| 32 | `getTransactionStats` bypasses reporting lib | `transactions.ts` | Inline filtering instead of `isTransfer()` | Medium | Refactor to use `@/lib/reporting/filters` |

### 3.4 Verified Correct Formulas

The following formulas and functions were audited and found to be mathematically and logically correct:

| Function | Location | Purpose | Verified By |
|----------|----------|---------|-------------|
| `isTransfer` / `isIncome` / `isExpense` | `src/lib/reporting/filters.ts` | Transaction type filtering with transfer exclusion | Marcus + Ethan |
| `groupByCategory` | `src/lib/reporting/aggregates.ts` | Category aggregation with transfer exclusion | Marcus + Ethan |
| `sumByMonth` | `src/lib/reporting/aggregates.ts` | Monthly time-series aggregation | Marcus + Ethan |
| `profitMargin` | `src/lib/reporting/kpis.ts` | `(revenue - expenses) / revenue` | Marcus + Ethan |
| `monthlyBurn` (reporting lib version) | `src/lib/reporting/kpis.ts` | `totalBurn / months` | Marcus + Ethan |
| `runwayMonths` | `src/lib/reporting/kpis.ts` | `cashBalance / monthlyBurn` | Marcus + Ethan |
| `toMonthly` / `normalizeSubscriptionSpend` | `src/lib/reporting/subscriptions.ts` | Annual/quarterly spend → monthly | Marcus + Ethan |
| `getTotalCashBalance` | `db/bank-accounts.ts` | Sum of `bank_accounts.current_balance` | Marcus + Ethan |
| `recalculateCompanyMetrics` | `db/metrics.ts` | Revenue/expense recomputation | Marcus + Ethan |
| `getMonthlyMetrics` | `db/metrics.ts` | Monthly rollup from cache | Marcus + Ethan |
| `getMetricsForRange` | `db/metrics.ts` | Range-based cache lookup | Marcus + Ethan |
| Dashboard `topExpenses` | `dashboard/content.tsx` | Category expense aggregation | Marcus + Ethan |
| Revenue `totalRevenue` | `revenue/content.tsx` | Income sum with transfer exclusion | Marcus + Ethan |

### 3.5 Duplication Matrix

| Formula | Primary Source | Duplicate Locations | Action |
|---------|---------------|---------------------|--------|
| Profit margin | `reporting/kpis.ts` | `calculations.ts`, `db/metrics.ts`, `PLReportClient.tsx` | Delete `calculations.ts`; refactor `PLReportClient.tsx` to import |
| Monthly burn | `reporting/kpis.ts` | `calculations.ts` | Delete `calculations.ts` |
| Runway | `reporting/kpis.ts` | `calculations.ts`, inline in `RunwayClient.tsx` | Delete `calculations.ts`; refactor `RunwayClient.tsx` |
| MoM growth | `reporting/kpis.ts` | `calculations.ts`, inline in `revenue/content.tsx` | Delete `calculations.ts` |
| Category aggregation | `reporting/aggregates.ts` | Inline in 5 page files | Refactor pages to import `groupByCategory` |
| Subscription normalization | `reporting/subscriptions.ts` | Inline in `revenue/content.tsx` | Refactor to import `toMonthly` |
| Transfer exclusion | `reporting/filters.ts` | Missing in `calculations.ts`, `transactions.ts`, `pipeline.ts` | Add `isTransfer` checks everywhere |

> **Ethan's Critical Finding:** `src/lib/calculations.ts` is **100% orphaned** — zero imports, ~434 lines of dead code with incorrect transfer exclusion logic. It poses a latent risk if accidentally re-imported. **Action: Delete immediately.**

---

## 4. Data Flow & Schema Audit

Consolidated from **Priya Shah (DB/Data Flow Architect)**.

### 4.1 Schema Overview

| Aspect | Status | Detail |
|--------|--------|--------|
| **Migration 001 `businesses`** | ❌ Unused | Live schema starts at 003 `companies` — drift risk |
| **Live schema** | ✅ Stable | `companies`, `transactions`, `subscriptions`, `bank_accounts`, `company_metrics`, `agent_tasks`, `agent_recommendations`, `agent_activity_logs`, `alerts`, `budgets`, `reports`, `upload_sessions` |
| **RLS Policies** | ✅ Present | Standard pattern: `company_id = ANY(get_user_company_ids(auth.uid()))` |
| **Indexes** | ✅ Extensive | `idx_transactions_company_date`, `idx_transactions_type`, `idx_transactions_category`, etc. |
| **Missing Index** | ⚠️ Medium | No `(company_id, period_type, metric_date DESC)` on `company_metrics` |
| **Metadata columns** | ⚠️ Medium | Used in 10 tables as flexible extension; schema discipline weak |

### 4.2 Key Tables

| Table | Role | Key Columns | Notes |
|-------|------|-------------|-------|
| `bank_accounts` | Cash balance source | `current_balance`, `company_id` | Real-time source for cash KPIs |
| `transactions` | Source of truth | 20+ columns: `category`, `type`, `tags`, `amount`, `is_recurring`, `metadata` | Transfer exclusion critical |
| `company_metrics` | Pre-computed cache | 18+ columns, composite key `(company_id, metric_date, period_type)` | 60-min TTL; custom range collision |
| `subscriptions` | SaaS spend | `amount`, `frequency`, `is_active` | Source for MRR (when correctly labeled) |
| `agent_recommendations` | AI insights | `potential_savings`, `impact_score`, `effort_score`, `status` | Impact/effort scores present but underutilized in UI |

### 4.3 Data Flow Pipeline

```
Upload → Supabase Storage → Pipeline (18 steps) → company_metrics cache → UI
```

| Step | Status | Risk |
|------|--------|------|
| Upload | ✅ Working | `upload_sessions` cleanup needed |
| Storage | ✅ Working | — |
| Pipeline (18 steps) | ✅ Working | `month`, `quarter`, `year`, `all`, `30d` pre-computed ✅ |
| Cache (`company_metrics`) | ⚠️ Partial | Custom range key collision; no invalidation on manual edits |
| UI Query | ⚠️ Partial | `getMetricsForRange` bypasses auth; some pages ignore date filter |

### 4.4 High Concerns

| # | Concern | Impact | Recommended Fix |
|---|---------|--------|-----------------|
| 1 | Legacy schema drift (`businesses` vs `companies`) | Maintenance confusion, potential query errors | Drop unused migration or document clearly |
| 2 | `getMetricsForRange` bypasses auth | Data leakage between companies | Add `company_id` ownership check |
| 3 | Alert category enum drift | Runtime errors if enum mismatch | Audit code enums against DB enums |

### 4.5 Medium Concerns

| # | Concern | Impact | Recommended Fix |
|---|---------|--------|-----------------|
| 4 | Missing triple composite index on `company_metrics` | Slow queries on custom ranges | Add `(company_id, period_type, metric_date DESC)` |
| 5 | Metadata overload | Schema unpredictability | Document metadata schema per table |
| 6 | Cache invalidation gap | Stale metrics after manual edits | Trigger cache clear on transaction write |
| 7 | `potentialSavings` rough estimate | Misleading savings figures | Compute from actual flagged subscription amounts |

### 4.6 Low Concerns

| # | Concern | Impact | Recommended Fix |
|---|---------|--------|-----------------|
| 8 | `upload_sessions` cleanup | Table bloat | Add scheduled cleanup job |
| 9 | N+1 queries in some pages | Performance | Batch queries or use RPC |
| 10 | `agent_activity_logs` lacks `updated_at` | Audit trail gap | Add `updated_at` column |

---

## 5. Reporting Service Architecture

Consolidated from **Ethan Brooks (Reporting Engineer)**.

### 5.1 Centralized Reporting Library (`src/lib/reporting/`)

| Module | Functions | Adoption | Status |
|--------|-----------|----------|--------|
| `filters.ts` | `isTransfer`, `isIncome`, `isExpense` | 7 files import | ✅ Correct, should be universal |
| `aggregates.ts` | `groupByCategory`, `sumByMonth` | 7 files import | ✅ Correct |
| `kpis.ts` | `calculateChangePercent`, `profitMargin`, `monthlyBurn`, `runwayMonths` | 7 files import | ✅ Correct |
| `subscriptions.ts` | `toMonthly`, `normalizeSubscriptionSpend` | 7 files import | ✅ Correct |

### 5.2 Scattered / Inline Calculations (8 page files)

| Page | Inline Calculation | Duplicates Reporting Function? | Risk |
|------|-------------------|-------------------------------|------|
| Dashboard | Top expenses, progress bars | `groupByCategory` | Medium |
| Revenue | MRR calc | `toMonthly` | Medium |
| Revenue | Revenue source grouping | `groupByCategory` | Medium |
| Expenses | Category breakdown | `groupByCategory` | Medium |
| Cash Flow | Inflow/outflow grouping | `groupByCategory` | Medium |
| Runway | Scenario math | `runwayMonths` | **Critical** (hardcoded) |
| P&L | Margin calc | `profitMargin` | **High** (wrong averaging) |
| Budgets | Variance calc | None imported at all | Medium |
| Subscriptions | Category aggregation | `groupByCategory` | Medium |
| Subscriptions | Trend data | `sumByMonth` | **Critical** (fake data) |

### 5.3 Cache Architecture

| Aspect | Detail |
|--------|--------|
| Table | `company_metrics` |
| TTL | 60 minutes |
| Pre-computed periods | `month`, `quarter`, `year`, `all`, `30d` ✅ |
| Custom range handling | `period_type = "custom"` + `metric_date = TODAY` — **collides for different ranges** |
| Invalidation | ❌ None on manual transaction edits |
| Auth on read | ⚠️ `getMetricsForRange` bypasses ownership check |

### 5.4 Reporting Service Recommendations

1. **Delete `src/lib/calculations.ts`** immediately (434 lines, zero imports, wrong transfer logic).
2. **Mandate `@/lib/reporting` imports** for all new KPI calculations; add lint rule.
3. **Refactor 8 page files** to use centralized functions instead of inline math.
4. **Fix custom range cache key** by hashing `(company_id, period_type, start_date, end_date)`.
5. **Add cache invalidation trigger** on transaction INSERT/UPDATE/DELETE.
6. **Add composite index** `(company_id, period_type, metric_date DESC)`.

---

## 6. AI Insights Readiness

Consolidated from **Naomi Chen (AI Insight Architect)**.

### 6.1 Current AI Architecture

| Component | Status | Detail |
|-----------|--------|--------|
| `buildCompanyContext` | ⚠️ Exists but **never invoked** | Full context builder function is dead code |
| `DeterministicLLM` | ❌ Template engine | Hardcoded strings, no reasoning |
| Data per intent | ⚠️ Sparse, siloed | 10 intents get minimal, non-overlapping context |
| Mock tasks in drawer | ❌ Hardcoded | `mockTasks` array shown to all users |

### 6.2 KPI Usefulness for AI (Gap Analysis)

| Data Category | Value | Status |
|---------------|-------|--------|
| Revenue Growth Rate | 🔴 High | **Missing** from AI context |
| Expense Growth Rate | 🔴 High | **Missing** |
| Burn Trend | 🔴 High | **Missing** |
| Category Trends | 🔴 High | **Missing** |
| Alert Details (content) | 🔴 High | **Missing** — only counts provided |
| Anomaly Findings | 🔴 High | **Missing** |
| Budget Drill-Down | 🔴 High | **Missing** |
| Recommendation Intelligence (impact/effort) | 🔴 High | **Missing** |
| Subscription Cost Trend | 🔴 High | **Missing** |
| Runway Trajectory | 🔴 High | **Missing** |
| Transaction Count | 🟡 Medium | Present but low-value |
| Duplicate Detections | 🟡 Medium | Present |
| Ad/Revenue Ratio | 🟡 Medium | **Missing** |
| Cloud Spend | 🟡 Medium | **Missing** |
| Bank Breakdown | 🟡 Medium | **Missing** |
| Raw transaction lists | 🟢 Low | Over-provided, noisy |
| Upload metadata | 🟢 Low | Over-provided |

### 6.3 AI Readiness Scorecard

| Dimension | Score (out of 10) | Rationale |
|-----------|-------------------|-----------|
| Data Availability | 6 | Core financials exist but many high-value KPIs absent |
| Context Richness | 4 | Sparse per-intent; no cross-domain synthesis |
| Reasoning Capability | 2 | Deterministic template engine only |
| Cross-Domain Synthesis | 2 | No linking between subscriptions, burn, runway, revenue |
| Trend Awareness | 3 | No time-series intelligence in chat |
| Actionability | 5 | Recommendations exist but impact/effort underutilized |
| **Overall AI Readiness** | **3.5 / 10** | Requires fundamental architecture upgrade |

### 6.4 Fundamental Gaps

1. **No Real Reasoning Layer** — LLM is a template engine with hardcoded responses.
2. **Context is Fragmented and Intent-Locked** — Each intent gets a narrow slice; no holistic company view.
3. **No Time-Series Intelligence in Chat** — Cannot discuss trends, trajectories, or forecasts conversationally.
4. **Intelligence Pipeline Disconnected from Assistant** — `agent_recommendations` and anomaly detection feed UI but not chat context.
5. **Mock Data in Production UI** — `mockTasks` undermines trust in AI-generated insights.

### 6.5 Recommended Ideal AI Context Structure

Naomi provided a full TypeScript interface for ideal AI context. Key requirements:

- **Period-over-period comparisons** (current vs previous month/quarter)
- **Anomaly findings** with transaction-level detail
- **Alert content** (not just counts) with severity and suggested actions
- **Budget category drill-down** with variance and trend
- **Recommendation impact/effort scores** surfaced in natural language
- **Runway trajectory** with scenario modeling
- **Cross-domain links** (e.g., "Your cloud spend is up 20% and your runway dropped 2 months")

---

## 7. Frontend Visibility Audit

Consolidated from **Daniel Okafor (Frontend Architect)**.

### 7.1 Complete 15-Page Metric Inventory Summary

Daniel catalogued every visible metric label, value type, source, change text, and display type across all pages. Key findings per page:

| Page | Metric Count | Key Issues |
|------|-------------|------------|
| Dashboard | 8 KPIs + 4 chart cards | MRR mislabeled; burn/runway wrong; potentialSavings nonsense; mockTasks |
| Revenue | 4 KPIs + 2 charts | MRR label wrong; fake +5.3% growth; crude one-time revenue |
| Expenses | 4 KPIs + 2 charts | Largest Category shows name not amount |
| Cash Flow | 4 KPIs + 2 charts | Closing Balance "Strong" hardcoded |
| Runway | 4 KPIs + scenarios | Cash Balance "Healthy" hardcoded; scenarios hardcoded |
| P&L | 4 KPIs + 2 charts | Pie chart percentages always 0; avg margin unweighted |
| Reports | 4 KPIs | File-management metrics, not financial (Amelia P1 remove) |
| Budgets | 4 KPIs + recommendations | Spent change is utilization not change; recommendations hardcoded |
| Subscriptions | 4 KPIs + 2 charts | Trend fake; +3.2% hardcoded; insights hardcoded |
| Transactions | 4 KPIs | Data-quality metrics (Amelia P2 relocate) |
| Alerts | 4 KPIs | Resolved count not time-filtered |
| AI Insights | 4 KPIs | Count metrics, not financial (Amelia P1 remove) |
| Agent Tasks | 4 KPIs | Status counts, not financial (Amelia P1 remove) |
| Upload Centre | 8+ step metrics | Custom cards; generally correct |
| Settings | 0 financial | Massive hardcoding of defaults |

### 7.2 Layout-Level Issues

| Component | Issue | Severity |
|-----------|-------|----------|
| **TopBar** | Date range hardcoded: "May 12 – May 18, 2024" | **Critical** — visible on every page |
| **AssistantDrawer** | `mockTasks` hardcoded array | **High** — fake AI state |
| **Sidebar** | Company name and plan label generally correct | Low |
| **Sidebar** | Agent prompts are static suggestions | Low |

### 7.3 Cross-Page Inconsistencies (25 Total)

#### Critical (9)

| # | Inconsistency | Pages Affected | Impact |
|---|--------------|----------------|--------|
| 1 | "MRR" on Dashboard means SaaS spend; "Monthly Recurring" on Revenue should be "MRR" | Dashboard, Revenue | Founder sees "MRR" and thinks revenue; actually sees costs |
| 2 | Burn Rate formula differs between Dashboard and Runway page | Dashboard, Runway | Same metric, different (both wrong) values |
| 3 | Runway value differs between Dashboard and Runway page | Dashboard, Runway | Same metric, different values |
| 4 | Potential Savings computation is nonsense | Dashboard | Misleading financial figure |
| 5 | MRR Growth is always +5.3% | Revenue | Fake metric destroys trust |
| 6 | Subscription Growth is always +3.2% | Subscriptions | Fake metric destroys trust |
| 7 | Subscription Trend is entirely fabricated | Subscriptions | Fake chart destroys trust |
| 8 | TopBar date is hardcoded | All pages | User cannot filter by date |
| 9 | Pie chart percentages always 0 | P&L | Broken visualization |

#### High (5)

| # | Inconsistency | Pages Affected | Impact |
|---|--------------|----------------|--------|
| 10 | Closing Balance "Strong" is hardcoded | Cash Flow | Misleading status |
| 11 | Cash Status "Healthy" is hardcoded | Runway | Misleading status |
| 12 | Budget Recommendations are hardcoded | Budgets | Fake actionable advice |
| 13 | Subscription Insights are hardcoded | Subscriptions | Fake vendor-specific advice |
| 14 | Best Case Runway description does not match math | Runway | Misleading scenario |

#### Medium (5)

| # | Inconsistency | Pages Affected | Impact |
|---|--------------|----------------|--------|
| 15 | Largest Category shows name, not amount | Expenses | Less useful than it should be |
| 16 | Avg Profit Margin is unweighted | P&L | Statistically incorrect |
| 17 | Spent Change shows utilization, not change | Budgets | Label does not match value |
| 18 | Resolved Alerts count not time-filtered | Alerts | Count grows indefinitely |
| 19 | Revenue page "Monthly Recurring" should be "MRR" | Revenue | Naming inconsistency |

#### Low (6)

| # | Inconsistency | Pages Affected | Impact |
|---|--------------|----------------|--------|
| 20 | Transactions KPIs are data-quality metrics, not financial | Transactions | Semantic mismatch |
| 21 | Reports KPIs are file-management metrics | Reports | Semantic mismatch |
| 22 | AI Insights KPIs are count metrics | AI Insights | Semantic mismatch |
| 23 | Agent Tasks KPIs are queue metrics | Agent Tasks | Semantic mismatch |
| 24 | Alert Info+Resolved not collapsed by default | Alerts | UI clutter |
| 25 | Settings page has massive hardcoded defaults | Settings | Maintenance burden |

### 7.4 Orphaned / Hardcoded Components

Daniel identified 6 components present in the codebase but not used in production views. These should be audited for removal to reduce bundle size and maintenance burden.

---

## 8. Test Coverage Matrix

Consolidated from **Oliver Stone (QA Engineer)**.

### 8.1 Build & Lint Status

| Check | Status | Detail |
|-------|--------|--------|
| `npm run build` | ✅ Pass | 0 errors, 1 deprecation warning |
| `npm run lint` | ✅ Pass | 0 errors, 0 warnings |

### 8.2 E2E Test Inventory

| Spec File | Test Count | Coverage | Status |
|-----------|-----------|----------|--------|
| `confidence-tiers.spec.ts` | 3 | Tier-based feature gates | Discovered, not executed |
| `feature-validation.spec.ts` | 7 | Core feature smoke tests | Discovered, not executed |
| `persistence.spec.ts` | 4 | Data persistence across sessions | Discovered, not executed |
| `upload-flow.spec.ts` | 16 | File upload pipeline | Discovered, not executed |
| `viewport-tests.spec.ts` | 25 | Responsive breakpoints | Discovered, not executed |
| **Total** | **56** | **Page-load and interaction visibility only** | **0 value-correctness tests** |

### 8.3 Unit Test Coverage

| Domain | Tests Exist? | Notes |
|--------|-------------|-------|
| Financial calculations | ❌ **None** | Zero tests for burn, runway, margin, growth |
| Reporting library (`src/lib/reporting/`) | ❌ **None** | Zero tests for filters, aggregates, KPIs |
| Dashboard KPIs | ❌ **None** | |
| Revenue KPIs | ❌ **None** | |
| Expense KPIs | ❌ **None** | |
| Cash Flow KPIs | ❌ **None** | |
| Runway KPIs | ❌ **None** | |
| P&L KPIs | ❌ **None** | |
| Budget KPIs | ❌ **None** | |
| Subscription KPIs | ❌ **None** | |
| Transaction KPIs | ❌ **None** | |
| Alert KPIs | ❌ **None** | |
| AI Insight KPIs | ❌ **None** | |
| Agent Task KPIs | ❌ **None** | |

### 8.4 KPI Visibility vs Correctness Coverage

| KPI | Visibility Tested? | Value-Correctness Tested? |
|-----|-------------------|---------------------------|
| Cash Balance | ✅ Yes | ❌ No |
| Monthly Revenue | ✅ Yes | ❌ No |
| Monthly Expenses | ✅ Yes | ❌ No |
| Net Profit | ✅ Yes | ❌ No |
| Runway | ❌ No | ❌ No |
| Burn Rate | ❌ No | ❌ No |
| MRR | ❌ No | ❌ No |
| Health Score | ❌ No | ❌ No |
| Profit Margin | ❌ No | ❌ No |
| Growth Rate | ❌ No | ❌ No |
| Categories | ❌ No | ❌ No |
| Subscriptions | ❌ No | ❌ No |
| Transactions | ❌ No | ❌ No |
| Budgets | ❌ No | ❌ No |
| Alerts | ❌ No | ❌ No |
| AI Insights | ❌ No | ❌ No |
| Agent Tasks | ❌ No | ❌ No |
| Reports | ❌ No | ❌ No |

### 8.5 Critical Gaps

1. **Zero unit tests for financial calculations** — Every KPI formula is unverified in CI.
2. **Zero unit tests for reporting library** — Centralized functions have no regression protection.
3. **KPI value correctness untested** — E2E tests check visibility, not mathematical accuracy.
4. **No page-level tests** for Runway, Reports, Budgets, Subscriptions, Revenue, Expenses, Cash Flow, Agent Tasks.
5. **No API/integration tests** — Data flow from upload to UI is unverified end-to-end.
6. **Single-browser testing only** — No cross-browser coverage.
7. **No test scripts in `package.json`** — Tests are not integrated into build/lint pipeline.

---

## 9. Recommended Action Plan

Prioritized by business impact and founder trust. Each item includes owner, effort estimate, and acceptance criteria.

### P0 — Founder Trust Critical (Fix This Week)

| # | Action | Owner | Effort | Acceptance Criteria |
|---|--------|-------|--------|---------------------|
| P0-1 | **Rename Dashboard "MRR" to "Monthly Sub Spend"** or compute real MRR from recurring income | Frontend + Finance | 2-4 hrs | Label matches value; no founder sees cost labeled as revenue |
| P0-2 | **Fix Monthly Burn double-division bug** in `company-metrics.ts:148` | Finance Engineer | 1-2 hrs | Profitable company shows burn = 0 or negative; runway reflects reality |
| P0-3 | **Replace fake MRR Growth** (`mrr * 0.95`) with real MoM comparison | Frontend + Finance | 2-3 hrs | Growth % changes with data; matches `calculateChangePercent` on real values |
| P0-4 | **Replace hardcoded Runway scenarios** with real modeling | Frontend + Finance | 4-6 hrs | Scenarios use actual burn/revenue; no hardcoded dollar amounts |
| P0-5 | **Delete `src/lib/calculations.ts`** (434 lines, orphaned, wrong transfer logic) | Frontend | 30 min | File removed; build passes; zero imports affected |
| P0-6 | **Fix `potentialSavings`** to sum actual flagged subscription monthly amounts | Finance Engineer | 2-3 hrs | Value equals sum of `toMonthly(amount)` for flagged subs |
| P0-7 | **Replace fake subscription trend** with real historical query | Frontend + DB | 3-4 hrs | Chart queries `subscriptions` or `transactions` for actual past spend |
| P0-8 | **Remove hardcoded `+3.2%` subscription growth** | Frontend | 1 hr | Value computed from real MoM data |

### P1 — Product Integrity (Fix Within 2 Weeks)

| # | Action | Owner | Effort | Acceptance Criteria |
|---|--------|-------|--------|---------------------|
| P1-1 | **Remove Health Score card** (opaque composite) | Frontend | 1 hr | Card no longer visible; no broken layout |
| P1-2 | **Remove Best Case Runway card** (fake scenario) | Frontend | 1 hr | Card no longer visible |
| P1-3 | **Remove Revenue Growth card** (redundant) | Frontend | 1 hr | Card no longer visible |
| P1-4 | **Remove all 4 Reports KPIs** | Frontend | 1-2 hrs | KPIs removed; page still functional for file management |
| P1-5 | **Remove all 4 AI Insights count KPIs** | Frontend | 1-2 hrs | KPIs removed; insights list still visible |
| P1-6 | **Remove all 4 Agent Tasks count KPIs** | Frontend | 1-2 hrs | KPIs removed; task list still visible |
| P1-7 | **Remove Closing Balance from Cash Flow** or make it real | Frontend + Finance | 2-3 hrs | Either removed or computed from `bank_accounts` |
| P1-8 | **Fix `getTransactionStats` transfer exclusion** | Backend | 2 hrs | All transaction stats exclude `is_transfer = true` |
| P1-9 | **Fix `getBudgetStats` transfer exclusion** | Backend | 2 hrs | Budget variance excludes transfers |
| P1-10 | **Fix Pipeline Balance Fallback transfer inclusion** | Backend | 2 hrs | Fallback path matches primary path |
| P1-11 | **Fix TopBar hardcoded date** to dynamic range picker | Frontend | 3-4 hrs | Date reflects selected range; updates across pages |
| P1-12 | **Remove `mockTasks` from AssistantDrawer** | Frontend | 1-2 hrs | Drawer shows real tasks or empty state |
| P1-13 | **Fix P&L pie chart percentages** (always 0) | Frontend | 2-3 hrs | Percentages render correctly and sum to 100% |
| P1-14 | **Fix Avg Profit Margin** to weighted average | Frontend | 2 hrs | Formula: `totalProfit / totalRevenue` across range |
| P1-15 | **Fix `getMetricsForRange` auth bypass** | Backend | 2-3 hrs | Function verifies `company_id` ownership |

### P2 — UX & Clarity (Fix Within 1 Month)

| # | Action | Owner | Effort | Acceptance Criteria |
|---|--------|-------|--------|---------------------|
| P2-1 | **Largest Category card shows amount + name** | Frontend | 1-2 hrs | Card displays `$X,XXX in [Category]` |
| P2-2 | **Move Transactions KPIs to Data Health panel** | Frontend | 2-3 hrs | New panel or section; main KPIs are financial |
| P2-3 | **Collapse Info + Resolved alerts by default** | Frontend | 1 hr | Alerts page loads with non-critical sections collapsed |
| P2-4 | **Rename P&L "Avg Margin" → "Avg Profit Margin"** | Frontend | 15 min | Label updated |
| P2-5 | **Rename Revenue "Monthly Recurring" → "MRR"** | Frontend | 15 min | Label updated |
| P2-6 | **Refactor 8 page files to use `@/lib/reporting`** | Frontend | 8-12 hrs | No inline category/margin/burn/runway duplication |
| P2-7 | **Fix custom range cache key collision** | Backend | 3-4 hrs | Different custom ranges return different cached values |
| P2-8 | **Add cache invalidation on manual edits** | Backend | 3-4 hrs | Editing a transaction triggers cache refresh within 1 min |
| P2-9 | **Add missing composite index** on `company_metrics` | DB | 1-2 hrs | Migration created; query planner shows index usage |
| P2-10 | **Fix `calculateGrowthRate` division by zero** | Frontend | 1 hr | Returns `null` or `Infinity`; UI handles gracefully |
| P2-11 | **Fix `identifyMoneyLeaks` arbitrary threshold** | Frontend | 2 hrs | Threshold is configurable or percentile-based |
| P2-12 | **Document `calculateChangePercent` caveat** | Frontend | 30 min | JSDoc added; or switch to signed delta |
| P2-13 | **Remove `getMockDashboardMetrics` from production** | Frontend | 1 hr | Mock fallback removed; empty state shown instead |
| P2-14 | **Fix Budget Recommendations** to real variance logic | Frontend + Finance | 3-4 hrs | Recommendations derived from actual budget variance |
| P2-15 | **Fix Subscription Insights** to real anomaly data | Frontend + Finance | 3-4 hrs | Insights derived from `agent_recommendations` or detection |
| P2-16 | **Fix Best Case Runway** description/value alignment | Frontend | 2 hrs | Either update description or rebuild scenario engine |
| P2-17 | **Improve Subscription Health Score** with revenue context | Frontend + Finance | 3-4 hrs | Score is relative to revenue or replaced with actionable metric |
| P2-18 | **Refine One-Time Revenue** assumption | Frontend + Finance | 2-3 hrs | Use `is_recurring` flag or explicit metadata tagging |
| P2-19 | **Align alert category enums** between code and DB | Backend | 2 hrs | No runtime enum mismatches |
| P2-20 | **Add `updated_at` to `agent_activity_logs`** | DB | 1 hr | Migration created; audit trail complete |

### P3 — Strategic KPI Expansion (Backlog)

| # | Action | Owner | Effort | Acceptance Criteria |
|---|--------|-------|--------|---------------------|
| P3-1 | **Implement ARR** = MRR × 12 | Finance + Frontend | 2-3 hrs | New KPI card on Revenue page |
| P3-2 | **Implement Gross Margin** = `(Revenue - COGS) / Revenue` | Finance + Frontend | 3-4 hrs | Requires COGS category mapping |
| P3-3 | **Implement EBITDA** approximation | Finance + Frontend | 4-6 hrs | Requires OpEx categorization |
| P3-4 | **Implement Burn Multiple** = `Net Burn / Net New ARR` | Finance + Frontend | 3-4 hrs | New KPI on Runway or Dashboard |
| P3-5 | **Implement CAC** (Customer Acquisition Cost) | Finance + Frontend | 4-6 hrs | Requires sales/marketing spend tagging |
| P3-6 | **Implement LTV** (Lifetime Value) | Finance + Frontend | 4-6 hrs | Requires churn + ARPU data |
| P3-7 | **Implement LTV:CAC ratio** | Finance + Frontend | 1-2 hrs | Derived from P3-5 and P3-6 |
| P3-8 | **Implement Churn Rate** | Finance + Frontend | 3-4 hrs | Requires customer count tracking |
| P3-9 | **Implement NDR** (Net Dollar Retention) | Finance + Frontend | 4-6 hrs | Requires cohort revenue tracking |
| P3-10 | **Implement Revenue per Employee** | Finance + Frontend | 2-3 hrs | Requires headcount input |
| P3-11 | **Implement Expense Ratio** = `OpEx / Revenue` | Finance + Frontend | 2-3 hrs | New KPI on P&L or Dashboard |
| P3-12 | **Implement Rule of 40** = `Growth % + Profit Margin %` | Finance + Frontend | 2-3 hrs | New KPI on Dashboard |
| P3-13 | **Implement Outstanding Invoices** | Finance + Frontend | 3-4 hrs | Requires accounts receivable tracking |
| P3-14 | **Implement Deferred Revenue** | Finance + Frontend | 3-4 hrs | Requires contract term tracking |
| P3-15 | **Implement Headcount** | Frontend | 2-3 hrs | Manual input or HR integration |
| P3-16 | **Implement Bank Account Breakdown** | Frontend | 2-3 hrs | List view of `bank_accounts` with balances |
| P3-17 | **Build AI reasoning layer** | AI Engineer | 2-3 weeks | Replace `DeterministicLLM` with real context + LLM calls |
| P3-18 | **Connect `buildCompanyContext` to assistant** | AI Engineer | 1 week | Context builder invoked per message |
| P3-19 | **Add period-over-period comparisons to AI context** | AI Engineer | 3-4 days | AI can discuss trends conversationally |
| P3-20 | **Add unit test suite for reporting library** | QA Engineer | 1 week | `npm test` covers all `src/lib/reporting/` functions |
| P3-21 | **Add KPI value-correctness E2E tests** | QA Engineer | 1-2 weeks | E2E tests verify metric math, not just visibility |
| P3-22 | **Add API/integration tests for upload→pipeline→UI** | QA Engineer | 1-2 weeks | Full data flow verified in CI |

---

## 10. Appendix: Missing KPIs

The following SaaS-founder-critical KPIs are **not yet implemented** in FounderAgent. They are grouped by domain and prioritized by founder value.

### Revenue & Growth

| KPI | Formula | Why It Matters | Effort |
|-----|---------|----------------|--------|
| **ARR** | MRR × 12 | The north-star metric for SaaS valuation | Low |
| **Gross Margin** | `(Revenue - COGS) / Revenue` | Unit economics health; investor scrutiny | Medium |
| **EBITDA** | `Revenue - OpEx` (approx) | Profitability snapshot | Medium |
| **Burn Multiple** | `Net Burn / Net New ARR` | Capital efficiency; benchmarked by VCs | Medium |
| **Rule of 40** | `Growth % + Profit Margin %` | SaaS health benchmark | Low |
| **NDR (Net Dollar Retention)** | `(Starting ARR + Expansions - Contractions - Churn) / Starting ARR` | Revenue quality; best-in-class >120% | High |
| **Churn Rate** | `Churned Customers / Total Customers` | Retention health; directly impacts LTV | Medium |
| **Revenue per Employee** | `ARR / Headcount` | Operational efficiency benchmark | Low |

### Sales & Marketing Efficiency

| KPI | Formula | Why It Matters | Effort |
|-----|---------|----------------|--------|
| **CAC** | `Sales & Marketing Spend / New Customers` | Unit cost of acquisition | Medium |
| **LTV** | `ARPU / Churn Rate` (or cohort-based) | Total value of a customer | Medium |
| **LTV:CAC Ratio** | `LTV / CAC` | Viability of unit economics; target >3:1 | Low |
| **Payback Period** | `CAC / (ARPU × Gross Margin)` | Time to recover acquisition cost | Low |

### Cash & Balance Sheet

| KPI | Formula | Why It Matters | Effort |
|-----|---------|----------------|--------|
| **Outstanding Invoices** | Sum of unpaid AR | Cash collection risk | Medium |
| **Deferred Revenue** | Cash collected before service delivery | Liability tracking; SaaS norm | Medium |
| **Bank Account Breakdown** | List of `bank_accounts` with balances | Visibility into cash fragmentation | Low |
| **Expense Ratio** | `OpEx / Revenue` | Cost discipline relative to scale | Low |

### Team & Operations

| KPI | Formula | Why It Matters | Effort |
|-----|---------|----------------|--------|
| **Headcount** | Total active employees | Runway and efficiency denominator | Low |
| **Revenue per Employee** | `ARR / Headcount` | Productivity benchmark | Low |
| **Burn per Employee** | `Monthly Burn / Headcount` | Cost efficiency | Low |

### AI & Intelligence

| Capability | Why It Matters | Effort |
|------------|----------------|--------|
| Period-over-period trend narration | Founders need context, not just numbers | Medium |
| Anomaly explanation in chat | "Why did burn spike 40% this month?" | Medium |
| Cross-domain synthesis | "Cloud spend is up 20% and your runway dropped 2 months" | High |
| Recommendation actionability | One-click implementation with impact tracking | High |

---

## Document Control

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-05-27 | Victor Huang | Initial compilation from 7 specialist agent findings |

**Sources:**
- Amelia Grant — Product Architect
- Marcus Reed — Finance Metrics Architect
- Priya Shah — DB/Data Flow Architect
- Ethan Brooks — Reporting Engineer
- Naomi Chen — AI Insight Architect
- Daniel Okafor — Frontend Architect
- Oliver Stone — QA Engineer

---
*End of Report*
