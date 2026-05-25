/**
 * Mock Data for FounderAgent
 * Uses types from ./types.ts but simplified for demo purposes
 */

import type {
  Transaction,
  Subscription,
  AIInsight,
  MonthlySummary,
  FinancialHealthScore,
} from "./types";

// Export legacy interfaces for backwards compatibility with existing pages
export interface LegacyInsight {
  id: string;
  title: string;
  description: string;
  type: "warning" | "opportunity" | "info" | "critical";
  date: string;
}

/* ============ Premium KPI Cards ============ */

export const kpiCards = [
  {
    label: "Cash Balance",
    value: "$127,340",
    change: "+8.2%",
    trend: "up" as const,
    icon: "wallet",
  },
  {
    label: "Monthly Revenue",
    value: "$48,250",
    change: "+12.5%",
    trend: "up" as const,
    icon: "trending-up",
  },
  {
    label: "Monthly Expenses",
    value: "$21,840",
    change: "+3.2%",
    trend: "up" as const,
    icon: "trending-down",
  },
  {
    label: "Net Profit",
    value: "$26,410",
    change: "+18.1%",
    trend: "up" as const,
    icon: "zap",
  },
  {
    label: "Profit Margin",
    value: "54.7%",
    change: "+4.3%",
    trend: "up" as const,
    icon: "percent",
  },
  {
    label: "Monthly Burn",
    value: "$0",
    change: "Positive",
    trend: "up" as const,
    icon: "flame",
  },
  {
    label: "Runway",
    value: "Infinite",
    change: "Strong",
    trend: "up" as const,
    icon: "clock",
  },
  {
    label: "Health Score",
    value: "87/100",
    change: "Strong",
    trend: "up" as const,
    icon: "heart",
  },
];

/* ============ Detailed Transactions ============ */

export const detailedTransactions: Transaction[] = [
  // May 20
  {
    id: "txn_001",
    businessId: "biz_1",
    accountId: "acc_1",
    date: new Date("2026-05-20"),
    merchant: "Stripe Payout",
    description: "Customer payment received",
    categoryId: "cat_revenue",
    category: "Revenue",
    amount: 4200,
    type: "income",
    status: "Categorised",
    confidenceScore: 98,
    uploadedStatementId: "stmt_1",
    createdAt: new Date("2026-05-20"),
    updatedAt: new Date("2026-05-20"),
  },
  // May 19
  {
    id: "txn_002",
    businessId: "biz_1",
    accountId: "acc_1",
    date: new Date("2026-05-19"),
    merchant: "Amazon Web Services",
    description: "AWS infrastructure - May billing",
    categoryId: "cat_cloud",
    category: "Cloud Infrastructure",
    amount: 1240,
    type: "expense",
    status: "Categorised",
    confidenceScore: 99,
    uploadedStatementId: "stmt_1",
    createdAt: new Date("2026-05-19"),
    updatedAt: new Date("2026-05-19"),
  },
  {
    id: "txn_003",
    businessId: "biz_1",
    accountId: "acc_1",
    date: new Date("2026-05-19"),
    merchant: "Notion",
    description: "Notion Team Plan monthly",
    categoryId: "cat_software",
    category: "Software",
    amount: 96,
    type: "expense",
    status: "Categorised",
    confidenceScore: 95,
    uploadedStatementId: "stmt_1",
    createdAt: new Date("2026-05-19"),
    updatedAt: new Date("2026-05-19"),
  },
  // May 18
  {
    id: "txn_004",
    businessId: "biz_1",
    accountId: "acc_1",
    date: new Date("2026-05-18"),
    merchant: "Consulting - ABC Corp",
    description: "Consulting services payment",
    categoryId: "cat_revenue",
    category: "Revenue",
    amount: 8500,
    type: "income",
    status: "Categorised",
    confidenceScore: 92,
    uploadedStatementId: "stmt_1",
    createdAt: new Date("2026-05-18"),
    updatedAt: new Date("2026-05-18"),
  },
  // May 17
  {
    id: "txn_005",
    businessId: "biz_1",
    accountId: "acc_1",
    date: new Date("2026-05-17"),
    merchant: "Meta / Facebook",
    description: "Facebook Ads campaign",
    categoryId: "cat_ads",
    category: "Advertising",
    amount: 2100,
    type: "expense",
    status: "AI Suggested",
    confidenceScore: 96,
    uploadedStatementId: "stmt_1",
    createdAt: new Date("2026-05-17"),
    updatedAt: new Date("2026-05-17"),
  },
  // May 16
  {
    id: "txn_006",
    businessId: "biz_1",
    accountId: "acc_1",
    date: new Date("2026-05-16"),
    merchant: "Stripe Inc",
    description: "Payment processing fee",
    categoryId: "cat_fees",
    category: "Payment Processor Fees",
    amount: 312,
    type: "expense",
    status: "Categorised",
    confidenceScore: 99,
    uploadedStatementId: "stmt_1",
    createdAt: new Date("2026-05-16"),
    updatedAt: new Date("2026-05-16"),
  },
  // May 15
  {
    id: "txn_007",
    businessId: "biz_1",
    accountId: "acc_1",
    date: new Date("2026-05-15"),
    merchant: "OpenAI",
    description: "ChatGPT API usage",
    categoryId: "cat_ai",
    category: "AI Tools",
    amount: 145,
    type: "expense",
    status: "Categorised",
    confidenceScore: 97,
    uploadedStatementId: "stmt_1",
    createdAt: new Date("2026-05-15"),
    updatedAt: new Date("2026-05-15"),
  },
  // May 14
  {
    id: "txn_008",
    businessId: "biz_1",
    accountId: "acc_1",
    date: new Date("2026-05-14"),
    merchant: "Vercel",
    description: "Hosting and deployment",
    categoryId: "cat_cloud",
    category: "Cloud Infrastructure",
    amount: 40,
    type: "expense",
    status: "Categorised",
    confidenceScore: 94,
    uploadedStatementId: "stmt_1",
    createdAt: new Date("2026-05-14"),
    updatedAt: new Date("2026-05-14"),
  },
  // May 13
  {
    id: "txn_009",
    businessId: "biz_1",
    accountId: "acc_1",
    date: new Date("2026-05-13"),
    merchant: "Invoice #2026-05",
    description: "Product sale to XYZ Inc",
    categoryId: "cat_revenue",
    category: "Revenue",
    amount: 6800,
    type: "income",
    status: "Categorised",
    confidenceScore: 88,
    uploadedStatementId: "stmt_1",
    createdAt: new Date("2026-05-13"),
    updatedAt: new Date("2026-05-13"),
  },
  // More transactions for richer data
  {
    id: "txn_010",
    businessId: "biz_1",
    accountId: "acc_1",
    date: new Date("2026-05-12"),
    merchant: "Salesforce",
    description: "CRM subscription",
    categoryId: "cat_software",
    category: "Software",
    amount: 1500,
    type: "expense",
    status: "Categorised",
    confidenceScore: 99,
    uploadedStatementId: "stmt_1",
    createdAt: new Date("2026-05-12"),
    updatedAt: new Date("2026-05-12"),
  },
  {
    id: "txn_011",
    businessId: "biz_1",
    accountId: "acc_1",
    date: new Date("2026-05-11"),
    merchant: "Google Ads",
    description: "Search advertising campaign",
    categoryId: "cat_ads",
    category: "Advertising",
    amount: 1850,
    type: "expense",
    status: "Categorised",
    confidenceScore: 96,
    uploadedStatementId: "stmt_1",
    createdAt: new Date("2026-05-11"),
    updatedAt: new Date("2026-05-11"),
  },
  {
    id: "txn_012",
    businessId: "biz_1",
    accountId: "acc_1",
    date: new Date("2026-05-10"),
    merchant: "QuickBooks",
    description: "Accounting software",
    categoryId: "cat_software",
    category: "Software",
    amount: 80,
    type: "expense",
    status: "Categorised",
    confidenceScore: 98,
    uploadedStatementId: "stmt_1",
    createdAt: new Date("2026-05-10"),
    updatedAt: new Date("2026-05-10"),
  },
  {
    id: "txn_013",
    businessId: "biz_1",
    accountId: "acc_1",
    date: new Date("2026-05-09"),
    merchant: "WeWork",
    description: "Office space rental",
    categoryId: "cat_office",
    category: "Office",
    amount: 1500,
    type: "expense",
    status: "Categorised",
    confidenceScore: 99,
    uploadedStatementId: "stmt_1",
    createdAt: new Date("2026-05-09"),
    updatedAt: new Date("2026-05-09"),
  },
  {
    id: "txn_014",
    businessId: "biz_1",
    accountId: "acc_1",
    date: new Date("2026-05-08"),
    merchant: "Client Payment",
    description: "Enterprise license renewal",
    categoryId: "cat_revenue",
    category: "Revenue",
    amount: 12000,
    type: "income",
    status: "Categorised",
    confidenceScore: 99,
    uploadedStatementId: "stmt_1",
    createdAt: new Date("2026-05-08"),
    updatedAt: new Date("2026-05-08"),
  },
];

export const recentTransactions: { id: string; date: string; description: string; category: string | undefined; type: string; amount: number; status: string; confidenceScore?: number }[] = detailedTransactions.slice(0, 5).map(t => ({
  id: t.id,
  date: new Date(t.date).toISOString().split('T')[0],
  description: t.description,
  category: t.category,
  type: t.type,
  amount: t.amount,
  status: t.status,
  confidenceScore: t.confidenceScore,
}));

/* ============ Subscriptions ============ */

export const subscriptions: Subscription[] = [
  {
    id: "sub_1",
    businessId: "biz_1",
    name: "AWS",
    vendor: "Amazon Web Services",
    category: "Cloud Infrastructure",
    amount: 1240,
    billingCycle: "monthly",
    nextBillingDate: new Date("2026-06-01"),
    status: "active",
    startDate: new Date("2024-03-01"),
    createdAt: new Date("2024-03-01"),
    updatedAt: new Date("2026-05-20"),
  },
  {
    id: "sub_2",
    businessId: "biz_1",
    name: "Notion",
    vendor: "Notion Labs",
    category: "Software",
    amount: 96,
    billingCycle: "monthly",
    nextBillingDate: new Date("2026-05-28"),
    status: "active",
    startDate: new Date("2025-01-01"),
    createdAt: new Date("2025-01-01"),
    updatedAt: new Date("2026-05-20"),
  },
  {
    id: "sub_3",
    businessId: "biz_1",
    name: "Figma",
    vendor: "Figma",
    category: "Software",
    amount: 144,
    billingCycle: "monthly",
    nextBillingDate: new Date("2026-05-30"),
    status: "active",
    startDate: new Date("2024-08-15"),
    createdAt: new Date("2024-08-15"),
    updatedAt: new Date("2026-05-20"),
  },
  {
    id: "sub_4",
    businessId: "biz_1",
    name: "Slack",
    vendor: "Slack",
    category: "Software",
    amount: 75,
    billingCycle: "monthly",
    nextBillingDate: new Date("2026-06-05"),
    status: "active",
    startDate: new Date("2024-06-01"),
    createdAt: new Date("2024-06-01"),
    updatedAt: new Date("2026-05-20"),
  },
  {
    id: "sub_5",
    businessId: "biz_1",
    name: "GitHub Pro",
    vendor: "GitHub",
    category: "Software",
    amount: 252,
    billingCycle: "monthly",
    nextBillingDate: new Date("2026-06-10"),
    status: "active",
    startDate: new Date("2023-01-01"),
    createdAt: new Date("2023-01-01"),
    updatedAt: new Date("2026-05-20"),
  },
  {
    id: "sub_6",
    businessId: "biz_1",
    name: "HubSpot",
    vendor: "HubSpot",
    category: "Software",
    amount: 900,
    billingCycle: "monthly",
    nextBillingDate: new Date("2026-06-15"),
    status: "active",
    startDate: new Date("2025-06-01"),
    isFlagged: true,
    flagReason: "Review potential consolidation with existing CRM",
    createdAt: new Date("2025-06-01"),
    updatedAt: new Date("2026-05-20"),
  },
  {
    id: "sub_7",
    businessId: "biz_1",
    name: "Google Workspace",
    vendor: "Google",
    category: "Software",
    amount: 120,
    billingCycle: "monthly",
    nextBillingDate: new Date("2026-06-08"),
    status: "active",
    startDate: new Date("2024-12-01"),
    createdAt: new Date("2024-12-01"),
    updatedAt: new Date("2026-05-20"),
  },
  {
    id: "sub_8",
    businessId: "biz_1",
    name: "Linear",
    vendor: "Linear",
    category: "Software",
    amount: 96,
    billingCycle: "monthly",
    nextBillingDate: new Date("2026-06-12"),
    status: "active",
    startDate: new Date("2024-09-01"),
    isFlagged: true,
    flagReason: "Duplicate with GitHub Projects",
    createdAt: new Date("2024-09-01"),
    updatedAt: new Date("2026-05-20"),
  },
  {
    id: "sub_9",
    businessId: "biz_1",
    name: "Datadog",
    vendor: "Datadog",
    category: "Cloud Infrastructure",
    amount: 480,
    billingCycle: "monthly",
    nextBillingDate: new Date("2026-06-18"),
    status: "active",
    startDate: new Date("2025-02-01"),
    createdAt: new Date("2025-02-01"),
    updatedAt: new Date("2026-05-20"),
  },
  {
    id: "sub_10",
    businessId: "biz_1",
    name: "Zoom",
    vendor: "Zoom",
    category: "Software",
    amount: 199,
    billingCycle: "monthly",
    nextBillingDate: new Date("2026-06-20"),
    status: "active",
    startDate: new Date("2023-06-01"),
    isFlagged: true,
    flagReason: "Low usage detected",
    createdAt: new Date("2023-06-01"),
    updatedAt: new Date("2026-05-20"),
  },
];

/* ============ AI Insights ============ */

export const insights: AIInsight[] = [
  {
    id: "ins_1",
    businessId: "biz_1",
    type: "revenue_increased_profit_dropped",
    priority: "warning",
    title: "Revenue Up But Profit Unchanged",
    description:
      "Revenue increased 12.5% this month but expenses grew at 3.2%. Your profit margin remains strong at 54.7%. Consider reinvesting surplus into growth initiatives.",
    recommendedAction: "Review growth opportunities",
    dateRange: {
      startDate: new Date("2026-04-01"),
      endDate: new Date("2026-05-31"),
    },
    isRead: false,
    isDismissed: false,
    createdAt: new Date("2026-05-20"),
    updatedAt: new Date("2026-05-20"),
  },
  {
    id: "ins_2",
    businessId: "biz_1",
    type: "subscription_increase",
    priority: "warning",
    title: "Subscription Spending Alert",
    description:
      "Your software and subscription spending is $2,787/month. We detected 7 active subscriptions. Tools like Notion and Figma have overlapping features with HubSpot. A quick audit could save ~$400-500/month.",
    recommendedAction: "Review and consolidate subscriptions",
    relatedSubscriptions: ["sub_2", "sub_3", "sub_6"],
    isRead: false,
    isDismissed: false,
    createdAt: new Date("2026-05-19"),
    updatedAt: new Date("2026-05-19"),
  },
  {
    id: "ins_3",
    businessId: "biz_1",
    type: "cash_flow_warning",
    priority: "info",
    title: "Strong Cash Position",
    description:
      "Your cash balance is $127,340 with zero monthly burn. At current revenue and expense levels, your runway is infinite. You are in a strong financial position.",
    dateRange: {
      startDate: new Date("2026-05-01"),
      endDate: new Date("2026-05-31"),
    },
    isRead: false,
    isDismissed: false,
    createdAt: new Date("2026-05-18"),
    updatedAt: new Date("2026-05-18"),
  },
  {
    id: "ins_4",
    businessId: "biz_1",
    type: "ad_spend_growth",
    priority: "opportunity",
    title: "Advertising ROI Opportunity",
    description:
      "Your advertising spend is $2,100/month (4.4% of revenue). With 12.5% revenue growth, consider increasing marketing investment by 15-20% to accelerate customer acquisition.",
    recommendedAction: "Scale advertising budget",
    relatedTransactions: ["txn_005"],
    isRead: true,
    isDismissed: false,
    createdAt: new Date("2026-05-17"),
    updatedAt: new Date("2026-05-17"),
  },
  {
    id: "ins_5",
    businessId: "biz_1",
    type: "cost_saving_opportunity",
    priority: "opportunity",
    title: "Detect Possible Duplicate Subscription",
    description:
      "You have two similar tools in your stack: HubSpot ($900/month) and Slack for internal communication. Consider evaluating if HubSpot's communication features can reduce your Slack usage.",
    recommendedAction: "Audit tool consolidation",
    relatedSubscriptions: ["sub_4", "sub_6"],
    isRead: false,
    isDismissed: false,
    createdAt: new Date("2026-05-16"),
    updatedAt: new Date("2026-05-16"),
  },
  {
    id: "ins_6",
    businessId: "biz_1",
    type: "growth_opportunity",
    priority: "info",
    title: "Profit Margin Trend Analysis",
    description:
      "Your profit margin has improved from 42.2% (Jan) to 54.7% (May). This improvement is driven by revenue growth outpacing expense growth. Continue this momentum.",
    isRead: true,
    isDismissed: false,
    createdAt: new Date("2026-05-15"),
    updatedAt: new Date("2026-05-15"),
  },
];

/* ============ Monthly P&L ============ */

export const monthlyPL: MonthlySummary[] = [
  {
    month: "2026-01",
    year: 2026,
    revenue: 32000,
    expenses: 18500,
    profit: 13500,
    profitMargin: 42.2,
    cashInflow: 32000,
    cashOutflow: 18500,
    netCashFlow: 13500,
  },
  {
    month: "2026-02",
    year: 2026,
    revenue: 34500,
    expenses: 19200,
    profit: 15300,
    profitMargin: 44.3,
    cashInflow: 34500,
    cashOutflow: 19200,
    netCashFlow: 15300,
  },
  {
    month: "2026-03",
    year: 2026,
    revenue: 38000,
    expenses: 19800,
    profit: 18200,
    profitMargin: 47.9,
    cashInflow: 38000,
    cashOutflow: 19800,
    netCashFlow: 18200,
  },
  {
    month: "2026-04",
    year: 2026,
    revenue: 41000,
    expenses: 20500,
    profit: 20500,
    profitMargin: 50.0,
    cashInflow: 41000,
    cashOutflow: 20500,
    netCashFlow: 20500,
  },
  {
    month: "2026-05",
    year: 2026,
    revenue: 48250,
    expenses: 21840,
    profit: 26410,
    profitMargin: 54.7,
    cashInflow: 48250,
    cashOutflow: 21840,
    netCashFlow: 26410,
  },
];

/* ============ Financial Health Score ============ */

export const financialHealthScore: FinancialHealthScore = {
  id: "health_1",
  businessId: "biz_1",
  score: 87,
  status: "strong",
  cashRunway: {
    score: 95,
    status: "strong",
    daysOfRunway: Infinity,
  },
  revenueGrowth: {
    score: 92,
    status: "strong",
    monthlyGrowthRate: 12.5,
  },
  expenseControl: {
    score: 85,
    status: "healthy",
    expenseGrowthRate: 3.2,
  },
  subscriptionHealth: {
    score: 72,
    status: "healthy",
    monthlySpend: 2787,
  },
  factors: [
    "Strong positive cash flow",
    "Consistent revenue growth",
    "Well-controlled expenses",
    "Healthy subscription management",
  ],
  recommendations: [
    "Continue scaling marketing efforts - revenue is growing faster than costs",
    "Review and consolidate software subscriptions to reduce monthly burn",
    "Consider reinvesting surplus cash into product development or team growth",
    "Maintain current expense discipline while pursuing growth",
  ],
  calculatedAt: new Date("2026-05-20"),
  updatedAt: new Date("2026-05-20"),
};

/* ============ Expense Categories ============ */

export const expenseCategories = [
  { name: "Cloud Infrastructure", amount: 1280, percentage: 5.9 },
  { name: "Software & Subscriptions", amount: 2787, percentage: 12.8 },
  { name: "Advertising", amount: 2100, percentage: 9.6 },
  { name: "Payroll", amount: 12000, percentage: 55.0 },
  { name: "Office & Operations", amount: 1500, percentage: 6.9 },
  { name: "Professional Services", amount: 1093, percentage: 5.0 },
  { name: "Payment Processing", amount: 312, percentage: 1.4 },
  { name: "AI Tools & Services", amount: 145, percentage: 0.7 },
  { name: "Other", amount: 623, percentage: 2.8 },
];

export const revenueCategories = [
  { name: "Product Sales", amount: 28500, percentage: 59.1 },
  { name: "Consulting Services", amount: 12500, percentage: 25.9 },
  { name: "Affiliate & Other", amount: 7250, percentage: 15.0 },
];

/* ============ Legacy Data Format (for backwards compatibility) ============ */

export const monthlyRevExpenseChartData = monthlyPL.map(m => ({
  month: m.month.slice(5), // Just MM
  revenue: m.revenue,
  expenses: m.expenses,
}));

/* ============ Cash Flow Data ============ */

export const cashFlowData = {
  operatingCashIn: 48250,
  operatingCashOut: 21840,
  netCashFlow: 26410,
  openingBalance: 100930,
  closingBalance: 127340,
  monthly: monthlyPL.map(m => ({
    month: m.month.slice(5),
    inflow: m.cashInflow,
    outflow: m.cashOutflow,
    net: m.netCashFlow,
  })),
  inflowBySource: [
    { name: "Product Sales", amount: 28500, percentage: 59 },
    { name: "Consulting", amount: 12500, percentage: 26 },
    { name: "Affiliate & Other", amount: 7250, percentage: 15 },
  ],
  outflowByCategory: [
    { name: "Payroll", amount: 12000, percentage: 55 },
    { name: "Software", amount: 2787, percentage: 13 },
    { name: "Advertising", amount: 2100, percentage: 10 },
    { name: "Office & Ops", amount: 1500, percentage: 7 },
    { name: "Cloud", amount: 1280, percentage: 6 },
    { name: "Other", amount: 2173, percentage: 10 },
  ],
  risks: [
    { title: "Ad spend increasing faster than revenue", severity: "warning" as const, impact: "Could compress margins if trend continues" },
    { title: "Strong cash inflow from enterprise clients", severity: "info" as const, impact: "Provides healthy operating buffer" },
  ],
};

/* ============ Runway Data ============ */

export const runwayData = {
  currentRunwayMonths: 24,
  cashBalance: 127340,
  monthlyBurn: 21840,
  bestCase: { months: 36, scenario: "20% revenue growth, 5% expense reduction" },
  baseCase: { months: 24, scenario: "Current trajectory" },
  worstCase: { months: 14, scenario: "15% revenue drop, 10% expense increase" },
  burnTrend: monthlyPL.map(m => ({ month: m.month.slice(5), burn: m.expenses })),
  scenarios: [
    { name: "Revenue Drop 20%", runway: 18, impact: "-$9,650/mo", probability: "Low" },
    { name: "Expense Increase 15%", runway: 19, impact: "+$3,276/mo", probability: "Medium" },
    { name: "Software Reduction 30%", runway: 28, impact: "-$836/mo", probability: "High" },
    { name: "Hire 3 Engineers", runway: 16, impact: "+$25,000/mo", probability: "Planned" },
  ],
  recommendations: [
    "Current runway is healthy at 24 months with positive cash flow",
    "Consider building a 6-month emergency fund ($131,040)",
    "Software reduction could extend runway by 4 months",
    "Hiring plan should be phased to maintain 18+ month runway",
  ],
};

/* ============ Budget Data ============ */

export const budgetData = {
  totalBudget: 25000,
  spent: 21840,
  remaining: 3160,
  percentUsed: 87.4,
  categories: [
    { name: "Payroll", budget: 12000, actual: 12000, variance: 0, status: "on_track" as const },
    { name: "Advertising", budget: 2500, actual: 2100, variance: -400, status: "under" as const },
    { name: "Cloud", budget: 1500, actual: 1280, variance: -220, status: "under" as const },
    { name: "Software", budget: 3500, actual: 2787, variance: -713, status: "under" as const },
    { name: "Office", budget: 2000, actual: 1500, variance: -500, status: "under" as const },
    { name: "Professional", budget: 1500, actual: 1093, variance: -407, status: "under" as const },
    { name: "Misc", budget: 2000, actual: 1080, variance: -920, status: "under" as const },
  ],
  alerts: [
    { category: "Advertising", message: "Approaching budget limit next month if scaled", severity: "warning" as const },
    { category: "Software", message: "HubSpot renewal may push over budget", severity: "info" as const },
  ],
};

/* ============ Reports Data ============ */

export const reportsData = [
  { id: "rpt_1", name: "Profit & Loss - May 2026", type: "PL", status: "ready" as const, generatedAt: "2026-05-21", size: "245 KB" },
  { id: "rpt_2", name: "Cash Flow - May 2026", type: "Cash Flow", status: "ready" as const, generatedAt: "2026-05-21", size: "180 KB" },
  { id: "rpt_3", name: "Expense Analysis - Q2 2026", type: "Expense", status: "ready" as const, generatedAt: "2026-05-20", size: "320 KB" },
  { id: "rpt_4", name: "Revenue Breakdown - May 2026", type: "Revenue", status: "ready" as const, generatedAt: "2026-05-19", size: "195 KB" },
  { id: "rpt_5", name: "Subscription Audit - May 2026", type: "Subscription", status: "ready" as const, generatedAt: "2026-05-18", size: "150 KB" },
  { id: "rpt_6", name: "Runway Forecast - June 2026", type: "Runway", status: "generating" as const, generatedAt: "2026-05-22", size: "—" },
  { id: "rpt_7", name: "Monthly Founder Summary", type: "Summary", status: "ready" as const, generatedAt: "2026-05-15", size: "410 KB" },
];

/* ============ Alerts Data ============ */

export const alertsData = [
  {
    id: "alt_1",
    title: "Runway Risk Detected",
    description: "If expenses grow 15% without revenue growth, runway drops to 14 months.",
    severity: "critical" as const,
    category: "Runway",
    date: "2026-05-22",
    status: "open" as const,
  },
  {
    id: "alt_2",
    title: "Large Expense Detected",
    description: "Salesforce charge of $1,500 is 23% higher than last month.",
    severity: "warning" as const,
    category: "Expense",
    date: "2026-05-20",
    status: "open" as const,
  },
  {
    id: "alt_3",
    title: "Subscription Renewal Upcoming",
    description: "HubSpot ($900/mo) renews in 25 days. Review before auto-renewal.",
    severity: "info" as const,
    category: "Subscription",
    date: "2026-05-19",
    status: "open" as const,
  },
  {
    id: "alt_4",
    title: "Revenue Drop Signal",
    description: "Projected MRR growth slowing from 12.5% to 8% next month.",
    severity: "warning" as const,
    category: "Revenue",
    date: "2026-05-18",
    status: "resolved" as const,
  },
  {
    id: "alt_5",
    title: "Unusual Transaction",
    description: "$8,430 software purchase from new vendor flagged as 3x typical spend.",
    severity: "warning" as const,
    category: "Anomaly",
    date: "2026-05-17",
    status: "open" as const,
  },
  {
    id: "alt_6",
    title: "Budget Threshold",
    description: "Advertising budget at 84% with 10 days remaining in month.",
    severity: "info" as const,
    category: "Budget",
    date: "2026-05-16",
    status: "resolved" as const,
  },
];

/* ============ Uploads Data ============ */

export const uploadsData = [
  { id: "upl_1", name: "bank_statement_may_2026.pdf", size: "1.2 MB", status: "processed" as const, date: "2026-05-20", transactionsExtracted: 47 },
  { id: "upl_2", name: "stripe_payouts_apr.csv", size: "340 KB", status: "processed" as const, date: "2026-05-18", transactionsExtracted: 122 },
  { id: "upl_3", name: "qbo_export_q1.xlsx", size: "2.1 MB", status: "processing" as const, date: "2026-05-22", transactionsExtracted: 0 },
  { id: "upl_4", name: "paypal_feb_2026.csv", size: "180 KB", status: "processed" as const, date: "2026-05-15", transactionsExtracted: 34 },
];

/* ============ Vendor Data ============ */

export const vendorData = [
  { name: "Amazon Web Services", category: "Cloud", monthly: 1280, trend: "up", change: 12 },
  { name: "Meta", category: "Advertising", monthly: 2100, trend: "up", change: 8 },
  { name: "Salesforce", category: "Software", monthly: 1500, trend: "up", change: 23 },
  { name: "HubSpot", category: "Software", monthly: 900, trend: "stable", change: 0 },
  { name: "Google", category: "Software", monthly: 120, trend: "stable", change: 0 },
  { name: "Datadog", category: "Cloud", monthly: 480, trend: "up", change: 5 },
];

/* ============ Revenue Source Data ============ */

export const revenueSourceData = [
  { name: "SaaS Subscriptions", amount: 18500, percentage: 38.3, growth: 15, customers: 124 },
  { name: "Enterprise Licenses", amount: 10000, percentage: 20.7, growth: 22, customers: 8 },
  { name: "Consulting", amount: 12500, percentage: 25.9, growth: 5, customers: 6 },
  { name: "Affiliate", amount: 4500, percentage: 9.3, growth: -3, customers: 0 },
  { name: "Other", amount: 2750, percentage: 5.7, growth: 8, customers: 0 },
];

/* ============ Expense Trend Data ============ */

export const expenseTrendData = monthlyPL.map(m => ({
  month: m.month.slice(5),
  total: m.expenses,
  payroll: 12000,
  software: 2787 + Math.floor(Math.random() * 200),
  advertising: 2100 + Math.floor(Math.random() * 300),
  cloud: 1280 + Math.floor(Math.random() * 100),
  office: 1500,
}));

/* ============ Revenue Trend Data ============ */

export const revenueTrendData = monthlyPL.map(m => ({
  month: m.month.slice(5),
  total: m.revenue,
  recurring: m.revenue * 0.65,
  onetime: m.revenue * 0.35,
}));
