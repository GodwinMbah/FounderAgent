/**
 * Financial Calculations
 * Core business logic for financial metrics and insights
 */

import { Transaction, MonthlySummary, FinancialHealthScore } from "./types";

/**
 * Calculate monthly financial summary from transactions
 */
export function calculateMonthlySummary(
  transactions: Transaction[],
  month: string // YYYY-MM format
): MonthlySummary {
  const monthTransactions = transactions.filter(
    (t) => new Date(t.date).toISOString().slice(0, 7) === month
  );

  const income = monthTransactions
    .filter((t) => t.type === "income")
    .reduce((sum, t) => sum + t.amount, 0);

  const expenses = monthTransactions
    .filter((t) => t.type === "expense")
    .reduce((sum, t) => sum + t.amount, 0);

  const profit = income - expenses;
  const profitMargin = income > 0 ? (profit / income) * 100 : 0;

  return {
    month,
    year: parseInt(month.split("-")[0]),
    revenue: income,
    expenses,
    profit,
    profitMargin,
    cashInflow: income,
    cashOutflow: expenses,
    netCashFlow: income - expenses,
  };
}

/**
 * Calculate profit margin percentage
 */
export function calculateProfitMargin(
  revenue: number,
  expenses: number
): number {
  if (revenue === 0) return 0;
  return ((revenue - expenses) / revenue) * 100;
}

/**
 * Calculate gross profit margin
 */
export function calculateGrossMargin(
  revenue: number,
  costOfGoods: number
): number {
  if (revenue === 0) return 0;
  return ((revenue - costOfGoods) / revenue) * 100;
}

/**
 * Calculate monthly burn rate (negative cash flow)
 */
export function calculateMonthlyBurn(
  revenue: number,
  expenses: number
): number {
  return Math.max(0, expenses - revenue);
}

/**
 * Calculate runway (months of cash left)
 * runwayMonths = currentCashBalance / monthlyBurn
 */
export function calculateRunway(
  cashBalance: number,
  monthlyBurn: number
): number {
  if (monthlyBurn === 0) return Infinity; // Positive cash flow = infinite runway
  return cashBalance / monthlyBurn;
}

/**
 * Format runway as readable string
 */
export function formatRunway(monthsOfRunway: number): {
  value: number;
  unit: string;
  status: "risk" | "watch" | "healthy" | "strong";
} {
  if (monthsOfRunway === Infinity) {
    return { value: Infinity, unit: "months", status: "strong" };
  }

  if (monthsOfRunway < 0 || !Number.isFinite(monthsOfRunway)) {
    return { value: 0, unit: "months", status: "risk" };
  }

  let status: "risk" | "watch" | "healthy" | "strong" = "healthy";
  if (monthsOfRunway < 3) status = "risk";
  else if (monthsOfRunway < 6) status = "watch";
  else if (monthsOfRunway >= 12) status = "strong";

  return {
    value: Math.round(monthsOfRunway * 10) / 10,
    unit: "months",
    status,
  };
}

/**
 * Calculate month-over-month growth rate
 */
export function calculateGrowthRate(
  currentValue: number,
  previousValue: number
): number {
  if (previousValue === 0) {
    return currentValue > 0 ? 100 : 0;
  }
  return ((currentValue - previousValue) / previousValue) * 100;
}

/**
 * Calculate average transaction amount
 */
export function calculateAverageTransaction(
  transactions: Transaction[]
): number {
  if (transactions.length === 0) return 0;
  const total = transactions.reduce((sum, t) => sum + t.amount, 0);
  return total / transactions.length;
}

/**
 * Get top expense categories with amounts
 */
export function getTopExpenseCategories(
  transactions: Transaction[],
  limit: number = 5
): Array<{ category: string; amount: number; percentage: number }> {
  const categoryTotals: Record<string, number> = {};
  let total = 0;

  for (const transaction of transactions) {
    if (transaction.type === "expense") {
      const category = transaction.category || "Uncategorized";
      categoryTotals[category] = (categoryTotals[category] || 0) + transaction.amount;
      total += transaction.amount;
    }
  }

  return Object.entries(categoryTotals)
    .map(([category, amount]) => ({
      category,
      amount,
      percentage: (amount / total) * 100,
    }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, limit);
}

/**
 * Detect subscription spending
 */
export function calculateSubscriptionSpend(
  transactions: Transaction[]
): {
  totalMonthly: number;
  totalAnnual: number;
  subscriptionCount: number;
} {
  const subscriptionTransactions = transactions.filter(
    (t) =>
      t.type === "expense" &&
      (t.category === "Subscriptions" ||
        t.category === "Software" ||
        t.category === "AI Tools")
  );

  const totalMonthly = subscriptionTransactions.reduce(
    (sum, t) => sum + t.amount,
    0
  );

  return {
    totalMonthly,
    totalAnnual: totalMonthly * 12,
    subscriptionCount: subscriptionTransactions.length,
  };
}

/**
 * Calculate financial health score
 */
export function calculateFinancialHealthScore(metrics: {
  runway: number;
  revenueGrowth: number;
  expenseGrowth: number;
  profitMargin: number;
  subscriptionBurn: number;
}): FinancialHealthScore {
  const scores = {
    runway: calculateRunwayScore(metrics.runway),
    revenueGrowth: calculateGrowthScore(metrics.revenueGrowth, "growth"),
    expenseControl: calculateGrowthScore(metrics.expenseGrowth, "expense"),
    subscriptionHealth: calculateSubscriptionScore(metrics.subscriptionBurn),
  };

  const overallScore = Math.round(
    (scores.runway.score +
      scores.revenueGrowth.score +
      scores.expenseControl.score +
      scores.subscriptionHealth.score) /
      4
  );

  const factors: string[] = [];
  if (metrics.runway < 3) factors.push("Low cash runway");
  if (metrics.revenueGrowth < 0) factors.push("Revenue declining");
  if (metrics.expenseGrowth > 15) factors.push("Expenses growing rapidly");
  if (metrics.profitMargin < 10) factors.push("Profit margin low");

  return {
    id: "",
    businessId: "",
    score: overallScore,
    status: determineHealthStatus(overallScore),
    cashRunway: {
      score: scores.runway.score,
      status: determineHealthStatus(scores.runway.score),
      daysOfRunway: metrics.runway * 30,
    },
    revenueGrowth: {
      score: scores.revenueGrowth.score,
      status: determineHealthStatus(scores.revenueGrowth.score),
      monthlyGrowthRate: metrics.revenueGrowth,
    },
    expenseControl: {
      score: scores.expenseControl.score,
      status: determineHealthStatus(scores.expenseControl.score),
      expenseGrowthRate: metrics.expenseGrowth,
    },
    subscriptionHealth: {
      score: scores.subscriptionHealth.score,
      status: determineHealthStatus(scores.subscriptionHealth.score),
      monthlySpend: metrics.subscriptionBurn,
    },
    factors,
    recommendations: generateRecommendations(metrics),
    calculatedAt: new Date(),
    updatedAt: new Date(),
  };
}

/**
 * Calculate runway score
 */
function calculateRunwayScore(runway: number): { score: number } {
  if (runway >= 12) return { score: 100 };
  if (runway >= 9) return { score: 90 };
  if (runway >= 6) return { score: 75 };
  if (runway >= 3) return { score: 50 };
  if (runway >= 1) return { score: 25 };
  return { score: 0 };
}

/**
 * Calculate growth or control score
 */
function calculateGrowthScore(
  growth: number,
  type: "growth" | "expense"
): { score: number } {
  if (type === "growth") {
    // Higher revenue growth is better
    if (growth > 30) return { score: 100 };
    if (growth > 15) return { score: 90 };
    if (growth > 0) return { score: 75 };
    if (growth > -10) return { score: 50 };
    return { score: 25 };
  } else {
    // Lower expense growth is better
    if (growth < 0) return { score: 100 };
    if (growth < 5) return { score: 90 };
    if (growth < 10) return { score: 75 };
    if (growth < 15) return { score: 50 };
    return { score: 25 };
  }
}

/**
 * Calculate subscription spending score
 */
function calculateSubscriptionScore(
  monthlySpend: number
): { score: number } {
  // Assuming monthly revenue context would be passed in real app
  if (monthlySpend < 1000) return { score: 100 };
  if (monthlySpend < 2500) return { score: 85 };
  if (monthlySpend < 5000) return { score: 70 };
  if (monthlySpend < 10000) return { score: 50 };
  return { score: 25 };
}

/**
 * Determine health status from score
 */
function determineHealthStatus(
  score: number
): "strong" | "healthy" | "watch" | "risk" {
  if (score >= 80) return "strong";
  if (score >= 60) return "healthy";
  if (score >= 40) return "watch";
  return "risk";
}

/**
 * Generate recommendations based on financial metrics
 */
function generateRecommendations(metrics: {
  runway: number;
  revenueGrowth: number;
  expenseGrowth: number;
  profitMargin: number;
  subscriptionBurn: number;
}): string[] {
  const recommendations: string[] = [];

  if (metrics.runway < 3) {
    recommendations.push(
      "Critical: Improve cash flow urgently. Consider cost reduction or revenue acceleration."
    );
  }

  if (metrics.revenueGrowth < 0) {
    recommendations.push(
      "Revenue is declining. Focus on sales and customer retention."
    );
  }

  if (metrics.expenseGrowth > 20) {
    recommendations.push(
      "Expenses are growing too fast. Review spending and optimize costs."
    );
  }

  if (metrics.subscriptionBurn > 5000) {
    recommendations.push(
      "Software and subscription costs are high. Review and consolidate tools."
    );
  }

  if (metrics.profitMargin < 10) {
    recommendations.push(
      "Profit margin is low. Focus on pricing strategy or cost optimization."
    );
  }

  if (recommendations.length === 0) {
    recommendations.push("Financial health is strong. Continue monitoring trends.");
  }

  return recommendations;
}

/**
 * Calculate expense growth rate between periods
 */
export function calculateExpenseGrowth(
  currentExpenses: number,
  previousExpenses: number
): number {
  return calculateGrowthRate(currentExpenses, previousExpenses);
}

/**
 * Identify money leaks (unusual spending patterns)
 */
export function identifyMoneyLeaks(
  transactions: Transaction[],
  threshold: number = 2 // Amount is 2x average
): Array<{
  category: string;
  transactions: Transaction[];
  avgAmountNormal: number;
  totalLeakAmount: number;
}> {
  const categoryTransactions: Record<string, Transaction[]> = {};
  const categoryAverages: Record<string, number> = {};

  // Group by category and calculate averages
  for (const transaction of transactions) {
    const category = transaction.category || "Unknown";
    if (!categoryTransactions[category]) {
      categoryTransactions[category] = [];
    }
    categoryTransactions[category].push(transaction);
  }

  for (const [category, txns] of Object.entries(categoryTransactions)) {
    const avg = calculateAverageTransaction(txns);
    categoryAverages[category] = avg;
  }

  // Find leaks
  const leaks: Array<{
    category: string;
    transactions: Transaction[];
    avgAmountNormal: number;
    totalLeakAmount: number;
  }> = [];

  for (const [category, txns] of Object.entries(categoryTransactions)) {
    const avg = categoryAverages[category];
    const leakTransactions = txns.filter((t) => t.amount > avg * threshold);

    if (leakTransactions.length > 0) {
      const totalLeak = leakTransactions.reduce((sum, t) => sum + t.amount, 0);
      leaks.push({
        category,
        transactions: leakTransactions,
        avgAmountNormal: avg,
        totalLeakAmount: totalLeak,
      });
    }
  }

  return leaks.sort((a, b) => b.totalLeakAmount - a.totalLeakAmount);
}
