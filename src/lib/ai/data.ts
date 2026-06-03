import { getDashboardMetrics, getMonthlyMetrics } from "@/lib/db/metrics";
import { getSubscriptions, getSubscriptionStats } from "@/lib/db/subscriptions";
import { getBudgets, getBudgetStats } from "@/lib/db/budgets";
import { getTransactions, getTransactionStats } from "@/lib/db/transactions";
import { getAlerts } from "@/lib/db/alerts";
import { getAgentTasks, getAgentTaskStats } from "@/lib/db/agent-tasks";
import { getAgentRecommendations } from "@/lib/db/agent-recommendations";
import { getCompanyById } from "@/lib/db/company";
import { groupByCategory } from "@/lib/reporting/aggregates";
import type { IntentType } from "./intent";

function withCurrency<T extends Record<string, unknown>>(data: T, currency: string): T & { currency: string } {
  return { ...data, currency };
}

export async function fetchContextForIntent(
  intent: IntentType,
  companyId: string,
  fromDate?: string,
  toDate?: string
) {
  const now = new Date();
  const toDateDefault = now.toISOString().slice(0, 10);
  const ytdFrom = new Date(now.getFullYear(), 0, 1).toISOString().slice(0, 10);
  const last90From = new Date();
  last90From.setDate(last90From.getDate() - 90);
  const last12MFrom = new Date();
  last12MFrom.setMonth(last12MFrom.getMonth() - 12);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);

  // Use provided date range if available; otherwise fall back to intent defaults
  const effectiveFrom = fromDate ?? ytdFrom;
  const effectiveTo = toDate ?? toDateDefault;
  const company = await getCompanyById(companyId);
  const currency = company?.currency ?? "GBP";

  switch (intent) {
    case "cash_flow_query": {
      const [metrics, monthlyMetrics] = await Promise.all([
        getDashboardMetrics(companyId),
        getMonthlyMetrics(companyId, last12MFrom.toISOString().slice(0, 10), toDateDefault),
      ]);
      return withCurrency({ metrics, monthlyMetrics }, currency);
    }
    case "subscription_query": {
      const [subscriptions, stats] = await Promise.all([
        getSubscriptions(companyId),
        getSubscriptionStats(companyId),
      ]);
      return withCurrency({ subscriptions, stats }, currency);
    }
    case "budget_query": {
      const budgets = await getBudgets(companyId);
      const transactions = await getTransactions(companyId, { startDate: monthStart, endDate: monthEnd });
      const stats = await getBudgetStats(companyId, transactions);
      return withCurrency({ budgets, stats }, currency);
    }
    case "transaction_query": {
      const [transactions, stats] = await Promise.all([
        getTransactions(companyId, { startDate: last90From.toISOString().slice(0, 10), endDate: toDateDefault }),
        getTransactionStats(companyId),
      ]);
      return withCurrency({ transactions, stats }, currency);
    }
    case "runway_query": {
      const metrics = await getDashboardMetrics(companyId);
      return withCurrency({ metrics }, currency);
    }
    case "revenue_query": {
      const [transactions, monthlyMetrics] = await Promise.all([
        getTransactions(companyId, { startDate: effectiveFrom, endDate: effectiveTo }),
        getMonthlyMetrics(companyId, effectiveFrom, effectiveTo),
      ]);
      return withCurrency({ transactions, monthlyMetrics }, currency);
    }
    case "agent_task_request": {
      const [tasks, stats, recommendations] = await Promise.all([
        getAgentTasks(companyId),
        getAgentTaskStats(companyId),
        getAgentRecommendations(companyId),
      ]);
      return withCurrency({ tasks, stats, recommendations }, currency);
    }
    case "financial_summary": {
      const [metrics, monthlyMetrics, transactions] = await Promise.all([
        getDashboardMetrics(companyId),
        getMonthlyMetrics(companyId, effectiveFrom, effectiveTo),
        getTransactions(companyId, { startDate: effectiveFrom, endDate: effectiveTo }),
      ]);
      const topExpenses = groupByCategory(transactions, "expense").slice(0, 5);
      const subs = await getSubscriptions(companyId);
      return withCurrency({ metrics, monthlyMetrics, topExpenses, subscriptions: subs }, currency);
    }
    case "general_help":
    case "greeting":
    default: {
      const [metrics, tasks, alerts] = await Promise.all([
        getDashboardMetrics(companyId),
        getAgentTaskStats(companyId),
        getAlerts(companyId),
      ]);
      return withCurrency({ metrics, tasks, alerts }, currency);
    }
  }
}

/**
 * Build a comprehensive company context object suitable for LLM consumption.
 * Includes date range awareness for grounded responses.
 */
export async function buildCompanyContext(
  companyId: string,
  fromDate?: string,
  toDate?: string
) {
  const now = new Date();
  const defaultTo = now.toISOString().slice(0, 10);
  const defaultFrom = new Date(now.getFullYear(), 0, 1).toISOString().slice(0, 10);

  const from = fromDate ?? defaultFrom;
  const to = toDate ?? defaultTo;

  const [metrics, monthlyMetrics, transactions, subscriptions] = await Promise.all([
    getDashboardMetrics(companyId),
    getMonthlyMetrics(companyId, from, to),
    getTransactions(companyId, { startDate: from, endDate: to }),
    getSubscriptions(companyId),
  ]);

  const topExpenses = groupByCategory(transactions, "expense").slice(0, 5);
  const topRevenue = groupByCategory(transactions, "income").slice(0, 5);

  return {
    dateRange: { from, to },
    metrics: {
      cashBalance: metrics.cashBalance,
      monthlyRevenue: metrics.monthlyRevenue,
      monthlyExpenses: metrics.monthlyExpenses,
      netProfit: metrics.netProfit,
      profitMargin: metrics.profitMargin,
      monthlyBurn: metrics.monthlyBurn,
      runwayMonths: metrics.runwayMonths,
      healthScore: metrics.healthScore,
      monthlySubscriptionSpend: metrics.monthlySubscriptionSpend,
      arr: metrics.arr || 0,
      grossMargin: metrics.grossMargin || 0,
      netNewARR: metrics.netNewARR || 0,
      burnMultiple: metrics.burnMultiple || 0,
      ruleOf40: metrics.ruleOf40 || 0,
    },
    monthlyTrend: monthlyMetrics,
    topExpenses,
    topRevenue,
    subscriptions: subscriptions.map((s) => ({
      name: s.name,
      amount: s.amount,
      billingCycle: s.billingCycle,
      status: s.status,
    })),
    transactionCount: transactions.length,
  };
}
