"use server";

import { createClient as createServerClient } from "@/lib/supabase/server";
import { getActiveCompanyForUser } from "./company";
import { getCompanyMetrics, recalculateCompanyMetrics } from "./company-metrics";
import { getSubscriptions } from "./subscriptions";
import { isCashMovementIn, isCashMovementOut, isIncome, isExpense } from "@/lib/reporting/filters";
import { normalizeSubscriptionSpend } from "@/lib/reporting/subscriptions";
import { profitMargin } from "@/lib/reporting/kpis";
import { getActiveUploadIdsForCompany } from "./data-source";
import { applyActiveSourceFilter } from "./data-source-shared";

export { getCompanyMetrics, recalculateCompanyMetrics };

/**
 * Get dashboard metrics — uses cached company_metrics for speed,
 * with automatic recalculation if cache is stale.
 */
export async function getDashboardMetrics(companyId?: string, fromDate?: string, toDate?: string) {
  const ctx = await getActiveCompanyForUser();
  if (!ctx) throw new Error("Unauthorized");
  const effectiveCompanyId = companyId ?? ctx.companyId;
  if (effectiveCompanyId !== ctx.companyId) throw new Error("Forbidden: company mismatch");

  const metrics = fromDate && toDate
    ? await recalculateCompanyMetrics(effectiveCompanyId, "custom", fromDate, toDate)
    : await getCompanyMetrics(effectiveCompanyId, "30d");

  // Compute real potential savings from flagged subscriptions (normalized to monthly)
  const subs = await getSubscriptions(effectiveCompanyId);
  const flaggedSubsArr = subs.filter((s) => s.isFlagged);
  const potentialSavings = normalizeSubscriptionSpend(flaggedSubsArr);

  return {
    cashBalance: metrics.cashBalance,
    monthlyRevenue: metrics.totalRevenue,
    monthlyExpenses: metrics.totalExpenses,
    netProfit: metrics.netProfit,
    profitMargin: metrics.profitMargin,
    monthlyBurn: metrics.monthlyBurn,
    runwayMonths: metrics.runwayMonths >= 999 ? Infinity : metrics.runwayMonths,
    healthScore: metrics.healthScore,
    activeSubscriptions: metrics.activeSubscriptionCount,
    monthlySubscriptionSpend: metrics.monthlySubscriptionSpend,
    flaggedSubscriptions: metrics.flaggedSubscriptions,
    potentialSavings,
    totalTransactions: metrics.transactionCount,
    uncategorizedTransactions: metrics.uncategorizedCount,
    arr: metrics.arr || 0,
    grossMargin: metrics.grossMargin || 0,
    netNewARR: metrics.netNewARR || 0,
    burnMultiple: metrics.burnMultiple || 0,
    ruleOf40: metrics.ruleOf40 || 0,
  };
}

/**
 * Get monthly metrics grouped by month for charts.
 * Supports date range filtering.
 */
export async function getMonthlyMetrics(
  companyId?: string,
  fromDate?: string,
  toDate?: string
) {
  const ctx = await getActiveCompanyForUser();
  if (!ctx) throw new Error("Unauthorized");
  const effectiveCompanyId = companyId ?? ctx.companyId;
  if (effectiveCompanyId !== ctx.companyId) throw new Error("Forbidden: company mismatch");

  const supabase = await createServerClient();
  if (!supabase) throw new Error("Supabase not configured");
  const activeUploadIds = await getActiveUploadIdsForCompany(effectiveCompanyId, supabase);

  // Default to last 12 months
  const defaultTo = new Date().toISOString().slice(0, 10);
  const defaultFrom = new Date();
  defaultFrom.setMonth(defaultFrom.getMonth() - 12);

  const from = fromDate ?? defaultFrom.toISOString().slice(0, 10);
  const to = toDate ?? defaultTo;

  let query = supabase
    .from("transactions")
    .select("date, amount, type, category, tags, row_status, kpi_excluded, kpi_exclusion_reason, metadata")
    .eq("company_id", effectiveCompanyId)
    .gte("date", from)
    .lte("date", to)
    .order("date", { ascending: true });

  query = applyActiveSourceFilter(query, activeUploadIds);

  const { data: rawData, error } = await query;

  if (error) throw error;
  const data = rawData ?? [];

  // Group by month
  const grouped = new Map<string, { revenue: number; expenses: number; cashIn: number; cashOut: number }>();
  for (const tx of data) {
    const month = (tx.date as string).slice(0, 7);
    const current = grouped.get(month) ?? { revenue: 0, expenses: 0, cashIn: 0, cashOut: 0 };
    if (isIncome(tx)) current.revenue += Number(tx.amount);
    else if (isExpense(tx)) current.expenses += Number(tx.amount);
    if (isCashMovementIn(tx)) current.cashIn += Number(tx.amount);
    else if (isCashMovementOut(tx)) current.cashOut += Number(tx.amount);
    grouped.set(month, current);
  }

  return Array.from(grouped.entries()).map(([month, vals]) => ({
    month,
    revenue: vals.revenue,
    expenses: vals.expenses,
    profit: vals.revenue - vals.expenses,
    cashIn: vals.cashIn,
    cashOut: vals.cashOut,
  }));
}

/**
 * Get metrics for a specific date range (used by P&L, reports)
 */
export async function getMetricsForRange(
  companyId: string,
  fromDate: string,
  toDate: string
): Promise<{
  revenue: number;
  expenses: number;
  netProfit: number;
  profitMargin: number;
  transactionCount: number;
  expenseByCategory: Array<{ category: string; amount: number }>;
}> {
  const ctx = await getActiveCompanyForUser();
  if (!ctx) throw new Error("Unauthorized");
  if (companyId !== ctx.companyId) throw new Error("Forbidden: company mismatch");

  const admin = await import("@/lib/supabase/admin").then((m) => m.createAdminClient());
  if (!admin) throw new Error("Admin client not available");
  const activeUploadIds = await getActiveUploadIdsForCompany(companyId, admin);

  let query = admin
    .from("transactions")
    .select("amount, type, category, tags, row_status, kpi_excluded, kpi_exclusion_reason, metadata")
    .eq("company_id", companyId)
    .gte("date", fromDate)
    .lte("date", toDate);

  query = applyActiveSourceFilter(query, activeUploadIds);

  const { data: txs, error } = await query;

  if (error) throw error;

  const revenue = (txs ?? [])
    .filter((t: { type: string; category?: string; tags?: string[]; amount: number; metadata?: Record<string, unknown> | null }) => isIncome(t))
    .reduce((s: number, t: { amount: number }) => s + Number(t.amount), 0);

  const expenses = (txs ?? [])
    .filter((t: { type: string; category?: string; tags?: string[]; amount: number; metadata?: Record<string, unknown> | null }) => isExpense(t))
    .reduce((s: number, t: { amount: number }) => s + Number(t.amount), 0);

  const netProfit = revenue - expenses;
  const profitMarginValue = profitMargin(revenue, expenses);

  const categoryMap = new Map<string, number>();
  for (const t of txs ?? []) {
    if (!isExpense(t)) continue;
    const cat = t.category || "Uncategorized";
    categoryMap.set(cat, (categoryMap.get(cat) || 0) + Number(t.amount));
  }

  const expenseByCategory = Array.from(categoryMap.entries())
    .map(([category, amount]) => ({ category, amount }))
    .sort((a, b) => b.amount - a.amount);

  return {
    revenue,
    expenses,
    netProfit,
    profitMargin: profitMarginValue,
    transactionCount: txs?.length ?? 0,
    expenseByCategory,
  };
}
