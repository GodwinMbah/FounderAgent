# FounderAgent — Quick Start Guide

## Prerequisites

- Node.js 18+
- npm 9+

## Installation

```bash
npm install
npm run dev
# open http://localhost:3000
```

The app redirects `/` → `/dashboard` automatically.

## Project Tour

| Route | Feature |
|-------|---------|
| `/dashboard` | KPIs, charts, transactions, health score, insights |
| `/transactions` | Searchable/filterable transaction table |
| `/pl-report` | Monthly P&L + expense/revenue breakdown |
| `/subscriptions` | Subscription list + annualized spend |
| `/ai-insights` | AI insight feed with priority cards |
| `/upload-centre` | Drag & drop file upload |
| `/settings` | Profile, notifications, security |

## Folder Structure

```
src/
├── app/                    # Next.js App Router pages
├── components/
│   ├── layout/             # AppShell, Sidebar, TopBar
│   ├── ui/                 # Primitives: Card, Badge, ProgressBar, ScoreRing
│   └── features/           # Dashboard, Transactions, Subscriptions, etc.
└── lib/
    ├── types.ts            # TypeScript models
    ├── data.ts             # Mock data
    ├── calculations.ts     # Financial math
    ├── categorisation.ts   # Smart categorisation engine
    ├── supabase.ts         # Supabase client (placeholder)
    ├── db.ts               # Database service layer (placeholder)
    ├── utils/              # Formatters, constants
    └── hooks/              # React hooks for data composition
```

## Commands

```bash
npm run dev     # Development server
npm run build   # Production build
npm run lint    # ESLint
npx tsc --noEmit # TypeScript check
```

## Connect Supabase (Optional)

1. Copy `.env.example` → `.env.local`
2. Add your Supabase URL and keys
3. Run SQL from `SUPABASE_SCHEMA.md`
4. Uncomment `createClient` in `src/lib/supabase.ts`

## Deployment

1. Push to GitHub
2. Import into Vercel
3. Add environment variables
4. Deploy

---

**Version**: 0.2.0  
**Last Updated**: May 22, 2026
