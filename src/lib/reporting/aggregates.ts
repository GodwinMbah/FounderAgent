/**
 * Aggregation utilities — group transactions by category, sum by month, etc.
 */

import { isCashMovementIn, isCashMovementOut, isIncome, isExpense } from "./filters";
import type { TransactionLike } from "./filters";

export interface TransactionWithAmount extends TransactionLike {
  amount: number;
}

export interface CategoryAggregate {
  name: string;
  amount: number;
  count: number;
  percentage: number;
}

/**
 * Group transactions by category for a given type ("income" | "expense").
 * Excludes transfers automatically.
 */
export function groupByCategory(
  transactions: TransactionWithAmount[],
  type: "income" | "expense"
): CategoryAggregate[] {
  const filterFn = type === "income" ? isIncome : isExpense;
  const map = new Map<string, { amount: number; count: number }>();
  let total = 0;

  for (const t of transactions) {
    if (!filterFn(t)) continue;
    const name = t.category || "Uncategorized";
    const current = map.get(name) ?? { amount: 0, count: 0 };
    current.amount += t.amount;
    current.count += 1;
    map.set(name, current);
    total += t.amount;
  }

  return Array.from(map.entries())
    .map(([name, { amount, count }]) => ({
      name,
      amount,
      count,
      percentage: total > 0 ? (amount / total) * 100 : 0,
    }))
    .sort((a, b) => b.amount - a.amount);
}

export interface MonthlyAggregate {
  month: string;
  revenue: number;
  expenses: number;
  profit: number;
  cashIn: number;
  cashOut: number;
}

/**
 * Sum transactions by month (YYYY-MM).
 * Returns sorted array ascending by month.
 */
export function sumByMonth(
  transactions: Array<TransactionLike & { date: string; amount: number }>
): MonthlyAggregate[] {
  const grouped = new Map<string, { revenue: number; expenses: number; cashIn: number; cashOut: number }>();

  for (const t of transactions) {
    const month = t.date.slice(0, 7);
    const current = grouped.get(month) ?? { revenue: 0, expenses: 0, cashIn: 0, cashOut: 0 };
    if (isIncome(t)) current.revenue += t.amount;
    else if (isExpense(t)) current.expenses += t.amount;
    if (isCashMovementIn(t)) current.cashIn += t.amount;
    else if (isCashMovementOut(t)) current.cashOut += t.amount;
    grouped.set(month, current);
  }

  return Array.from(grouped.entries())
    .map(([month, vals]) => ({
      month,
      revenue: vals.revenue,
      expenses: vals.expenses,
      profit: vals.revenue - vals.expenses,
      cashIn: vals.cashIn,
      cashOut: vals.cashOut,
    }))
    .sort((a, b) => a.month.localeCompare(b.month));
}
