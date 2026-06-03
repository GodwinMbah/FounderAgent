/**
 * Transaction filters — canonical rules for income/expense/transfer detection.
 * Every revenue/expense calculation in the app must use these to stay consistent.
 */

export interface TransactionLike {
  type: string;
  category?: string;
  tags?: string[];
  rowStatus?: string;
  kpiExcluded?: boolean;
  kpiExclusionReason?: string;
  metadata?: Record<string, unknown> | null;
}

export function isTransfer(t: TransactionLike): boolean {
  const metadata = t.metadata ?? {};
  return (
    t.category === "Transfers" ||
    t.rowStatus === "transfer" ||
    t.kpiExclusionReason === "transfer" ||
    metadata.row_status === "transfer" ||
    metadata.kpi_exclusion_reason === "transfer" ||
    (Array.isArray(t.tags) && t.tags.includes("transfer"))
  );
}

export function isKpiExcluded(t: TransactionLike): boolean {
  const metadata = t.metadata ?? {};
  return t.kpiExcluded === true || metadata.kpi_excluded === true;
}

export function isIncome(t: TransactionLike): boolean {
  return t.type === "income" && !isTransfer(t) && !isKpiExcluded(t);
}

export function isExpense(t: TransactionLike): boolean {
  return t.type === "expense" && !isTransfer(t) && !isKpiExcluded(t);
}

const COGS_CATEGORIES = new Set([
  "cogs",
  "cost of goods sold",
  "materials",
  "manufacturing",
  "inventory",
  "production",
  "shipping",
  "shipping and fulfilment",
  "fulfillment",
  "direct labor",
]);

/**
 * Detect whether a transaction is a Cost of Goods Sold (COGS).
 * Transfers are explicitly excluded — they are neither income, expense, nor COGS.
 */
export function isCOGS(t: TransactionLike): boolean {
  if (isTransfer(t)) return false;
  const category = (t.category || "").toLowerCase();
  if (COGS_CATEGORIES.has(category)) return true;
  if (Array.isArray(t.tags)) {
    const lowerTags = t.tags.map((tag) => tag.toLowerCase());
    return lowerTags.some((tag) => COGS_CATEGORIES.has(tag));
  }
  return false;
}
