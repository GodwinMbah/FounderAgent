/**
 * Subscription spend normalization — convert any billing cycle to monthly equivalent.
 */

export interface SubscriptionLike {
  amount: number;
  billingCycle?: string;
}

/**
 * Normalize a single subscription to its monthly equivalent.
 */
export function toMonthly(sub: SubscriptionLike): number {
  const cycle = (sub.billingCycle || "monthly").toLowerCase();
  if (cycle === "weekly") return (sub.amount * 52) / 12;
  if (cycle === "quarterly") return sub.amount / 3;
  if (cycle === "yearly" || cycle === "annual") return sub.amount / 12;
  return sub.amount;
}

/**
 * Sum monthly-normalized spend for a list of subscriptions.
 */
export function normalizeSubscriptionSpend(subs: SubscriptionLike[]): number {
  return subs.reduce((sum, s) => sum + toMonthly(s), 0);
}
