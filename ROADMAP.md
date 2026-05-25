# FounderAgent — Product Roadmap

## Current Phase: Architecture & Design Foundation (COMPLETE)

**Status**: Build passing, all pages render, mock data wired to calculation engine.

### What Works Today
- Premium dark Obsidian/Teal/Violet UI
- Responsive layout with mobile sidebar drawer
- Dashboard with real-time KPI calculations (burn, runway, margins)
- Transaction table with search, filter, sort
- P&L report with monthly breakdown
- Subscription tracker with annualized spend
- AI Insights feed with priority badges
- Upload Centre with drag-and-drop UX
- Settings with toggle switches and forms
- Smart categorisation engine (30+ merchant rules)
- Financial calculation utilities (runway, health score, growth rates)
- Supabase client placeholders + DB service layer stubs

---

## Phase 1: Data Layer (Next)
**Goal**: Replace mock data with Supabase persistence.

- [ ] Install `@supabase/supabase-js`
- [ ] Un-comment and secure `src/lib/supabase.ts`
- [ ] Implement `src/lib/db.ts` functions with real queries
- [ ] Add server-side data fetching to dashboard pages
- [ ] Seed database with realistic demo dataset
- [ ] Add caching layer (SWR or React Query)

**Tables Required**: `users`, `businesses`, `financial_accounts`, `transactions`, `subscriptions`, `monthly_p_and_l_reports`, `ai_insights`, `categorisation_rules`, `audit_logs`

---

## Phase 2: Authentication & Tenancy
**Goal**: Secure the app with multi-tenant access.

- [ ] Supabase Auth integration
- [ ] Login / signup pages
- [ ] Route guards for `(dashboard)`
- [ ] Business isolation via `business_id`
- [ ] Role-based UI (founder, accountant, admin)
- [ ] Audit log writes on mutations

---

## Phase 3: File Upload & Parsing
**Goal**: Turn Upload Centre into a real ingestion pipeline.

- [ ] Supabase Storage bucket for statements
- [ ] CSV parser with column mapping UI
- [ ] PDF statement parser (OCR or bank-specific templates)
- [ ] Stripe / PayPal payout CSV importers
- [ ] Background processing queue (edge functions)
- [ ] Upload progress and error states

---

## Phase 4: AI Insights Engine
**Goal**: Generate insights from real transaction patterns.

- [ ] Anomaly detection (expense spikes, duplicate subscriptions)
- [ ] Margin trend analysis
- [ ] Runway projection with scenario modeling
- [ ] Subscription consolidation recommendations
- [ ] Weekly digest email generation
- [ ] OpenAI / Claude API integration for natural language summaries

---

## Phase 5: Bank Sync
**Goal**: Live transaction feeds.

- [ ] Plaid Link integration
- [ ] Account connection UI
- [ ] Daily sync schedule
- [ ] Reconciliation workflow
- [ ] Balance tracking

---

## Phase 6: Polish & Scale
**Goal**: Production hardening.

- [ ] Error boundaries and loading skeletons
- [ ] E2E tests (Playwright)
- [ ] Performance budgets and bundle analysis
- [ ] Rate limiting and security headers
- [ ] Custom domain + Vercel production deploy
- [ ] Onboarding flow for new businesses

---

**Last Updated**: May 22, 2026
