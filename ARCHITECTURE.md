# FounderAgent — Architecture & Development Guide

## Overview
FounderAgent is an AI-powered finance intelligence platform for founders. It connects to Supabase for real data, supports multi-tenant company isolation, and features an autonomous agent system for financial analysis and recommendations.

## Tech Stack
- **Framework**: Next.js 16.2.6 (App Router, Turbopack)
- **Language**: TypeScript 5
- **Styling**: Tailwind CSS v4
- **UI**: Custom components, Lucide React icons
- **Charts**: Recharts 3.8.1
- **Backend**: Supabase (PostgreSQL, Auth, Storage)
- **Auth**: Supabase Auth with email/password

## Project Structure

```
FounderAgent/
├── src/
│   ├── app/
│   │   ├── layout.tsx              # Root layout (fonts, metadata)
│   │   ├── page.tsx                # Redirect to /dashboard
│   │   ├── globals.css             # Design tokens & base styles
│   │   ├── login/page.tsx          # Auth login
│   │   ├── signup/page.tsx         # Auth signup
│   │   ├── auth/callback/route.ts  # OAuth callback
│   │   └── (dashboard)/            # Protected routes
│   │       ├── layout.tsx          # Dashboard shell (AppShell)
│   │       ├── dashboard/page.tsx  # Overview
│   │       ├── transactions/page.tsx
│   │       ├── subscriptions/page.tsx
│   │       ├── expenses/page.tsx
│   │       ├── revenue/page.tsx
│   │       ├── cash-flow/page.tsx
│   │       ├── runway/page.tsx
│   │       ├── budgets/page.tsx
│   │       ├── pl-report/page.tsx
│   │       ├── reports/page.tsx
│   │       ├── ai-insights/page.tsx
│   │       ├── agent-tasks/page.tsx # NEW: Agent task management
│   │       ├── alerts/page.tsx
│   │       ├── upload-centre/page.tsx
│   │       └── settings/page.tsx
│   │
│   ├── components/
│   │   ├── layout/                 # Shell components
│   │   │   ├── AppShell.tsx
│   │   │   ├── Sidebar.tsx
│   │   │   ├── TopBar.tsx
│   │   │   └── AssistantContext.tsx
│   │   ├── ui/                     # Primitive UI components
│   │   │   ├── Card.tsx
│   │   │   ├── Badge.tsx
│   │   │   ├── MetricCard.tsx
│   │   │   ├── ChartCard.tsx
│   │   │   ├── DataTable.tsx
│   │   │   └── PageHeader.tsx
│   │   ├── features/               # Feature-specific components
│   │   │   ├── assistant/
│   │   │   │   └── AssistantDrawer.tsx
│   │   │   └── dashboard/
│   │   │       └── AgentBanner.tsx
│   │   ├── brand/
│   │   │   └── BrandLogo.tsx
│   │   └── AgentOrb.tsx
│   │
│   └── lib/
│       ├── types.ts                # TypeScript types (aligned with Supabase)
│       ├── calculations.ts         # Financial calculations
│       ├── categorisation.ts       # Smart categorisation engine
│       ├── auth.ts                 # Server auth actions
│       ├── env.ts                  # Environment validation
│       ├── supabase/
│       │   ├── client.ts           # Browser client (public key)
│       │   ├── server.ts           # Server client (SSR cookies)
│       │   ├── admin.ts            # Admin client (service role)
│       │   └── middleware.ts       # Session refresh helper
│       ├── db/                     # Data access layer
│       │   ├── index.ts            # Re-exports
│       │   ├── mock-data.ts        # Fallback demo data
│       │   ├── transactions.ts
│       │   ├── subscriptions.ts
│       │   ├── budgets.ts
│       │   ├── alerts.ts
│       │   ├── reports.ts
│       │   ├── agent-tasks.ts
│       │   ├── agent-recommendations.ts
│       │   ├── uploads.ts
│       │   └── metrics.ts
│       ├── hooks/
│       │   └── useAuth.ts          # Client auth state
│       └── utils/
│           ├── formatters.ts       # Currency, date, number formatters
│           └── constants.ts        # Color maps, status mappings
│
├── public/assets/                  # Static assets
│   ├── founderagent_logo_transparent.png
│   ├── founderagent_orb_icon_transparent.png
│   └── obsidian_teal_violet_reference.png
│
├── supabase/
│   ├── migrations/
│   │   └── 003_full_schema.sql     # Complete schema
│   └── seed_new_schema.sql         # Demo data
│
├── .env.local                      # Real Supabase credentials
├── .env.example                    # Template
├── SUPABASE_SCHEMA.md
├── AGENTS.md
├── BUILD_SUMMARY.md
└── QUICKSTART.md
```

## Design System

### Color Palette
| Token | Hex | Usage |
|-------|-----|-------|
| `--background` | `#09090B` | Page background |
| `--foreground` | `#f1f5f9` | Primary text |
| `--card` | `#111827` | Card surfaces |
| `--accent` | `#14b8a6` | Primary actions, teal |
| `--highlight` | `#8b5cf6` | AI moments, violet |
| `--success` | `#22c55e` | Positive metrics |
| `--warning` | `#fbbf24` | Warnings |
| `--danger` | `#f43f5e` | Risk, critical |
| `--muted-foreground` | `#94a3b8` | Secondary text |
| `--border` | `#27272a` | Borders |

### Typography
- Font: Geist (sans), Geist Mono (mono)
- Weights: 400, 500, 600, 700

## Auth Flow
1. User visits `/login` or `/signup`
2. Supabase Auth creates session
3. Middleware refreshes session cookie on every request
4. Signup creates: profile + company + company_member link
5. All data queries are scoped to user's company via RLS

## Data Flow
```
Page Component → Data Layer (src/lib/db/*.ts) → Supabase Client
                    ↓
              Fallback to mock-data.ts if Supabase not configured
```

## Agent System
The agentic layer consists of:
- **Agent Tasks**: User-requested or scheduled tasks (research, detect, forecast)
- **Agent Recommendations**: AI-generated actionable insights with impact/effort scores
- **Agent Activity Logs**: Audit trail of all agent actions

## Security
- Service role key is NEVER used in client-side code
- All tables have RLS enabled
- Company isolation via `get_user_company_ids()` function
- Auth middleware protects `(dashboard)` routes
