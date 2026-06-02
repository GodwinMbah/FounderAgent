# FounderAgent Recovery Completion Plan

## Phase: Recovery Completion, KPI Drilldown, Dynamic Grid, Upload Preview Editing, Merchant Logo Intelligence, Browser QA, Auth Stabilisation, Final QA Sign Off

**Status:** Plan Ready for Approval  
**Previous State:** Build ✅ Lint ✅ Unit Tests 179/179 ✅ Playwright auth ❌

---

## 1. Sub-Agent Assignments

### Daniel Okafor — Senior Frontend Architecture Lead
**Scope:** All React/TypeScript UI implementation

**Tasks:**
1. **KPI Drilldown Drawer** (`src/components/features/dashboard/KPIDrilldownDrawer.tsx`)
   - Slide-over drawer from right (desktop), bottom sheet (mobile)
   - Accepts KPI config + metrics + monthlyMetrics + transactions
   - Sections: Title/Value, Date Range, Formula, Data Source, Calculation Breakdown, Previous Period, Underlying Transactions, Trend Chart, Data Quality Notes, Action Suggestions
   - Uses existing reporting functions (no duplicate calculations)
   - Wire into DashboardContent passing `onDrillDown` to each MetricCard

2. **Dynamic KPI Grid Refinement**
   - `getKPIGridClass` already exists — verify it handles 1-12 cards gracefully
   - Ensure priority ordering: core → saas → efficiency → risk → data quality
   - Add `order` field to KPI_CATALOG or sort in `getEligibleKPIs`
   - Test mobile layouts

3. **Mapping Field Visibility**
   - In WizardClient mapping step, inspect detected column mappings
   - If `amount` is mapped → hide `debit`/`credit` mapping fields
   - If `debit`/`credit` are mapped → show them, hide `amount`
   - If `money_in`/`money_out` detected → show those fields
   - Show/hide logic based on `preview.columnMappings`

4. **Preview Inline Category Editing + Apply to Similar**
   - Add editable category dropdown in preview table rows
   - Show confidence badge per row
   - "Apply to similar" button on rows with user-edited category
   - Similar matching: same merchant OR same description pattern
   - Update preview state optimistically
   - Pass corrected categories through to confirm import

5. **Merchant Logo Intelligence**
   - Expand `ProviderInfo` in registry to include `logoUrl?: string`
   - Add SVG/logo URLs for top 30 merchants (Stripe, PayPal, AWS, etc.)
   - Update `MerchantLogo` component to render image when available, fallback to initials
   - Use `next/image` with fallback handler
   - Display in: transactions table, upload preview, transaction detail

### Priya Shah — Senior Supabase Data Architect
**Scope:** Auth stabilisation and data integrity

**Tasks:**
1. **Playwright Auth Setup**
   - Verify `demo@acmelabs.com` user exists in local Supabase
   - Create `e2e/auth.setup.ts` that logs in and saves storage state
   - Update `playwright.config.ts` with `webServer` and `dependencies` for auth setup
   - Handle port 3000/3001 detection dynamically
   - Create `scripts/seed-e2e-user.ts` if user doesn't exist

2. **Company Scope Validation**
   - Verify all new features respect `company_id` boundaries
   - Check user correction rules, upload sessions, transactions

### Ethan Brooks — Senior Reporting Service Engineer
**Scope:** KPI drilldown data layer

**Tasks:**
1. **KPI Drilldown Data Functions** (`src/lib/business-intelligence/kpi-drilldown.ts`)
   - `getKPIDrilldownData(kpiId, metrics, monthlyMetrics, transactions)`
   - Returns: formula, dataSource, breakdown, previousPeriod, trendData, transactions, qualityNotes, suggestions
   - Uses existing `calculateChangePercent`, `formatKPIValue`
   - No duplicate calculations — everything derived from passed data

### Naomi Chen — Senior AI Context Architect
**Scope:** Structured data for future P4 AI reasoning

**Tasks:**
1. **Merchant Identity Layer** (`src/lib/intelligence/merchant-identity.ts`)
   - Structured merchant object: name, key, domain, logoUrl, logoSource, category, confidence, lastEnriched, fallbackInitials, fallbackColor
   - Export functions that P4 can consume
   - Document schema for AI reasoning compatibility

2. **Category Correction Context**
   - Ensure user correction rules are structured with signals (merchant/description/reference/provider/direction)
   - Document how P4 will read correction history

### Sofia Martinez — Senior UX and Mobile Architect
**Scope:** Responsive design verification

**Tasks:**
1. Review all Daniel implementations for mobile
2. Test KPI drawer on small screens (bottom sheet vs slide-over)
3. Test upload preview editing on mobile
4. Test merchant logos on mobile
5. Document any UX issues

### Grace Williams — Senior Browser QA Engineer
**Scope:** End-to-end browser testing

**Tasks:**
1. Run Playwright tests after Priya fixes auth
2. Manual click-through QA on all flows
3. Document browser test results

### Oliver Stone — Senior Test Coverage Engineer
**Scope:** Unit and integration tests

**Tasks:**
1. Unit tests for KPI drilldown data generation
2. Unit tests for merchant logo resolution
3. Unit tests for mapping field visibility logic
4. Unit tests for "apply to similar" matching
5. Update existing tests if needed

### Victor Huang — Senior QA Report Engineer
**Scope:** Final QA report production

**Tasks:**
1. Compile QA report after all work complete
2. Include all required sections from brief

---

## 2. Execution Order

```
Phase 1 (Parallel):
  ├─ Priya: Auth setup + webServer config
  ├─ Ethan: KPI drilldown data functions
  ├─ Naomi: Merchant identity layer schema
  └─ Oliver: Test scaffolding

Phase 2 (Parallel, depends on Phase 1):
  ├─ Daniel: KPI drilldown drawer + dynamic grid
  ├─ Daniel: Mapping field visibility
  ├─ Daniel: Preview inline editing
  └─ Daniel: Merchant logo intelligence

Phase 3 (Depends on Phase 2):
  ├─ Sofia: Mobile UX review
  ├─ Grace: Browser QA
  └─ Oliver: Update/add tests

Phase 4:
  └─ Victor: Final QA report
```

---

## 3. Key Files to Create/Modify

### New Files
- `src/components/features/dashboard/KPIDrilldownDrawer.tsx`
- `src/lib/business-intelligence/kpi-drilldown.ts`
- `src/lib/intelligence/merchant-identity.ts`
- `src/components/features/transaction/MerchantLogoImage.tsx`
- `e2e/auth.setup.ts`
- `scripts/seed-e2e-user.ts`

### Modified Files
- `src/app/(dashboard)/dashboard/content.tsx` — add drilldown drawer
- `src/components/ui/MetricCard.tsx` — already has prop, verify wiring
- `src/lib/business-intelligence/kpi-eligibility.ts` — add ordering
- `src/app/(dashboard)/upload-centre/WizardClient.tsx` — mapping visibility, preview editing
- `src/lib/providers/registry.ts` — add logo URLs
- `src/components/features/transaction/MerchantLogo.tsx` — image support
- `playwright.config.ts` — webServer, auth dependencies

---

## 4. Risk Assessment

| Risk | Mitigation |
|------|------------|
| Scope too large for single session | Prioritise: drilldown > auth > logos > preview editing > mapping visibility |
| Playwright auth requires live Supabase | Create seed script; fall back to demo mode if Supabase unavailable |
| Merchant logo URLs may break | Use local SVG assets or reliable CDN with fallback |
| Upload preview editing is complex | Start with single-row edit, then add "apply to similar" |

---

## 5. Acceptance Criteria Checklist

- [ ] KPI drilldown drawer opens and shows real data
- [ ] Dynamic grid works for 4-12 cards on all breakpoints
- [ ] Mapping fields hide/show based on CSV structure
- [ ] Preview category editing works (single row)
- [ ] "Apply to similar" works for merchant/description matching
- [ ] Merchant logos display for known merchants
- [ ] Initials fallback for unknown merchants
- [ ] Playwright auth setup works locally
- [ ] Build passes
- [ ] Lint passes
- [ ] Unit tests pass (≥179)
- [ ] QA report produced
