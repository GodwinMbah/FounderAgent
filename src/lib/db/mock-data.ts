/**
 * Mock Data Fallback
 * Returns realistic demo data when Supabase tables are not yet available.
 */

import type {
  Transaction, Subscription, Budget, Alert, Report,
  AgentTask, AgentRecommendation, Upload,
} from "@/lib/types";

const DEMO_COMPANY_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";

// ─── Transactions ───
export async function getMockTransactions(companyId?: string): Promise<Transaction[]> {
  return [
    { id: "txn_1", companyId: companyId ?? DEMO_COMPANY_ID, date: "2026-05-20", merchant: "Stripe Payout", description: "Customer payment", category: "Revenue", amount: 4200, type: "income", status: "categorised", confidenceScore: 98, createdAt: "2026-05-20T00:00:00Z" },
    { id: "txn_2", companyId: companyId ?? DEMO_COMPANY_ID, date: "2026-05-19", merchant: "AWS", description: "EC2 instances", category: "Cloud Infrastructure", amount: 843.20, type: "expense", status: "categorised", confidenceScore: 95, createdAt: "2026-05-19T00:00:00Z" },
    { id: "txn_3", companyId: companyId ?? DEMO_COMPANY_ID, date: "2026-05-18", merchant: "Meta Ads", description: "Facebook campaign", category: "Advertising", amount: 1250, type: "expense", status: "categorised", confidenceScore: 92, createdAt: "2026-05-18T00:00:00Z" },
    { id: "txn_4", companyId: companyId ?? DEMO_COMPANY_ID, date: "2026-05-17", merchant: "Notion", description: "Team workspace", category: "Software", amount: 96, type: "expense", status: "ai_suggested", confidenceScore: 88, createdAt: "2026-05-17T00:00:00Z" },
    { id: "txn_5", companyId: companyId ?? DEMO_COMPANY_ID, date: "2026-05-16", merchant: "Gusto", description: "Payroll processing", category: "Payroll", amount: 8750, type: "expense", status: "categorised", confidenceScore: 99, createdAt: "2026-05-16T00:00:00Z" },
    { id: "txn_6", companyId: companyId ?? DEMO_COMPANY_ID, date: "2026-05-15", merchant: "Stripe Payout", description: "Customer payment", category: "Revenue", amount: 3800, type: "income", status: "categorised", confidenceScore: 98, createdAt: "2026-05-15T00:00:00Z" },
    { id: "txn_7", companyId: companyId ?? DEMO_COMPANY_ID, date: "2026-05-14", merchant: "Figma", description: "Design tool", category: "Software", amount: 45, type: "expense", status: "ai_suggested", confidenceScore: 85, createdAt: "2026-05-14T00:00:00Z" },
    { id: "txn_8", companyId: companyId ?? DEMO_COMPANY_ID, date: "2026-05-13", merchant: "Upwork", description: "Contractor payment", category: "Contractors", amount: 2400, type: "expense", status: "categorised", confidenceScore: 90, createdAt: "2026-05-13T00:00:00Z" },
    { id: "txn_9", companyId: companyId ?? DEMO_COMPANY_ID, date: "2026-05-12", merchant: "Slack", description: "Team communication", category: "Software", amount: 150, type: "expense", status: "ai_suggested", confidenceScore: 94, createdAt: "2026-05-12T00:00:00Z" },
    { id: "txn_10", companyId: companyId ?? DEMO_COMPANY_ID, date: "2026-05-11", merchant: "Stripe Payout", description: "Customer payment", category: "Revenue", amount: 5100, type: "income", status: "categorised", confidenceScore: 98, createdAt: "2026-05-11T00:00:00Z" },
    { id: "txn_11", companyId: companyId ?? DEMO_COMPANY_ID, date: "2026-05-10", merchant: "Google Workspace", description: "Business email", category: "Software", amount: 72, type: "expense", status: "ai_suggested", confidenceScore: 96, createdAt: "2026-05-10T00:00:00Z" },
    { id: "txn_12", companyId: companyId ?? DEMO_COMPANY_ID, date: "2026-05-09", merchant: "HubSpot", description: "CRM subscription", category: "Marketing Tools", amount: 450, type: "expense", status: "ai_suggested", confidenceScore: 91, createdAt: "2026-05-09T00:00:00Z" },
    { id: "txn_13", companyId: companyId ?? DEMO_COMPANY_ID, date: "2026-05-08", merchant: "WeWork", description: "Office space", category: "Office", amount: 2200, type: "expense", status: "categorised", confidenceScore: 97, createdAt: "2026-05-08T00:00:00Z" },
    { id: "txn_14", companyId: companyId ?? DEMO_COMPANY_ID, date: "2026-05-07", merchant: "Stripe Payout", description: "Customer payment", category: "Revenue", amount: 2950, type: "income", status: "categorised", confidenceScore: 98, createdAt: "2026-05-07T00:00:00Z" },
  ];
}

// ─── Subscriptions ───
export async function getMockSubscriptions(companyId?: string): Promise<Subscription[]> {
  return [
    { id: "sub_1", companyId: companyId ?? DEMO_COMPANY_ID, name: "AWS EC2", vendor: "Amazon Web Services", category: "Cloud Infrastructure", amount: 843.20, billingCycle: "monthly", nextBillingDate: "2026-06-19", status: "active", startDate: "2024-01-15", isFlagged: false, createdAt: "2024-01-15T00:00:00Z" },
    { id: "sub_2", companyId: companyId ?? DEMO_COMPANY_ID, name: "Notion Team", vendor: "Notion Labs", category: "Software", amount: 96, billingCycle: "monthly", nextBillingDate: "2026-06-18", status: "active", startDate: "2024-03-01", isFlagged: false, createdAt: "2024-03-01T00:00:00Z" },
    { id: "sub_3", companyId: companyId ?? DEMO_COMPANY_ID, name: "Figma Professional", vendor: "Figma", category: "Software", amount: 45, billingCycle: "monthly", nextBillingDate: "2026-06-14", status: "active", startDate: "2024-02-10", isFlagged: false, createdAt: "2024-02-10T00:00:00Z" },
    { id: "sub_4", companyId: companyId ?? DEMO_COMPANY_ID, name: "Slack Pro", vendor: "Slack", category: "Software", amount: 150, billingCycle: "monthly", nextBillingDate: "2026-06-12", status: "active", startDate: "2023-11-01", isFlagged: false, createdAt: "2023-11-01T00:00:00Z" },
    { id: "sub_5", companyId: companyId ?? DEMO_COMPANY_ID, name: "GitHub Team", vendor: "GitHub", category: "Software", amount: 88, billingCycle: "monthly", nextBillingDate: "2026-06-10", status: "active", startDate: "2023-09-15", isFlagged: false, createdAt: "2023-09-15T00:00:00Z" },
    { id: "sub_6", companyId: companyId ?? DEMO_COMPANY_ID, name: "HubSpot Starter", vendor: "HubSpot", category: "Marketing Tools", amount: 450, billingCycle: "monthly", nextBillingDate: "2026-06-09", status: "active", startDate: "2024-05-01", isFlagged: true, flagReason: "Low usage, consider downgrading", createdAt: "2024-05-01T00:00:00Z" },
    { id: "sub_7", companyId: companyId ?? DEMO_COMPANY_ID, name: "Google Workspace", vendor: "Google", category: "Software", amount: 72, billingCycle: "monthly", nextBillingDate: "2026-06-10", status: "active", startDate: "2023-08-01", isFlagged: false, createdAt: "2023-08-01T00:00:00Z" },
    { id: "sub_8", companyId: companyId ?? DEMO_COMPANY_ID, name: "Linear", vendor: "Linear", category: "Software", amount: 32, billingCycle: "monthly", nextBillingDate: "2026-06-11", status: "active", startDate: "2024-01-20", isFlagged: false, createdAt: "2024-01-20T00:00:00Z" },
    { id: "sub_9", companyId: companyId ?? DEMO_COMPANY_ID, name: "Datadog", vendor: "Datadog", category: "Cloud Infrastructure", amount: 520, billingCycle: "monthly", nextBillingDate: "2026-06-08", status: "active", startDate: "2024-02-15", isFlagged: true, flagReason: "High cost, evaluate alternatives", createdAt: "2024-02-15T00:00:00Z" },
    { id: "sub_10", companyId: companyId ?? DEMO_COMPANY_ID, name: "Zoom Pro", vendor: "Zoom", category: "Software", amount: 149.90, billingCycle: "monthly", nextBillingDate: "2026-06-07", status: "active", startDate: "2023-10-01", isFlagged: false, createdAt: "2023-10-01T00:00:00Z" },
  ];
}

// ─── Budgets ───
export async function getMockBudgets(companyId?: string): Promise<Budget[]> {
  return [
    { id: "bud_1", companyId: companyId ?? DEMO_COMPANY_ID, category: "Payroll", amount: 10000, period: "monthly", startDate: "2026-01-01", alertThreshold: 90, isActive: true, createdAt: "2026-01-01T00:00:00Z" },
    { id: "bud_2", companyId: companyId ?? DEMO_COMPANY_ID, category: "Advertising", amount: 1500, period: "monthly", startDate: "2026-01-01", alertThreshold: 80, isActive: true, createdAt: "2026-01-01T00:00:00Z" },
    { id: "bud_3", companyId: companyId ?? DEMO_COMPANY_ID, category: "Cloud Infrastructure", amount: 1000, period: "monthly", startDate: "2026-01-01", alertThreshold: 85, isActive: true, createdAt: "2026-01-01T00:00:00Z" },
    { id: "bud_4", companyId: companyId ?? DEMO_COMPANY_ID, category: "Software", amount: 600, period: "monthly", startDate: "2026-01-01", alertThreshold: 80, isActive: true, createdAt: "2026-01-01T00:00:00Z" },
    { id: "bud_5", companyId: companyId ?? DEMO_COMPANY_ID, category: "Office", amount: 2500, period: "monthly", startDate: "2026-01-01", alertThreshold: 90, isActive: true, createdAt: "2026-01-01T00:00:00Z" },
    { id: "bud_6", companyId: companyId ?? DEMO_COMPANY_ID, category: "Contractors", amount: 3000, period: "monthly", startDate: "2026-01-01", alertThreshold: 80, isActive: true, createdAt: "2026-01-01T00:00:00Z" },
  ];
}

// ─── Alerts ───
export async function getMockAlerts(companyId?: string): Promise<Alert[]> {
  return [
    { id: "alt_1", companyId: companyId ?? DEMO_COMPANY_ID, title: "HubSpot subscription flagged for review", description: "Paying $450/mo but only 2 team members actively use it.", severity: "critical", category: "subscription", isRead: false, isDismissed: false, createdAt: "2026-05-22T00:00:00Z" },
    { id: "alt_2", companyId: companyId ?? DEMO_COMPANY_ID, title: "Datadog cost exceeded budget threshold", description: "Monthly spend reached $520, exceeding the $500 budget.", severity: "warning", category: "spending", isRead: false, isDismissed: false, createdAt: "2026-05-20T00:00:00Z" },
    { id: "alt_3", companyId: companyId ?? DEMO_COMPANY_ID, title: "Cash runway extended to 14 months", description: "Strong revenue growth and controlled expenses.", severity: "info", category: "cash_flow", isRead: true, isDismissed: false, createdAt: "2026-05-18T00:00:00Z" },
    { id: "alt_4", companyId: companyId ?? DEMO_COMPANY_ID, title: "Contractor costs up 18% this quarter", description: "Increased from $1,800 to $2,400/month.", severity: "warning", category: "spending", isRead: false, isDismissed: false, createdAt: "2026-05-15T00:00:00Z" },
    { id: "alt_5", companyId: companyId ?? DEMO_COMPANY_ID, title: "Possible duplicate subscription detected", description: "Notion and Confluence both active.", severity: "warning", category: "subscription", isRead: false, isDismissed: false, createdAt: "2026-05-12T00:00:00Z" },
    { id: "alt_6", companyId: companyId ?? DEMO_COMPANY_ID, title: "Advertising spend within budget", description: "Current spend is $1,250 of $1,500 budget.", severity: "info", category: "budget", isRead: true, isDismissed: false, createdAt: "2026-05-10T00:00:00Z" },
  ];
}

// ─── Reports ───
export async function getMockReports(companyId?: string): Promise<Report[]> {
  return [
    { id: "rep_1", companyId: companyId ?? DEMO_COMPANY_ID, name: "May 2026 P&L Report", type: "p_and_l", status: "ready", periodStart: "2026-05-01", periodEnd: "2026-05-31", fileSize: 245000, createdAt: "2026-05-23T00:00:00Z" },
    { id: "rep_2", companyId: companyId ?? DEMO_COMPANY_ID, name: "Q2 2026 Board Summary", type: "board_summary", status: "ready", periodStart: "2026-04-01", periodEnd: "2026-06-30", fileSize: 890000, createdAt: "2026-05-20T00:00:00Z" },
    { id: "rep_3", companyId: companyId ?? DEMO_COMPANY_ID, name: "Subscription Audit April", type: "subscription_audit", status: "ready", periodStart: "2026-04-01", periodEnd: "2026-04-30", fileSize: 120000, createdAt: "2026-05-15T00:00:00Z" },
    { id: "rep_4", companyId: companyId ?? DEMO_COMPANY_ID, name: "Runway Analysis", type: "runway_analysis", status: "ready", periodStart: "2026-05-01", periodEnd: "2026-05-31", fileSize: 180000, createdAt: "2026-05-10T00:00:00Z" },
    { id: "rep_5", companyId: companyId ?? DEMO_COMPANY_ID, name: "Budget Variance Q2", type: "budget_variance", status: "generating", periodStart: "2026-04-01", periodEnd: "2026-06-30", createdAt: "2026-05-22T00:00:00Z" },
    { id: "rep_6", companyId: companyId ?? DEMO_COMPANY_ID, name: "Cash Flow May 2026", type: "cash_flow", status: "ready", periodStart: "2026-05-01", periodEnd: "2026-05-31", fileSize: 156000, createdAt: "2026-05-18T00:00:00Z" },
    { id: "rep_7", companyId: companyId ?? DEMO_COMPANY_ID, name: "Balance Sheet Q1", type: "balance_sheet", status: "archived", periodStart: "2026-01-01", periodEnd: "2026-03-31", fileSize: 310000, createdAt: "2026-04-05T00:00:00Z" },
  ];
}

// ─── Agent Tasks ───
export async function getMockAgentTasks(companyId?: string): Promise<AgentTask[]> {
  return [
    { id: "task_1", companyId: companyId ?? DEMO_COMPANY_ID, title: "Find cheaper alternatives to Datadog", taskType: "find_cheaper_alternatives", status: "completed", priority: "high", resultSummary: "Grafana Cloud ($150/mo) and New Relic ($280/mo) are viable alternatives. Potential savings: $240-370/mo.", recommendedActions: ["Evaluate Grafana Cloud free trial", "Compare feature parity with Datadog"], createdAt: "2026-05-20T00:00:00Z" },
    { id: "task_2", companyId: companyId ?? DEMO_COMPANY_ID, title: "Detect duplicate subscriptions", taskType: "detect_duplicate_subscriptions", status: "completed", priority: "medium", resultSummary: "Found 2 potential duplicates: Notion + Confluence, Slack + Microsoft Teams.", recommendedActions: ["Audit team usage of Confluence", "Consolidate to single communication tool"], createdAt: "2026-05-18T00:00:00Z" },
    { id: "task_3", companyId: companyId ?? DEMO_COMPANY_ID, title: "Forecast runway scenarios", taskType: "forecast_runway", status: "running", priority: "high", inputData: { currentBurn: 21200, cashBalance: 127340 }, createdAt: "2026-05-22T00:00:00Z" },
    { id: "task_4", companyId: companyId ?? DEMO_COMPANY_ID, title: "Flag wasteful spending", taskType: "flag_wasteful_spending", status: "pending", priority: "medium", createdAt: "2026-05-21T00:00:00Z" },
    { id: "task_5", companyId: companyId ?? DEMO_COMPANY_ID, title: "Generate investor summary", taskType: "generate_investor_summary", status: "pending", priority: "high", createdAt: "2026-05-19T00:00:00Z" },
    { id: "task_6", companyId: companyId ?? DEMO_COMPANY_ID, title: "Review upcoming renewals", taskType: "review_renewals", status: "completed", priority: "low", resultSummary: "5 subscriptions renew in next 30 days. Total: $1,659. HubSpot and Datadog are candidates for renegotiation.", recommendedActions: ["Contact HubSpot for downgrade options", "Request Datadog annual discount"], createdAt: "2026-05-15T00:00:00Z" },
  ];
}

// ─── Agent Recommendations ───
export async function getMockAgentRecommendations(companyId?: string): Promise<AgentRecommendation[]> {
  return [
    { id: "rec_1", companyId: companyId ?? DEMO_COMPANY_ID, title: "Switch from Datadog to Grafana Cloud", description: "Grafana Cloud provides similar APM features at $150/mo vs Datadog $520/mo.", category: "cost_saving", potentialSavings: 4440, impactScore: 85, effortScore: 40, status: "new", createdAt: "2026-05-22T00:00:00Z" },
    { id: "rec_2", companyId: companyId ?? DEMO_COMPANY_ID, title: "Downgrade HubSpot to free tier", description: "Only 2 of 12 team members use HubSpot CRM actively.", category: "cost_saving", potentialSavings: 5400, impactScore: 90, effortScore: 20, status: "new", createdAt: "2026-05-22T00:00:00Z" },
    { id: "rec_3", companyId: companyId ?? DEMO_COMPANY_ID, title: "Negotiate annual billing for AWS", description: "Reserved instances could reduce EC2 costs by 30-40%.", category: "cost_saving", potentialSavings: 3035, impactScore: 75, effortScore: 50, status: "viewed", createdAt: "2026-05-20T00:00:00Z" },
    { id: "rec_4", companyId: companyId ?? DEMO_COMPANY_ID, title: "Consolidate communication tools", description: "Using both Slack ($150/mo) and partial Zoom ($149.90/mo). Teams plan covers both.", category: "efficiency", potentialSavings: 1798.80, impactScore: 60, effortScore: 70, status: "new", createdAt: "2026-05-18T00:00:00Z" },
    { id: "rec_5", companyId: companyId ?? DEMO_COMPANY_ID, title: "Increase ad spend on high-ROAS channels", description: "Meta Ads showing 4.2x ROAS. Consider increasing budget by 20%.", category: "growth", potentialSavings: 0, impactScore: 80, effortScore: 30, status: "accepted", createdAt: "2026-05-15T00:00:00Z" },
  ];
}

// ─── Uploads ───
export async function getMockUploads(companyId?: string): Promise<Upload[]> {
  return [
    { id: "upl_1", companyId: companyId ?? DEMO_COMPANY_ID, fileName: "chase_may_2026.csv", fileSize: 24580, source: "bank_statement_csv", status: "completed", transactionCount: 142, uploadedAt: "2026-05-20T00:00:00Z" },
    { id: "upl_2", companyId: companyId ?? DEMO_COMPANY_ID, fileName: "amex_may_2026.csv", fileSize: 18340, source: "bank_statement_csv", status: "completed", transactionCount: 89, uploadedAt: "2026-05-18T00:00:00Z" },
    { id: "upl_3", companyId: companyId ?? DEMO_COMPANY_ID, fileName: "stripe_payouts_may.csv", fileSize: 12500, source: "stripe", status: "completed", transactionCount: 56, uploadedAt: "2026-05-15T00:00:00Z" },
    { id: "upl_4", companyId: companyId ?? DEMO_COMPANY_ID, fileName: "quickbooks_export.qbo", fileSize: 45600, source: "quickbooks", status: "processing", uploadedAt: "2026-05-22T00:00:00Z" },
  ];
}

// ─── Monthly Metrics ───
export async function getMockMonthlyMetrics() {
  return [
    { month: "2026-01", revenue: 42000, expenses: 21000, profit: 21000, cashIn: 42000, cashOut: 21000 },
    { month: "2026-02", revenue: 43500, expenses: 21800, profit: 21700, cashIn: 43500, cashOut: 21800 },
    { month: "2026-03", revenue: 45100, expenses: 22500, profit: 22600, cashIn: 45100, cashOut: 22500 },
    { month: "2026-04", revenue: 46800, expenses: 23300, profit: 23500, cashIn: 46800, cashOut: 23300 },
    { month: "2026-05", revenue: 48250, expenses: 24100, profit: 24150, cashIn: 48250, cashOut: 24100 },
  ];
}

// ─── Dashboard KPIs ───
export async function getMockDashboardMetrics() {
  return {
    cashBalance: 127340.50,
    monthlyRevenue: 48250,
    monthlyExpenses: 24100,
    netProfit: 24150,
    profitMargin: 50.05,
    monthlyBurn: 21200,
    runwayMonths: 14,
    healthScore: 87,
    activeSubscriptions: 10,
    monthlySubscriptionSpend: 2995.10,
    flaggedSubscriptions: 2,
    potentialSavings: 14673.80,
    totalTransactions: 142,
    uncategorizedTransactions: 8,
  };
}
