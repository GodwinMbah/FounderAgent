import { getDashboardMetrics, getMonthlyMetrics } from "@/lib/db/metrics";
import { getSubscriptions, getSubscriptionStats } from "@/lib/db/subscriptions";
import { getBudgets, getBudgetStats } from "@/lib/db/budgets";
import { getTransactions, getTransactionStats } from "@/lib/db/transactions";
import { getAlerts } from "@/lib/db/alerts";
import { getAgentTasks, getAgentTaskStats } from "@/lib/db/agent-tasks";
import { getAgentRecommendations } from "@/lib/db/agent-recommendations";
import type { IntentType } from "./intent";

export async function fetchContextForIntent(intent: IntentType, companyId: string) {
  const now = new Date();
  const toDate = now.toISOString().slice(0, 10);
  const ytdFrom = new Date(now.getFullYear(), 0, 1).toISOString().slice(0, 10);
  const last90From = new Date();
  last90From.setDate(last90From.getDate() - 90);
  const last12MFrom = new Date();
  last12MFrom.setMonth(last12MFrom.getMonth() - 12);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);

  switch (intent) {
    case "cash_flow_query": {
      const [metrics, monthlyMetrics] = await Promise.all([
        getDashboardMetrics(companyId),
        getMonthlyMetrics(companyId, last12MFrom.toISOString().slice(0, 10), toDate),
      ]);
      return { metrics, monthlyMetrics };
    }
    case "subscription_query": {
      const [subscriptions, stats] = await Promise.all([
        getSubscriptions(companyId),
        getSubscriptionStats(companyId),
      ]);
      return { subscriptions, stats };
    }
    case "budget_query": {
      const budgets = await getBudgets(companyId);
      const transactions = await getTransactions(companyId, { startDate: monthStart, endDate: monthEnd });
      const stats = await getBudgetStats(companyId, transactions);
      return { budgets, stats };
    }
    case "transaction_query": {
      const [transactions, stats] = await Promise.all([
        getTransactions(companyId, { startDate: last90From.toISOString().slice(0, 10), endDate: toDate, limit: 500 }),
        getTransactionStats(companyId),
      ]);
      return { transactions, stats };
    }
    case "runway_query": {
      const metrics = await getDashboardMetrics(companyId);
      return { metrics };
    }
    case "revenue_query": {
      const [transactions, monthlyMetrics] = await Promise.all([
        getTransactions(companyId, { startDate: ytdFrom, endDate: toDate, limit: 500 }),
        getMonthlyMetrics(companyId, ytdFrom, toDate),
      ]);
      return { transactions, monthlyMetrics };
    }
    case "agent_task_request": {
      const [tasks, stats, recommendations] = await Promise.all([
        getAgentTasks(companyId),
        getAgentTaskStats(companyId),
        getAgentRecommendations(companyId),
      ]);
      return { tasks, stats, recommendations };
    }
    case "general_help":
    case "greeting":
    default: {
      const [metrics, tasks, alerts] = await Promise.all([
        getDashboardMetrics(companyId),
        getAgentTaskStats(companyId),
        getAlerts(companyId),
      ]);
      return { metrics, tasks, alerts };
    }
  }
}
