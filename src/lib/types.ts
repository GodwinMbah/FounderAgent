/**
 * FounderAgent TypeScript Types
 * Aligned with Supabase schema
 */

/* ============ Core Entities ============ */

export interface Profile {
  id: string;
  email: string;
  fullName?: string;
  avatarUrl?: string;
  phone?: string;
  timezone: string;
  createdAt: string;
  updatedAt?: string;
}

export interface Company {
  id: string;
  name: string;
  slug?: string;
  industry?: string;
  currency: string;
  fiscalYearStart: number;
  timezone: string;
  country?: string;
  taxRegion?: string;
  logoUrl?: string;
  settings?: Record<string, unknown>;
  createdAt: string;
  updatedAt?: string;
}

export interface CompanyMember {
  id: string;
  companyId: string;
  userId: string;
  role: "owner" | "admin" | "member" | "viewer";
  isActive: boolean;
  invitedBy?: string;
  joinedAt: string;
  updatedAt?: string;
}

/* ============ Financial Data ============ */

export interface Transaction {
  id: string;
  companyId?: string;
  businessId?: string;
  uploadId?: string;
  accountId?: string;
  date: string | Date;
  merchant?: string;
  description: string;
  category?: string;
  categoryId?: string;
  amount: number;
  type: "income" | "expense";
  status: string;
  confidenceScore?: number;
  tags?: string[];
  notes?: string;
  isRecurring?: boolean;
  subscriptionId?: string;
  duplicateCheckStatus?: string;
  uploadedStatementId?: string;
  metadata?: Record<string, unknown>;
  createdAt?: string | Date;
  updatedAt?: string | Date;
}

export interface Subscription {
  id: string;
  companyId?: string;
  businessId?: string;
  name: string;
  vendor?: string;
  category?: string;
  amount: number;
  billingCycle: string;
  nextBillingDate: string | Date;
  status: string;
  startDate: string | Date;
  endDate?: string | Date;
  notes?: string;
  isFlagged?: boolean;
  flagReason?: string;
  transactionLinks?: string[];
  metadata?: Record<string, unknown>;
  createdAt?: string | Date;
  updatedAt?: string | Date;
}

export interface Budget {
  id: string;
  companyId: string;
  category: string;
  amount: number;
  period: string;
  startDate: string;
  endDate?: string;
  alertThreshold: number;
  isActive: boolean;
  createdAt: string;
  updatedAt?: string;
}

/* ============ Uploads & Documents ============ */

export interface Upload {
  id: string;
  companyId: string;
  userId?: string;
  fileName: string;
  filePath?: string;
  fileSize: number;
  mimeType?: string;
  source: string;
  status: UploadStatus;
  transactionCount?: number;
  errorMessage?: string;
  metadata?: Record<string, unknown>;
  uploadedAt: string;
  processedAt?: string;
  updatedAt?: string;
}

/* ============ Alerts ============ */

export type AlertSeverity = "critical" | "warning" | "info" | "resolved";

export interface Alert {
  id: string;
  companyId: string;
  title: string;
  description: string;
  severity: AlertSeverity;
  category: string;
  resourceType?: string;
  resourceId?: string;
  isRead: boolean;
  isDismissed: boolean;
  status?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt?: string;
}

/* ============ Reports ============ */

export interface Report {
  id: string;
  companyId: string;
  name: string;
  type: string;
  status: string;
  filePath?: string;
  fileSize?: number;
  periodStart?: string;
  periodEnd?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt?: string;
}

/* ============ Agent System ============ */

export interface AgentTask {
  id: string;
  companyId: string;
  createdBy?: string;
  title: string;
  taskType: string;
  status: string;
  priority: string;
  inputData?: Record<string, unknown>;
  resultSummary?: string;
  recommendedActions?: string[];
  errorMessage?: string;
  startedAt?: string;
  completedAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface AgentRecommendation {
  id: string;
  companyId: string;
  taskId?: string;
  title: string;
  description: string;
  category?: string;
  potentialSavings?: number;
  impactScore?: number;
  effortScore?: number;
  status: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt?: string;
}

export interface AgentActivityLog {
  id: string;
  companyId: string;
  taskId?: string;
  action: string;
  resourceType?: string;
  resourceId?: string;
  inputData?: Record<string, unknown>;
  outputData?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

/* ============ Legacy Types (used by calculations.ts, categorisation.ts) ============ */

import type { CategoryType } from "./categories";
export type TransactionCategoryType = CategoryType;

export type TransactionStatus =
  | "Categorised"
  | "Needs Review"
  | "Possible Subscription"
  | "Possible Duplicate"
  | "Unusual Spend"
  | "AI Suggested"
  | "User Confirmed";

export interface SmartCategorisationSuggestion {
  transactionId: string;
  suggestedCategory: TransactionCategoryType;
  confidenceScore: number;
  reason: string;
  status: TransactionStatus;
  ruleApplied?: string;
  recommendedAction: "auto_categorise" | "review" | "flag" | "learn";
}

export interface CategorisationRule {
  id: string;
  businessId: string;
  name: string;
  condition: {
    field: "merchant" | "description" | "amount_range";
    operator: "contains" | "equals" | "starts_with" | "between";
    value: string | [number, number];
    caseSensitive?: boolean;
  };
  suggestedCategory: TransactionCategoryType;
  priority: number;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface TransactionCategory {
  id: string;
  businessId: string;
  name: TransactionCategoryType;
  description?: string;
  icon?: string;
  color?: string;
  isSystemDefined: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface FinancialAccount {
  id: string;
  businessId: string;
  name: string;
  type: "bank" | "credit_card" | "paypal" | "stripe" | "manual";
  accountNumber?: string;
  currency: string;
  isActive: boolean;
  balance?: number;
  lastSyncedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface PAndLReport {
  id: string;
  businessId: string;
  month: string;
  totalRevenue: number;
  costOfSales: number;
  grossProfit: number;
  grossMargin: number;
  operatingExpenses: number;
  netProfit: number;
  profitMargin: number;
  categoryBreakdown: { category: TransactionCategoryType; amount: number; percentage: number }[];
  topCostDrivers: { category: TransactionCategoryType; amount: number }[];
  createdAt: Date;
  updatedAt: Date;
}

export interface CashFlowSummary {
  id: string;
  businessId: string;
  month: string;
  openingBalance: number;
  operatingCashFlow: number;
  investingCashFlow: number;
  financingCashFlow: number;
  closingBalance: number;
  details: { description: string; amount: number; category: string }[];
  createdAt: Date;
  updatedAt: Date;
}

export interface AppSettings {
  businessId: string;
  currency: string;
  fiscalYearStart: number;
  categoriesPreference: "system" | "custom" | "hybrid";
  aiInsightsEnabled: boolean;
  autoCategorizationEnabled: boolean;
  autoSubscriptionDetection: boolean;
  notificationPreferences: {
    emailAlerts: boolean;
    weeklyDigest: boolean;
    criticalAlertsOnly: boolean;
  };
  dataPrivacy: {
    dataRetention: "30_days" | "90_days" | "1_year" | "unlimited";
    anonymizeTransactions: boolean;
  };
  updatedAt: Date;
}

export interface AuditLog {
  id: string;
  businessId: string;
  userId: string;
  action: string;
  resourceType: string;
  resourceId: string;
  changes?: Record<string, unknown>;
  ipAddress?: string;
  createdAt: Date;
}

export type UploadSource =
  | "bank_statement_csv"
  | "bank_statement_pdf"
  | "payment_processor_csv"
  | "accounting_export_csv"
  | "manual_csv";

export type UploadStatus = "pending" | "processing" | "completed" | "failed";

export interface UploadedStatement {
  id: string;
  businessId: string;
  accountId: string;
  fileName: string;
  source: UploadSource;
  status: UploadStatus;
  fileSize: number;
  transactionCount?: number;
  uploadedAt: Date;
  processedAt?: Date;
  errorMessage?: string;
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: "founder" | "accountant" | "admin";
  businessId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Business {
  id: string;
  name: string;
  industry: string;
  currency: "USD" | "GBP" | "EUR" | "AUD" | "CAD";
  fiscalYearStart: number;
  timezone: string;
  taxRegion: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface AIInsight {
  id: string;
  businessId: string;
  type: string;
  priority: string;
  title: string;
  description: string;
  data?: Record<string, unknown>;
  recommendedAction?: string;
  actionUrl?: string;
  relatedTransactions?: string[];
  relatedSubscriptions?: string[];
  dateRange?: { startDate: Date; endDate: Date };
  isRead: boolean;
  isDismissed: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export type InsightType =
  | "revenue_increased_profit_dropped"
  | "subscription_increase"
  | "ad_spend_growth"
  | "payroll_stable"
  | "contractor_increase"
  | "duplicate_subscription"
  | "cash_runway_improved"
  | "refunds_increase"
  | "expense_spike"
  | "cost_saving_opportunity"
  | "runway_risk"
  | "burn_increase"
  | "margin_drop"
  | "subscription_renewal"
  | "unusual_transaction"
  | "growth_opportunity"
  | "cash_flow_warning"
  | "trend_alert";

export type InsightPriority = "critical" | "warning" | "opportunity" | "info";

/* ============ Legacy Types (used by calculations.ts) ============ */

export interface MonthlySummary {
  month: string;
  year: number;
  revenue: number;
  expenses: number;
  profit: number;
  profitMargin: number;
  cashInflow: number;
  cashOutflow: number;
  netCashFlow: number;
}

export type HealthStatus = "strong" | "healthy" | "watch" | "risk";

export interface FinancialHealthScore {
  id: string;
  businessId: string;
  score: number;
  status: HealthStatus;
  cashRunway: { score: number; status: HealthStatus; daysOfRunway?: number };
  revenueGrowth: { score: number; status: HealthStatus; monthlyGrowthRate?: number };
  expenseControl: { score: number; status: HealthStatus; expenseGrowthRate?: number };
  subscriptionHealth: { score: number; status: HealthStatus; monthlySpend?: number };
  factors: string[];
  recommendations: string[];
  calculatedAt: Date;
  updatedAt: Date;
}

/* ============ Chart Data ============ */

export interface MonthlyMetric {
  month: string;
  revenue: number;
  expenses: number;
  profit: number;
  cashIn: number;
  cashOut: number;
}

export interface DashboardMetrics {
  cashBalance: number;
  monthlyRevenue: number;
  monthlyExpenses: number;
  netProfit: number;
  profitMargin: number;
  monthlyBurn: number;
  runwayMonths: number;
  healthScore: number;
  activeSubscriptions: number;
  monthlySubscriptionSpend: number;
  flaggedSubscriptions: number;
  potentialSavings: number;
  totalTransactions: number;
  uncategorizedTransactions: number;
  arr: number;
  grossMargin: number;
  netNewARR: number;
  burnMultiple: number;
  ruleOf40: number;
}
