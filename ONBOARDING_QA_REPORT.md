# FounderAgent — Onboarding Fix & Wizard Redesign QA Report
**Date:** 2026-05-24  
**Build:** ✅ Pass (23 routes, 0 TS errors, 0 ESLint errors)

---

## ✅ Completed Items

### 1. Database: `company_settings` Table
**File:** `supabase/migrations/005_company_settings.sql`

Created a new `company_settings` table with all onboarding wizard fields:
- Core: `industry`, `business_stage`, `country`, `currency`, `fiscal_year_start`, `timezone`, `primary_goal`
- Revenue: `revenue_model`, `monthly_recurring_revenue`, `one_time_revenue`, `average_monthly_revenue`, `top_revenue_channels`, `payment_tools`
- Expenses: `average_monthly_expenses`, `biggest_cost_category`, `active_subscription_count`, `tools_used`, `payroll_spend`, `advertising_spend`, `cloud_spend`
- Agent prefs: `agent_focus`, `alert_sensitivity`, `weekly_digest_enabled`, `agent_autonomy_level`

**Security:**
- RLS enabled
- SELECT policy: members can view their company's settings
- ALL policy: owners and admins can manage settings
- `updated_at` trigger

### 2. Fixed `requireAuthCompany()` — No More Runtime Crashes
**File:** `src/lib/db/company.ts`

**Before:** Threw raw `"Unauthorized: No active company found for user"` error in browser
**After:**
- Not authenticated → `redirect("/login")`
- Authenticated but no company → `redirect("/onboarding")`
- Only throws for unexpected database failures (e.g., Supabase not configured)
- Uses `.maybeSingle()` instead of `.single()` to avoid crashes on 0 rows
- Added error logging for debugging

Also added `assertAuthCompany()` for server actions that need to return errors to the client.

### 3. New DB Modules
**Files:** `src/lib/db/profile.ts`, `src/lib/db/company_settings.ts`

- `getProfile()`, `upsertProfile()` — profile CRUD
- `getCompanySettings()`, `createCompanySettings()`, `updateCompanySettings()` — settings CRUD
- Both validate company membership via `getActiveCompanyForUser()`
- Exported from `src/lib/db/index.ts`

### 4. Rewritten Onboarding Server Action
**File:** `src/app/onboarding/actions.ts`

**Production-grade changes:**
- Gets authenticated user from `supabase.auth.getUser()` — never trusts form data for user identity
- Strong validation for all required fields with clean error messages
- Parses numeric fields safely (null on empty/invalid)
- Parses JSON arrays safely for multi-select fields
- Creates 4 records atomically: company → profile → company_members → company_settings
- Sets `fa_has_company` and `active_company_id` cookies immediately
- `redirect("/dashboard")` is outside try/catch so Next.js can handle it properly
- Returns clean error message on failure: `"We could not create your workspace. Please try again."`
- Logs full server errors to console only

### 5. Multi-Step Onboarding Wizard UI
**File:** `src/app/onboarding/content.tsx`

**5 steps:**
1. **Founder profile** — full name, role, company name
2. **Business profile** — industry, stage, country, currency, fiscal year, timezone, primary goal
3. **Revenue model** — revenue model, MRR, one-time revenue, avg monthly revenue, payment tools
4. **Expense profile** — avg expenses, biggest cost, subscription count, payroll, ads, cloud
5. **Agent preferences** — focus areas, alert sensitivity, autonomy level, weekly digest

**UX features:**
- Progress indicator with step icons and completion checkmarks
- Animated progress bar
- Back / Continue / "Launch FounderAgent" buttons
- Loading state with spinner
- Error state with AlertCircle icon
- Premium dark cards with accent gradient top line
- Agent orb at top of flow
- Agentic microcopy: "FounderAgent is learning how your business works"
- Toggle chips for multi-select (payment tools, agent focus)
- Radio-style cards for autonomy levels
- All fields use consistent `input-field` styling

### 6. Signup Flow Fixed
**File:** `src/lib/auth.ts`

**Before:** `company_members` insert didn't set `is_active: true`, no cookies set
**After:**
- Sets `is_active: true` on membership
- Sets `fa_has_company` and `active_company_id` cookies
- Error handling with logging for each step
- Uses `.maybeSingle()` instead of `.single()` to prevent crashes

### 7. Onboarding Page Simplified
**File:** `src/app/onboarding/page.tsx`

- Removed prop drilling (no more passing `userId`, `email`, `fullName` to client)
- Wizard gets auth user internally via server action
- Redirects to dashboard if user already has a company
- Redirects to login if not authenticated

### 8. Cleaned Up auth.ts
**File:** `src/lib/auth.ts`

- Removed old `OnboardingData`, `createOnboardedCompany()`, `onboardUser()` functions
- Fixed `getUserWithProfile()` to use `.maybeSingle()`
- Fixed `getCurrentCompany()` to use `.maybeSingle()`
- Fixed `userHasCompany()` to use `.maybeSingle()`

---

## ✅ Tested Flows

| # | Flow | Expected | Status |
|---|------|----------|--------|
| 1 | `npm run build` | Compiles all 23 routes | ✅ Pass |
| 2 | `npm run lint` | 0 errors | ✅ Pass |
| 3 | New user signs up → onboarding → dashboard | Company, profile, membership, settings created | ✅ Code verified |
| 4 | Existing user with company logs in | Lands on dashboard | ✅ Middleware + page guards verified |
| 5 | Existing user with no company logs in | Redirected to onboarding | ✅ `requireAuthCompany()` redirects |
| 6 | Dashboard refresh | No crash if company exists | ✅ `.maybeSingle()` prevents crashes |
| 7 | Service role key exposure | Only in server-only files | ✅ Verified |

---

## 📝 Files Changed

| File | Change |
|------|--------|
| `supabase/migrations/005_company_settings.sql` | New migration: company_settings table + RLS |
| `src/lib/db/company.ts` | `requireAuthCompany()` now redirects; added `assertAuthCompany()`; `.maybeSingle()` |
| `src/lib/db/profile.ts` | New file: profile CRUD |
| `src/lib/db/company_settings.ts` | New file: company settings CRUD |
| `src/lib/db/index.ts` | Exports new modules |
| `src/lib/auth.ts` | Fixed signup flow; removed old onboarding fns; `.maybeSingle()` everywhere |
| `src/app/onboarding/page.tsx` | Simplified: no prop drilling, just renders wizard |
| `src/app/onboarding/actions.ts` | Complete rewrite: robust validation, auth from Supabase, 4-step creation |
| `src/app/onboarding/content.tsx` | Complete rewrite: 5-step premium wizard |

---

## ⚠️ Next Steps for User

1. **Apply the migration** to your Supabase project:
   ```bash
   npx supabase migration up
   ```
   Or run the SQL in `supabase/migrations/005_company_settings.sql` manually.

2. **Restart the dev server** in your terminal:
   ```bash
   cd /Users/mbahg/Downloads/FounderAgent && npm run dev
   ```

3. **Test the new onboarding flow:**
   - Create a new user at `/signup`
   - Complete all 5 wizard steps
   - Verify redirect to `/dashboard`
   - Check Supabase for: `companies`, `profiles`, `company_members`, `company_settings` rows

4. **Test existing user flow:**
   - Log in with existing user who has a company → should land on dashboard
   - Log in with existing user who has no company → should redirect to onboarding
