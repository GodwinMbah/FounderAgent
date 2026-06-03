import type { IntentType } from "./intent";
import {
  formatCurrency,
  formatPercent,
  formatNumber,
  formatRunwayLabel,
} from "@/lib/utils/formatters";
import type { CurrencyCode } from "@/lib/hooks/useCompanyCurrency";

function getResponseCurrency(data: Record<string, unknown>): CurrencyCode {
  return typeof data.currency === "string" ? data.currency : "GBP";
}

export function generateResponse(
  intent: IntentType,
  data: Record<string, unknown>,
  _message: string
): string {
  const currency = getResponseCurrency(data);
  const money = (value: number) => formatCurrency(value, 0, currency);

  switch (intent) {
    case "greeting":
      return "Hello! I'm FounderAgent, your AI finance copilot. What would you like to know about your business?";

    case "cash_flow_query": {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { metrics, monthlyMetrics } = (data || {}) as Record<string, any>;
      const cashBalance = metrics?.cashBalance ?? 0;
      const monthlyBurn = metrics?.monthlyBurn ?? 0;
      const runwayMonths = metrics?.runwayMonths ?? 0;

      let response = `Your current cash balance is ${money(cashBalance)}. `;
      if (monthlyBurn > 0) {
        response += `Monthly burn is ${money(monthlyBurn)}, giving you a runway of approximately ${formatRunwayLabel(runwayMonths)}. `;
      } else {
        response += `You're operating at or above break-even with no monthly burn. `;
      }
      if (Array.isArray(monthlyMetrics) && monthlyMetrics.length > 0) {
        const latest = monthlyMetrics[monthlyMetrics.length - 1];
        response += `In ${latest.month}, you had ${money(latest.cashIn)} in and ${money(latest.cashOut)} out.`;
      }
      return response.trim();
    }

    case "subscription_query": {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { stats } = (data || {}) as Record<string, any>;
      const activeSubscriptions = stats?.count ?? 0;
      const monthlySpend = stats?.monthlySpend ?? 0;
      const flaggedSubscriptions = stats?.flagged ?? 0;
      const potentialSavings = stats?.potentialSavings ?? 0;

      let response = `You have ${formatNumber(activeSubscriptions)} active subscriptions with a monthly spend of ${money(monthlySpend)}. `;
      if (flaggedSubscriptions > 0) {
        response += `${formatNumber(flaggedSubscriptions)} are flagged for review, with potential savings of ${money(potentialSavings)}.`;
      } else {
        response += `No subscriptions are currently flagged.`;
      }
      return response.trim();
    }

    case "budget_query": {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { stats } = (data || {}) as Record<string, any>;
      const totalBudget = stats?.totalBudget ?? 0;
      const totalSpent = stats?.totalSpent ?? 0;
      const percentUsed = stats?.percentUsed ?? 0;
      const overBudgetCount = stats?.overBudgetCount ?? 0;

      let response = `Your total budget is ${money(totalBudget)}. You've spent ${money(totalSpent)} (${formatPercent(percentUsed)} used). `;
      if (overBudgetCount > 0) {
        response += `${formatNumber(overBudgetCount)} categories are over budget.`;
      } else {
        response += `All categories are within budget.`;
      }
      return response.trim();
    }

    case "transaction_query": {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { stats } = (data || {}) as Record<string, any>;
      const count = stats?.count ?? 0;
      const categorized = stats?.categorized ?? 0;
      const needsReview = stats?.needsReview ?? 0;
      const totalExpenses = stats?.expenses ?? 0;

      let response = `You have ${formatNumber(count)} transactions on record. `;
      if (categorized > 0 || needsReview > 0) {
        response += `${formatNumber(categorized)} are categorized and ${formatNumber(needsReview)} need review. `;
      }
      if (totalExpenses > 0) {
        response += `Total expenses recorded: ${money(totalExpenses)}.`;
      }
      return response.trim();
    }

    case "runway_query": {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { metrics } = (data || {}) as Record<string, any>;
      const cashBalance = metrics?.cashBalance ?? 0;
      const monthlyBurn = metrics?.monthlyBurn ?? 0;
      const runwayMonths = metrics?.runwayMonths ?? 0;

      let response = `Your cash balance is ${money(cashBalance)}. `;
      if (monthlyBurn > 0) {
        response += `At a monthly burn of ${money(monthlyBurn)}, your runway is approximately ${formatRunwayLabel(runwayMonths)}.`;
      } else {
        response += `With no monthly burn, your runway is effectively infinite.`;
      }
      return response.trim();
    }

    case "revenue_query": {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { monthlyMetrics, transactions } = (data || {}) as Record<string, any>;
      let totalRevenue = 0;
      if (Array.isArray(transactions)) {
        totalRevenue = transactions
          .filter((t: { type: string }) => t.type === "income")
          .reduce((s: number, t: { amount?: number }) => s + (t.amount ?? 0), 0);
      }

      let response = `Your total recorded revenue is ${money(totalRevenue)}. `;
      if (Array.isArray(monthlyMetrics) && monthlyMetrics.length > 0) {
        const latest = monthlyMetrics[monthlyMetrics.length - 1];
        response += `In ${latest.month}, revenue was ${money(latest.revenue)} with profit of ${money(latest.profit)}.`;
      }
      return response.trim();
    }

    case "agent_task_request": {
      return "I'll create a task to analyse that for you. You can track it in the Agent Tasks page.";
    }

    case "general_help":
    default:
      return "I can help with cash flow, subscriptions, budgets, transactions, runway, revenue, and creating agent tasks. What would you like to explore?";
  }
}
