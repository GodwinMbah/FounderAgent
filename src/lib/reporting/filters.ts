/**
 * Transaction filters — canonical rules for income/expense/transfer detection.
 * Every revenue/expense calculation in the app must use these to stay consistent.
 */

export interface TransactionLike {
  type: string;
  category?: string;
  tags?: string[];
}

export function isTransfer(t: TransactionLike): boolean {
  return t.category === "Transfers" || (Array.isArray(t.tags) && t.tags.includes("transfer"));
}

export function isIncome(t: TransactionLike): boolean {
  return t.type === "income" && !isTransfer(t);
}

export function isExpense(t: TransactionLike): boolean {
  return t.type === "expense" && !isTransfer(t);
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
