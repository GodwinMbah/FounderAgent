"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { getActiveCompanyForUser } from "./company";
import { getTotalCashBalance } from "./bank-accounts";
import { getSubscriptions } from "./subscriptions";
import { isIncome, isExpense, isCOGS } from "@/lib/reporting/filters";
import {
  calculateARR,
  calculateGrossMargin,
  calculateBurnMultiple,
  calculateYoYGrowth,
  calculateRuleOf40,
} from "@/lib/reporting/strategic-kpis";
import { normalizeSubscriptionSpend } from "@/lib/reporting/subscriptions";
import { profitMargin as calcProfitMargin, monthlyBurn as calcMonthlyBurn, runwayMonths as calcRunwayMonths } from "@/lib/reporting/kpis";

export interface CompanyMetrics {
  id: string;
  companyId: string;
  metricDate: string;
  periodType: string;
  totalRevenue: number;
  totalExpenses: number;
  netProfit: number;
  cashBalance: number;
  monthlyBurn: number;
  runwayMonths: number;
  transactionCount: number;
  uncategorizedCount: number;
  activeSubscriptionCount: number;
  monthlySubscriptionSpend: number;
  flaggedSubscriptions: number;
  healthScore: number;
  profitMargin: number;
  arr: number;
  grossMargin: number;
  netNewARR: number;
  burnMultiple: number;
  ruleOf40: number;
  calculatedFrom?: string;
  calculatedTo?: string;
  updatedAt: string;
}

function mapRow(row: Record<string, unknown>): CompanyMetrics {
  return {
    id: row.id as string,
    companyId: row.company_id as string,
    metricDate: row.metric_date as string,
    periodType: row.period_type as string,
    totalRevenue: Number(row.total_revenue) || 0,
    totalExpenses: Number(row.total_expenses) || 0,
    netProfit: Number(row.net_profit) || 0,
    cashBalance: Number(row.cash_balance) || 0,
    monthlyBurn: Number(row.monthly_burn) || 0,
    runwayMonths: Number(row.runway_months) || 0,
    transactionCount: Number(row.transaction_count) || 0,
    uncategorizedCount: Number(row.uncategorized_count) || 0,
    activeSubscriptionCount: Number(row.active_subscription_count) || 0,
    monthlySubscriptionSpend: Number(row.monthly_subscription_spend) || 0,
    flaggedSubscriptions: Number(row.flagged_subscriptions) || 0,
    healthScore: Number(row.health_score) || 75,
    profitMargin: Number(row.profit_margin) || 0,
    arr: Number(row.arr) || 0,
    grossMargin: Number(row.gross_margin) || 0,
    netNewARR: Number(row.net_new_arr) || 0,
    burnMultiple: Number(row.burn_multiple) || 0,
    ruleOf40: Number(row.rule_of_40) || 0,
    calculatedFrom: row.calculated_from as string | undefined,
    calculatedTo: row.calculated_to as string | undefined,
    updatedAt: row.updated_at as string,
  };
}

function getDateRange(period: string): { from: string; to: string } {
  const now = new Date();
  const to = now.toISOString().slice(0, 10);
  const from = new Date(now);

  switch (period) {
    case "7d":
      from.setDate(now.getDate() - 7);
      break;
    case "30d":
      from.setDate(now.getDate() - 30);
      break;
    case "90d":
      from.setDate(now.getDate() - 90);
      break;
    case "ytd":
      from.setMonth(0, 1);
      break;
    case "all":
      from.setFullYear(2000, 0, 1);
      break;
    default:
      // Default to current month
      from.setDate(1);
  }

  return { from: from.toISOString().slice(0, 10), to };
}

/**
 * Recalculate company metrics from real data and cache the result.
 * This is called by the pipeline after each upload.
 */
export async function recalculateCompanyMetrics(
  companyId: string,
  periodType: string = "monthly",
  explicitFrom?: string,
  explicitTo?: string
): Promise<CompanyMetrics> {
  const admin = createAdminClient();
  if (!admin) throw new Error("Admin client not available");

  const { from, to } =
    explicitFrom && explicitTo
      ? { from: explicitFrom, to: explicitTo }
      : getDateRange(periodType);

  // 1. Fetch transactions in date range
  const { data: txs, error: txError } = await admin
    .from("transactions")
    .select("amount, type, status, date, category, tags")
    .eq("company_id", companyId)
    .gte("date", from)
    .lte("date", to);

  if (txError) throw txError;

  const revenue = (txs ?? [])
    .filter((t: { type: string; category?: string; tags?: string[]; amount: number }) => isIncome(t))
    .reduce((s: number, t: { amount: number }) => s + Number(t.amount), 0);

  const expenses = (txs ?? [])
    .filter((t: { type: string; category?: string; tags?: string[]; amount: number }) => isExpense(t))
    .reduce((s: number, t: { amount: number }) => s + Number(t.amount), 0);

  const netProfit = revenue - expenses;
  const profitMargin = calcProfitMargin(revenue, expenses);

  // COGS for gross margin
  const cogsTotal = (txs ?? [])
    .filter((t: { type: string; category?: string; tags?: string[]; amount: number }) => isCOGS(t))
    .reduce((s: number, t: { amount: number }) => s + Number(t.amount), 0);

  // 2. Cash balance from bank accounts (REAL, not derived)
  const cashBalance = await getTotalCashBalance(companyId);

  // 3. Monthly burn = average net burn over last 3 months
  const threeMonthsAgo = new Date();
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
  const burnFrom = threeMonthsAgo.toISOString().slice(0, 10);

  const { data: burnTxs, error: burnError } = await admin
    .from("transactions")
    .select("amount, date, category, tags, type")
    .eq("company_id", companyId)
    .in("type", ["income", "expense"])
    .gte("date", burnFrom);

  let monthlyBurn = 0;
  if (!burnError && burnTxs && burnTxs.length > 0) {
    const monthsCount = 3;
    const totalRevenue3M = burnTxs
      .filter((t: { type: string; category?: string; tags?: string[]; amount: number }) => isIncome(t))
      .reduce((s: number, t: { amount: number }) => s + Number(t.amount), 0);
    const totalExpenses3M = burnTxs
      .filter((t: { type: string; category?: string; tags?: string[]; amount: number }) => isExpense(t))
      .reduce((s: number, t: { amount: number }) => s + Number(t.amount), 0);
    const avgMonthlyRevenue = totalRevenue3M / monthsCount;
    const avgMonthlyExpenses = totalExpenses3M / monthsCount;
    monthlyBurn = calcMonthlyBurn(avgMonthlyRevenue, avgMonthlyExpenses);
  }

  // 4. Runway = cashBalance / monthlyBurn (Infinity if profitable/break-even)
  const runwayMonths = calcRunwayMonths(cashBalance, monthlyBurn);

  // 5. Subscription metrics
  const subs = await getSubscriptions(companyId);
  const activeSubs = subs.filter((s) => s.status === "active");
  const monthlySubscriptionSpend = normalizeSubscriptionSpend(activeSubs);
  const flaggedSubs = subs.filter((s) => s.isFlagged).length;

  // 6. Strategic KPIs
  const arr = calculateARR(activeSubs);
  const grossMargin = calculateGrossMargin(revenue, cogsTotal);

  // Net New ARR: proxy from period-over-period revenue change
  // since historical ARR snapshots are not persisted
  let netNewARR = 0;
  try {
    const periodMs = new Date(to).getTime() - new Date(from).getTime();
    const periodDays = Math.max(1, Math.ceil(periodMs / (1000 * 60 * 60 * 24)));
    const priorFromDate = new Date(from);
    priorFromDate.setDate(priorFromDate.getDate() - periodDays);
    const priorToDate = new Date(to);
    priorToDate.setDate(priorToDate.getDate() - periodDays);

    const { data: priorTxs } = await admin
      .from("transactions")
      .select("amount, type, status, date, category, tags")
      .eq("company_id", companyId)
      .gte("date", priorFromDate.toISOString().slice(0, 10))
      .lte("date", priorToDate.toISOString().slice(0, 10));

    const priorRevenue = (priorTxs ?? [])
      .filter((t: { type: string; category?: string; tags?: string[]; amount: number }) => isIncome(t))
      .reduce((s: number, t: { amount: number }) => s + Number(t.amount), 0);

    // Only compute if we have prior revenue data to compare against
    if (priorRevenue > 0) {
      netNewARR = Math.max(0, revenue - priorRevenue);
    }
  } catch {
    netNewARR = 0;
  }

  const burnMultiple = calculateBurnMultiple(monthlyBurn, netNewARR);

  // Rule of 40: needs YoY revenue growth
  let ruleOf40 = 0;
  try {
    const priorFromDate = new Date(from);
    priorFromDate.setMonth(priorFromDate.getMonth() - 12);
    const priorToDate = new Date(to);
    priorToDate.setMonth(priorToDate.getMonth() - 12);
    const priorFrom = priorFromDate.toISOString().slice(0, 10);
    const priorTo = priorToDate.toISOString().slice(0, 10);

    const { data: priorTxs } = await admin
      .from("transactions")
      .select("amount, type, status, date, category, tags")
      .eq("company_id", companyId)
      .gte("date", priorFrom)
      .lte("date", priorTo);

    const priorRevenue = (priorTxs ?? [])
      .filter((t: { type: string; category?: string; tags?: string[]; amount: number }) => isIncome(t))
      .reduce((s: number, t: { amount: number }) => s + Number(t.amount), 0);

    const yoyGrowth = calculateYoYGrowth(revenue, priorRevenue);
    ruleOf40 = calculateRuleOf40(yoyGrowth, profitMargin);
  } catch {
    ruleOf40 = 0;
  }

  // 7. Health score
  let healthScore = 75;
  if (expenses > 0) {
    const margin = calcProfitMargin(revenue, expenses);
    healthScore = Math.min(100, Math.max(0, Math.round(50 + margin)));
  }
  // Adjust for runway
  if (runwayMonths < 3) healthScore = Math.max(0, healthScore - 30);
  else if (runwayMonths < 6) healthScore = Math.max(0, healthScore - 15);
  else if (runwayMonths >= 12) healthScore = Math.min(100, healthScore + 10);

  const uncategorizedCount = (txs ?? []).filter((t: { status: string }) => t.status === "needs_review").length;

  // 7. Upsert cached metrics (skip for custom ranges to avoid cache collisions)
  if (periodType === "custom") {
    return {
      id: "custom-" + Date.now(),
      companyId,
      metricDate: new Date().toISOString().slice(0, 10),
      periodType,
      totalRevenue: revenue,
      totalExpenses: expenses,
      netProfit,
      cashBalance,
      monthlyBurn,
      runwayMonths,
      transactionCount: txs?.length ?? 0,
      uncategorizedCount,
      activeSubscriptionCount: activeSubs.length,
      monthlySubscriptionSpend,
      flaggedSubscriptions: flaggedSubs,
      healthScore,
      profitMargin,
      arr,
      grossMargin,
      netNewARR,
      burnMultiple,
      ruleOf40,
      calculatedFrom: from,
      calculatedTo: to,
      updatedAt: new Date().toISOString(),
    };
  }

  const metricDate = new Date().toISOString().slice(0, 10);

  const { data: row, error: upsertError } = await admin
    .from("company_metrics")
    .upsert(
      {
        company_id: companyId,
        metric_date: metricDate,
        period_type: periodType,
        total_revenue: revenue,
        total_expenses: expenses,
        net_profit: netProfit,
        cash_balance: cashBalance,
        monthly_burn: monthlyBurn,
        runway_months: runwayMonths === Infinity ? 999 : runwayMonths,
        transaction_count: txs?.length ?? 0,
        uncategorized_count: uncategorizedCount,
        active_subscription_count: activeSubs.length,
        monthly_subscription_spend: monthlySubscriptionSpend,
        flagged_subscriptions: flaggedSubs,
        health_score: healthScore,
        profit_margin: profitMargin,
        calculated_from: from,
        calculated_to: to,
        metadata: {},
      },
      { onConflict: "company_id, metric_date, period_type" }
    )
    .select("*")
    .single();

  if (upsertError || !row) {
    throw new Error(`Failed to cache metrics: ${upsertError?.message}`);
  }

  return mapRow(row as Record<string, unknown>);
}

/**
 * Get cached metrics for a company (fast, no recomputation)
 */
export async function getCachedMetrics(
  companyId: string,
  periodType: string = "monthly"
): Promise<CompanyMetrics | null> {
  const ctx = await getActiveCompanyForUser();
  if (!ctx) throw new Error("Unauthorized");
  if (companyId !== ctx.companyId) throw new Error("Forbidden");

  const supabase = await createServerClient();
  if (!supabase) throw new Error("Supabase not configured");

  const { data, error } = await supabase
    .from("company_metrics")
    .select("*")
    .eq("company_id", companyId)
    .eq("period_type", periodType)
    .order("metric_date", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;
  return mapRow(data as Record<string, unknown>);
}

/**
 * Get metrics with fallback to real-time calculation if cache is stale (>1 hour)
 */
export async function getCompanyMetrics(
  companyId: string,
  periodType: string = "monthly",
  maxAgeMinutes: number = 60
): Promise<CompanyMetrics> {
  const cached = await getCachedMetrics(companyId, periodType);

  if (cached) {
    const ageMs = Date.now() - new Date(cached.updatedAt).getTime();
    const ageMinutes = ageMs / (1000 * 60);
    if (ageMinutes < maxAgeMinutes) return cached;
  }

  // Stale or missing — recalculate
  return recalculateCompanyMetrics(companyId, periodType);
}
