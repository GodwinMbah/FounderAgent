# FounderAgent Global Date Filter Architecture Correction QA Report

**Date:** 2026-05-29  
**Auditor:** Kimi Code CLI (Global Date Filter Correction Phase)  
**Build:** ✅ Pass (23 routes, 0 TypeScript errors, 0 ESLint errors, 0 warnings)  
**Tests:** 70/70 Playwright E2E tests passing, 49/49 Vitest unit tests passing  

---

## Executive Summary

The Global Date Filter Architecture Correction phase has been completed successfully. The previous implementation had two independent date filter systems (TopBar global + page-level pickers) that worked independently, violating the core product requirement of a single reporting period across the entire application.

The new architecture establishes **URL search parameters as the primary source of truth**, backed by **cookie persistence** for navigation links. All page-level DateRangePickers have been removed. The TopBar global date picker is now the sole control point, visible on all viewports including mobile. Cross-page synchronisation is proven through browser testing.

---

## Sub Agent Plan Summary

This phase was executed by a single agent with parallel subagent delegation for the bulk refactoring work:

| Subagent Role | Responsibility | Files Modified |
|---------------|----------------|----------------|
| Core Architecture | Server-side helper, TopBar, Sidebar | `date-range-server.ts`, `TopBar.tsx`, `Sidebar.tsx`, `AppShell.tsx` |
| Content Refactor (×8 parallel) | Strip page-level date pickers | `dashboard/content.tsx`, `revenue/content.tsx`, `expenses/content.tsx`, `cash-flow/CashFlowClient.tsx`, `budgets/BudgetsClient.tsx`, `runway/RunwayClient.tsx`, `transactions/content.tsx`, `pl-report/PLReportClient.tsx` |
| Page Server Components | Unify defaults to global helper | All 8 `page.tsx` files |
| DateRangePicker Component | Controlled mode support | `DateRangePicker.tsx` |
| E2E Test Engineer | Update tests for global architecture | `feature-validation.spec.ts`, `viewport-tests.spec.ts` |

---

## Problem Found

### Previous Implementation (Defective)

The P1 Product Integrity Sprint added a TopBar DateRangePicker that dispatched `CustomEvent("founderagent:datechange")` to notify page content components. However, every page ALSO retained its own DateRangePicker with independent `useState` for `preset` and `range`. The result:

- **Two parallel date systems** per page: TopBar + page-level
- **Independent behaviour**: Changing the TopBar updated the URL but page pickers stayed on their own state
- **Inconsistent defaults**: Dashboard defaulted to `last30`, Revenue to `thisYear`, Budgets to `thisMonth`, etc.
- **No server re-render**: `window.history.pushState` was used instead of `router.push`, so server components never re-fetched
- **Mobile had no global control**: TopBar picker was `hidden md:flex`, forcing reliance on page pickers

### Impact

A user selecting "Last 30 days" on Dashboard would see Dashboard update, but navigating to Revenue would show "This year" — the page's own hidden default. The product did not behave as a unified command centre.

---

## Architecture Chosen

### URL Search Params + Cookie Persistence

**Primary source of truth:** URL search parameters (`?preset=last30&from=YYYY-MM-DD&to=YYYY-MM-DD`)

**Backup persistence:** HTTP cookie (`founderagent-date-range`) with 30-day expiry

**Why this architecture:**

1. **Next.js App Router native** — Server components read `searchParams` directly; no global state management needed
2. **Visible and shareable** — Users can bookmark or share a specific reporting period
3. **Survives refresh** — URL params are preserved on browser refresh
4. **Survives navigation** — Cookie ensures sidebar links carry the global range even without explicit query params
5. **No Context/Redux/Zustand** — Simpler, no provider wrapping, no hydration mismatches
6. **SSR compatible** — Server components fetch correct data on first render

### Flow Diagram

```
User clicks preset in TopBar
        ↓
TopBar calls setGlobalDateRangeCookie() + router.push(pathname + '?' + params)
        ↓
Next.js re-renders current page server component with new searchParams
        ↓
Server component calls getGlobalDateRange(searchParams)
        ↓
getGlobalDateRange: URL params → cookie fallback → default "last30"
        ↓
Server fetches data for the global range
        ↓
Client component renders props (no date state management)
        ↓
Sidebar links append current query string → navigation preserves range
```

---

## How the New Global Source of Truth Works

### Server-Side: `src/lib/date-range-server.ts`

```typescript
export async function getGlobalDateRange(
  searchParams?: { preset?: string; from?: string; to?: string }
): Promise<{ preset: DateRangePreset; from: string; to: string; label: string }> {
  // 1. URL params first (bookmarkable, shareable)
  if (searchParams?.preset) {
    return getDateRange(searchParams.preset, searchParams.from, searchParams.to);
  }
  // 2. Cookie fallback (navigation preservation)
  const cookie = await parseCookie();
  if (cookie) {
    return getDateRange(cookie.preset, cookie.from, cookie.to);
  }
  // 3. Universal default
  return getDateRange("last30");
}
```

All 8 reporting page server components call `await getGlobalDateRange(searchParams)` — no per-page defaults.

### Client-Side: TopBar Controlled DateRangePicker

The TopBar uses `useRouter()` + `usePathname()` to push navigation with new query params. The DateRangePicker component was extended with controlled `open`/`onOpenChange` props so the TopBar manages the dropdown state while the picker renders only the popup content.

A `pendingPresetRef` coordinates between `onPresetChange` and `onChange` callbacks to prevent race conditions.

---

## How the TopBar Controls the App

1. **Desktop**: Full date range label visible next to calendar icon
2. **Mobile**: Compact label (first 2 words) + calendar icon, always visible in header
3. **Click**: Opens DateRangePicker dropdown/bottom sheet
4. **Preset select**: Updates cookie → pushes URL → Next.js re-renders page
5. **Custom range**: Date inputs + "Apply Custom Range" → same flow
6. **Navigation**: Sidebar links append `?preset=...&from=...&to=...` automatically

---

## How Mobile Date Filtering Works

The TopBar date picker is now **always visible** (`relative` positioning, no `hidden` classes). On small screens:

- The label is truncated to the first 2 words (e.g., "Last 30" instead of "Last 30 days")
- The DateRangePicker renders as a **bottom sheet** with dark backdrop (existing component behaviour)
- Same global state, same cookie, same URL sync

All viewport tests (390×844, 430×932, 768×1024, 1024×768, 1440×900) confirm the global picker is visible and functional.

---

## What Happened to Page-Level Date Pickers

**Removed entirely** from all 8 content components:

| Page | Before | After |
|------|--------|-------|
| Dashboard | DateRangePicker + fetchData + loading state | Read-only label |
| Revenue | DateRangePicker + fetchData + updateUrl | Read-only label |
| Expenses | DateRangePicker + fetchData + updateUrl | Read-only label |
| Cash Flow | DateRangePicker + fetchData + updateUrl | Read-only label |
| Budgets | DateRangePicker + fetchData + updateUrl | Read-only label |
| Runway | DateRangePicker + fetchData + updateUrl | Read-only label |
| P&L Report | DateRangePicker + fetchData + updateUrl | Read-only label |
| Transactions | DateRangePicker + client-side date filter | Server-side filtering + read-only label |

All `founderagent:datechange` event listeners removed. All date-related `useState`/`useCallback`/`useEffect` removed. Components now receive data purely from server props.

---

## Pages Updated

| Page | Server Component | Client Component |
|------|------------------|------------------|
| `/dashboard` | ✅ Uses `getGlobalDateRange` | ✅ Read-only label |
| `/revenue` | ✅ Uses `getGlobalDateRange` | ✅ Read-only label |
| `/expenses` | ✅ Uses `getGlobalDateRange` | ✅ Read-only label |
| `/cash-flow` | ✅ Uses `getGlobalDateRange` | ✅ Read-only label |
| `/budgets` | ✅ Uses `getGlobalDateRange` | ✅ Read-only label |
| `/runway` | ✅ Uses `getGlobalDateRange` | ✅ Read-only label |
| `/pl-report` | ✅ Uses `getGlobalDateRange` | ✅ Read-only label |
| `/transactions` | ✅ Uses `getGlobalDateRange` + server-side filter | ✅ Read-only label |

---

## Server-Side Data Fetching Behaviour

- Every reporting page server component calls `await getGlobalDateRange(searchParams)`
- If URL has `?preset=...`, that preset is used
- If URL has no params, cookie is checked
- If no cookie, universal default `"last30"` is used
- The returned `{ from, to }` is passed to all DB query functions
- **Transactions**: Now filtered server-side (`startDate: from, endDate: to`) instead of client-side

---

## Client-Side Synchronisation Behaviour

- **No client-side date state** in page content components
- **No event listeners** for global date changes
- **No `fetchData` callbacks** for date changes
- When URL changes via `router.push()`, Next.js automatically re-renders the server component
- The server component fetches fresh data with the new range
- The client component receives new props and re-renders

This is the standard Next.js App Router data flow — no custom synchronisation mechanism needed.

---

## Persistence Across Refresh

- **URL params** are preserved on refresh (browser behaviour)
- **Cookie** (`founderagent-date-range`) serves as fallback if URL params are lost
- **Cookie expiry**: 30 days
- **Cookie attributes**: `sameSite: lax`, `path: "/"`, secure in production

Tested: Load `/dashboard?preset=last7` → refresh → URL and range preserved.

---

## Custom Range Handling

1. User selects "Custom" in TopBar
2. Inputs `from` and `to` dates
3. Clicks "Apply Custom Range"
4. URL updates to `?preset=custom&from=YYYY-MM-DD&to=YYYY-MM-DD`
5. Cookie stores the same values
6. All pages use this exact range
7. **No cache collision**: Custom ranges were already handled in P1 (skip cache upsert)

---

## Browser Click-Through Test Results

| Test | Result |
|------|--------|
| Login → Dashboard | ✅ Pass |
| TopBar preset select (Last 7 days) | ✅ Pass |
| TopBar custom range select | ✅ Pass |
| Dashboard → Revenue (sync verification) | ✅ Pass |
| Transactions → Dashboard (sync verification) | ✅ Pass |
| Refresh with preset in URL | ✅ Pass |
| Custom range across navigation | ✅ Pass |
| Mobile global picker accessible (390×844) | ✅ Pass |
| Exactly one date picker on Dashboard | ✅ Pass |
| No independent page-level pickers | ✅ Pass |

---

## Mobile Test Results

| Viewport | Global Picker Visible | Bottom Sheet Opens | Pass |
|----------|----------------------|-------------------|------|
| Desktop 1440×900 | ✅ Yes | N/A (dropdown) | ✅ |
| Tablet 1024×768 | ✅ Yes | N/A (dropdown) | ✅ |
| Small tablet 768×1024 | ✅ Yes | N/A (dropdown) | ✅ |
| Large mobile 430×932 | ✅ Yes | ✅ Yes | ✅ |
| Small mobile 390×844 | ✅ Yes | ✅ Yes | ✅ |

---

## Build Result

```
✓ Compiled successfully in 2.4s
✓ Running TypeScript ... Finished TypeScript in 2.4s
✓ Generating static pages using 9 workers (23/23) in 133ms
```

**TypeScript errors:** 0  
**ESLint errors:** 0  
**Warnings:** 0  

---

## Lint Result

```bash
npm run lint
# 0 errors, 0 warnings
```

---

## Unit Test Result

```
Test Files  3 passed (3)
     Tests  49 passed (49)
  Duration  103ms
```

All existing KPI, filter, and aggregate tests pass with no regressions.

---

## Playwright E2E Result

```
70 passed (3.8m)
```

**Test suites:**
- `trust-verification.spec.ts`: 9/9 ✅
- `feature-validation.spec.ts`: 12/12 ✅ (includes 8 new global date filter tests)
- `viewport-tests.spec.ts`: 25/25 ✅
- `upload-flow.spec.ts`: 17/17 ✅
- `confidence-tiers.spec.ts`: 4/4 ✅
- `persistence.spec.ts`: 3/3 ✅

---

## Remaining Limitations

1. **Non-reporting pages** (Settings, Upload Centre, Login, Signup) do not display the global date range — this is by design as they have no date-filtered data.
2. **Entity list pages** (Subscriptions, Alerts, AI Insights, Agent Tasks, Reports) display the global range label but may not filter their entity lists by date — these are current-state views. If date filtering is desired for these pages, it must be added in a future phase.
3. **Cash Balance** and **Runway** metrics use current point-in-time data (cash balance from bank accounts table, burn from trailing 3-month average) — they are not strictly filtered by the global date range, which is mathematically correct for these metrics.

---

## Recommended Next Phase

1. **P3 Strategic KPI Expansion**: Implement ARR, Gross Margin, Burn Multiple, Rule of 40 in the reporting engine and dashboard
2. **P4 Real AI Reasoning Layer**: Replace deterministic templates with statistical anomaly detection and trend forecasting
3. **Date Filter on Entity Lists**: Add date filtering to Subscriptions, Alerts, and Reports if product requirements demand it

---

*Report produced by: Kimi Code CLI*  
*Date: 2026-05-29*  
*Status: ✅ COMPLETE — All acceptance criteria met*
