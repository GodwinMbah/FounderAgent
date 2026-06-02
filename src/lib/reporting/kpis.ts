/**
 * KPI helpers — MoM change percentages, formatting, etc.
 */

export interface ChangeResult {
  text: string;
  type: "positive" | "negative" | "neutral";
}

/**
 * Calculate percentage change between two values.
 * For expenses, positive change is "negative" (bad) and vice versa.
 * For revenue/profit, positive change is "positive" (good).
 */
export function calculateChangePercent(
  current?: number,
  previous?: number,
  invert: boolean = false
): ChangeResult {
  if (current === undefined || previous === undefined || previous === 0) {
    return { text: "—", type: "neutral" };
  }
  const raw = ((current - previous) / Math.abs(previous)) * 100;
  const text = `${raw >= 0 ? "+" : ""}${raw.toFixed(1)}%`;
  const isGood = invert ? raw < 0 : raw >= 0;
  return { text, type: isGood ? "positive" : "negative" };
}

/**
 * Profit margin from revenue and expenses.
 */
export function profitMargin(revenue: number, expenses: number): number {
  if (revenue === 0) return 0;
  return ((revenue - expenses) / revenue) * 100;
}

/**
 * Monthly burn = max(0, expenses - revenue).
 */
export function monthlyBurn(revenue: number, expenses: number): number {
  return Math.max(0, expenses - revenue);
}

/**
 * Runway in months. Returns Infinity if burn is 0.
 */
export function runwayMonths(cashBalance: number, monthlyBurn: number): number {
  if (monthlyBurn === 0) return Infinity;
  return cashBalance / monthlyBurn;
}
