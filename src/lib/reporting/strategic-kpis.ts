/**
 * Strategic KPIs — ARR, Gross Margin, Burn Multiple, Rule of 40, etc.
 */

import { normalizeSubscriptionSpend } from "./subscriptions";
import type { SubscriptionLike } from "./subscriptions";
import { isCOGS } from "./filters";

/**
 * Annual Recurring Revenue from active subscriptions.
 */
export function calculateARR(activeSubs: SubscriptionLike[]): number {
  const monthly = normalizeSubscriptionSpend(activeSubs);
  return monthly * 12;
}

/**
 * Gross Margin % = ((revenue - cogs) / revenue) * 100
 */
export function calculateGrossMargin(revenue: number, cogs: number): number {
  if (revenue === 0) return 0;
  return ((revenue - cogs) / revenue) * 100;
}

/**
 * Sum COGS from transactions.
 */
export function sumCOGS(transactions: Array<{ type: string; category?: string; tags?: string[]; amount: number }>): number {
  return transactions
    .filter((t) => isCOGS(t))
    .reduce((sum, t) => sum + (t.amount || 0), 0);
}

/**
 * Net New ARR = current ARR - prior ARR
 * Returns 0 if previousARR is undefined/null (first period).
 */
export function calculateNetNewARR(currentARR: number, previousARR?: number | null): number {
  if (previousARR === undefined || previousARR === null) return 0;
  return currentARR - previousARR;
}

/**
 * Burn Multiple = monthlyBurn / netNewARR
 * Returns Infinity when netNewARR <= 0 (no growth to compare against).
 * Returns 0 when monthlyBurn is 0 (profitable).
 */
export function calculateBurnMultiple(monthlyBurn: number, netNewARR: number): number {
  if (netNewARR <= 0) return Infinity;
  return monthlyBurn / netNewARR;
}

/**
 * Year-over-Year revenue growth %.
 * Returns 0 if priorRevenue is 0 or undefined.
 */
export function calculateYoYGrowth(currentRevenue: number, priorRevenue?: number | null): number {
  if (!priorRevenue || priorRevenue === 0) return 0;
  return ((currentRevenue - priorRevenue) / priorRevenue) * 100;
}

/**
 * Rule of 40 = YoY growth % + profit margin %
 */
export function calculateRuleOf40(yoyGrowth: number, profitMargin: number): number {
  return yoyGrowth + profitMargin;
}
