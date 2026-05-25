"use client";

import { useMemo } from "react";
import {
  monthlyPL,
  subscriptions,
  insights,
  financialHealthScore,
  expenseCategories,
} from "@/lib/data";
import {
  calculateMonthlyBurn,
  calculateRunway,
  formatRunway,
  calculateProfitMargin,
  calculateGrowthRate,
} from "@/lib/calculations";

export function useDashboardData() {
  return useMemo(() => {
    const currentMonth = monthlyPL[monthlyPL.length - 1];
    const previousMonth = monthlyPL[monthlyPL.length - 2];
    const cashBalance = 1420000;

    const monthlyBurn = calculateMonthlyBurn(currentMonth.revenue, currentMonth.expenses);
    const runwayMonths = calculateRunway(cashBalance, monthlyBurn);
    const runwayFormatted = formatRunway(runwayMonths);

    const revenueGrowth = previousMonth
      ? calculateGrowthRate(currentMonth.revenue, previousMonth.revenue)
      : 0;
    const expenseGrowth = previousMonth
      ? calculateGrowthRate(currentMonth.expenses, previousMonth.expenses)
      : 0;

    const profitMargin = calculateProfitMargin(currentMonth.revenue, currentMonth.expenses);

    const activeSubscriptions = subscriptions.filter((s) => s.status === "active");
    const monthlySubscriptionSpend = activeSubscriptions.reduce((sum, s) => sum + s.amount, 0);

    const sparklines = {
      cash: [1250000, 1280000, 1300000, 1350000, 1380000, 1400000, 1420000],
      revenue: [38000, 40000, 42000, 44000, 46000, 47000, 48250],
      expenses: [18500, 19000, 19800, 20200, 21000, 21500, 21840],
      profit: [15000, 17000, 18500, 21000, 23000, 25000, 26410],
      margin: [42, 44, 46, 48, 51, 53, 54.7],
      burn: [0, 0, 0, 0, 0, 0, 0],
      runway: [8, 8.5, 9, 9.5, 10, 10.2, 10.3],
      health: [72, 75, 78, 80, 83, 85, 87],
    };

    const kpiItems = [
      {
        label: "Cash Balance",
        value: cashBalance,
        change: 12.4,
        format: "currency" as const,
        icon: "wallet" as const,
        sparkline: sparklines.cash,
        sparkColor: "var(--accent)",
        iconColor: "var(--accent)",
      },
      {
        label: "Monthly Burn",
        value: 152000,
        change: -8.7,
        format: "currency" as const,
        icon: "flame" as const,
        sparkline: sparklines.expenses,
        sparkColor: "var(--danger)",
        iconColor: "var(--danger)",
      },
      {
        label: "Runway",
        value: runwayMonths,
        change: 1.2,
        changeLabel: "1.2 mo",
        format: "runway" as const,
        icon: "clock" as const,
        sparkline: sparklines.runway,
        sparkColor: "var(--neon-cyan)",
        iconColor: "var(--neon-cyan)",
      },
      {
        label: "MRR",
        value: 312000,
        change: 7.3,
        format: "currency" as const,
        icon: "trending-up" as const,
        sparkline: sparklines.revenue,
        sparkColor: "var(--success)",
        iconColor: "var(--success)",
      },
      {
        label: "Monthly Revenue",
        value: currentMonth.revenue,
        change: revenueGrowth,
        format: "currency" as const,
        icon: "trending-up" as const,
        sparkline: sparklines.revenue,
        sparkColor: "var(--success)",
        iconColor: "var(--success)",
      },
      {
        label: "Monthly Expenses",
        value: currentMonth.expenses,
        change: expenseGrowth,
        format: "currency" as const,
        icon: "trending-down" as const,
        sparkline: sparklines.expenses,
        sparkColor: "var(--danger)",
        iconColor: "var(--danger)",
      },
      {
        label: "Net Profit",
        value: currentMonth.profit,
        change: previousMonth
          ? calculateGrowthRate(currentMonth.profit, previousMonth.profit)
          : 0,
        format: "currency" as const,
        icon: "zap" as const,
        sparkline: sparklines.profit,
        sparkColor: "var(--accent)",
        iconColor: "var(--accent)",
      },
      {
        label: "Health Score",
        value: financialHealthScore.score,
        changeLabel: financialHealthScore.status,
        format: "number" as const,
        icon: "heart" as const,
        sparkline: sparklines.health,
        sparkColor: "var(--highlight)",
        iconColor: "var(--highlight)",
      },
    ];

    return {
      kpiItems,
      monthlyPL,
      topExpenses: expenseCategories.slice(0, 5),
      activeSubscriptions,
      monthlySubscriptionSpend,
      financialHealthScore,
      insights: insights.slice(0, 3).map((i) => ({
        id: i.id,
        priority: i.priority,
        title: i.title,
        description: i.description,
        type: i.type,
      })),
    };
  }, []);
}
