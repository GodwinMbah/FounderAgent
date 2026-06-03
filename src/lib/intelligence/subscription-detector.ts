/**
 * Subscription detection from a batch of transactions
 * Detects recurring merchants, similar amounts, and subscription keywords
 */

import type { CategorisedRow } from "./categoriser";

export interface DetectedSubscription {
  name: string;
  vendor: string;
  category: string;
  amount: number;
  billingCycle: string;
  startDate: string;
  nextBillingDate: string;
  transactionCount: number;
  confidence: number;
}

export type RecurrenceType =
  | "software_subscription"
  | "service_subscription"
  | "membership"
  | "recurring_contractor"
  | "recurring_commission"
  | "recurring_income"
  | "loan_repayment"
  | "credit_card_repayment"
  | "transfer";

export interface DetectedRecurringGroup {
  vendor: string;
  recurrenceType: RecurrenceType;
  category: string;
  amount: number;
  billingCycle: string;
  transactionCount: number;
  confidence: number;
  transactionRowNumbers: number[];
  reason: string;
}

const SUBSCRIPTION_KEYWORDS = [
  "subscription", "monthly", "annual", "yearly", "recurring",
  "billing", "renewal", "plan", "membership", "saas",
  "stripe", "openai", "claude", "anthropic", "kimi",
  "notion", "slack", "figma", "github", "gitlab",
  "aws", "vercel", "heroku", "digitalocean",
  "google workspace", "microsoft 365", "office 365",
  "zoom", "loom", "calendly", "webflow",
  "hostinger", "namecheap", "cloudflare",
  "quickbooks", "xero", "freshbooks",
  "gusto", "deel", "remote",
];

const KNOWN_SAAS_VENDORS: Record<string, string> = {
  "openai": "OpenAI",
  "chatgpt": "OpenAI",
  "anthropic": "Anthropic",
  "claude": "Anthropic",
  "kimi": "Kimi",
  "notion": "Notion",
  "slack": "Slack",
  "figma": "Figma",
  "github": "GitHub",
  "gitlab": "GitLab",
  "aws": "AWS",
  "amazon web services": "AWS",
  "vercel": "Vercel",
  "heroku": "Heroku",
  "digitalocean": "DigitalOcean",
  "google workspace": "Google Workspace",
  "gmail": "Google Workspace",
  "microsoft 365": "Microsoft 365",
  "office 365": "Microsoft 365",
  "zoom": "Zoom",
  "loom": "Loom",
  "calendly": "Calendly",
  "webflow": "Webflow",
  "hostinger": "Hostinger",
  "namecheap": "Namecheap",
  "cloudflare": "Cloudflare",
  "quickbooks": "QuickBooks",
  "xero": "Xero",
  "freshbooks": "FreshBooks",
  "gusto": "Gusto",
  "deel": "Deel",
  "remote": "Remote",
  "stripe": "Stripe",
  "paypal": "PayPal",
};

function normaliseVendor(name: string): string {
  const lower = name.toLowerCase().trim();
  for (const [key, vendor] of Object.entries(KNOWN_SAAS_VENDORS)) {
    if (lower.includes(key)) return vendor;
  }
  return name;
}

function isLikelySubscription(row: CategorisedRow): boolean {
  const text = `${row.merchant} ${row.description}`.toLowerCase();
  return SUBSCRIPTION_KEYWORDS.some((kw) => text.includes(kw));
}

function amountSimilar(a: number, b: number): boolean {
  const diff = Math.abs(a - b);
  const avg = (a + b) / 2;
  return diff / avg < 0.15; // Within 15%
}

function billingCycleFromRows(rows: CategorisedRow[]): { cycle: string; confidence: number } {
  if (rows.length < 2) return { cycle: "unknown", confidence: 0 };
  const sorted = [...rows].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const gaps: number[] = [];
  for (let i = 1; i < sorted.length; i++) {
    const days = (new Date(sorted[i].date).getTime() - new Date(sorted[i - 1].date).getTime()) / (1000 * 60 * 60 * 24);
    if (Number.isFinite(days) && days > 0) gaps.push(days);
  }
  if (gaps.length === 0) return { cycle: "unknown", confidence: 0 };
  const avgGap = gaps.reduce((sum, gap) => sum + gap, 0) / gaps.length;
  if (avgGap >= 5 && avgGap <= 9) return { cycle: "weekly", confidence: 80 };
  if (avgGap >= 25 && avgGap <= 35) return { cycle: "monthly", confidence: 90 };
  if (avgGap >= 85 && avgGap <= 95) return { cycle: "quarterly", confidence: 85 };
  if (avgGap >= 350 && avgGap <= 380) return { cycle: "yearly", confidence: 85 };
  return { cycle: "irregular", confidence: 45 };
}

function classifyRecurrence(rows: CategorisedRow[]): { recurrenceType: RecurrenceType; reason: string } {
  const first = rows[0];
  const text = rows.map((row) => `${row.merchant} ${row.description} ${row.category}`.toLowerCase()).join(" ");
  const category = first.category;

  if (category === "Credit Card Payment" || rows.some((row) => Boolean((row as { isCreditCardRepayment?: boolean }).isCreditCardRepayment))) {
    return { recurrenceType: "credit_card_repayment", reason: "Recurring credit-card provider repayment pattern" };
  }
  if (category === "Transfers") {
    return { recurrenceType: "transfer", reason: "Recurring internal/account transfer pattern" };
  }
  if (text.includes("loan repayment") || text.includes("loan payment")) {
    return { recurrenceType: "loan_repayment", reason: "Recurring loan repayment wording" };
  }
  if (first.type === "income" && category === "Revenue") {
    return { recurrenceType: "recurring_income", reason: "Recurring income from the same counterparty" };
  }
  if (category === "Contractors") {
    return { recurrenceType: "recurring_contractor", reason: "Recurring contractor/vendor payment" };
  }
  if (category === "Sales Commission") {
    return { recurrenceType: "recurring_commission", reason: "Recurring commission payment" };
  }
  if (text.includes("membership")) {
    return { recurrenceType: "membership", reason: "Recurring membership wording" };
  }
  if (["Subscriptions", "Software", "AI Tools", "Cloud Infrastructure"].includes(category)) {
    return { recurrenceType: "software_subscription", reason: "Recurring software/cloud/tool payment" };
  }
  return { recurrenceType: "service_subscription", reason: "Recurring service payment pattern" };
}

export function detectRecurringGroups(rows: CategorisedRow[]): DetectedRecurringGroup[] {
  const vendorGroups = new Map<string, CategorisedRow[]>();

  for (const row of rows) {
    const vendor = normaliseVendor(row.merchant || row.description || "Unknown");
    if (!vendor || vendor === "Unknown") continue;
    const group = vendorGroups.get(vendor) || [];
    group.push(row);
    vendorGroups.set(vendor, group);
  }

  const recurringGroups: DetectedRecurringGroup[] = [];

  for (const [vendor, groupRows] of vendorGroups) {
    if (groupRows.length < 2) continue;

    const amounts = groupRows.map((row) => row.amount);
    const avgAmount = amounts.reduce((sum, amount) => sum + amount, 0) / amounts.length;
    const allSimilar = amounts.every((amount) => amountSimilar(amount, avgAmount));
    const cycle = billingCycleFromRows(groupRows);
    if (!allSimilar && cycle.confidence < 80) continue;
    if (cycle.cycle === "unknown") continue;

    const classification = classifyRecurrence(groupRows);
    const confidence = Math.min(95, cycle.confidence + Math.min(15, groupRows.length * 3));

    recurringGroups.push({
      vendor,
      recurrenceType: classification.recurrenceType,
      category: groupRows[0].category,
      amount: Math.round(avgAmount * 100) / 100,
      billingCycle: cycle.cycle,
      transactionCount: groupRows.length,
      confidence,
      transactionRowNumbers: groupRows.map((row) => row.rowNumber),
      reason: classification.reason,
    });
  }

  return recurringGroups.sort((a, b) => b.confidence - a.confidence);
}

export function detectSubscriptions(rows: CategorisedRow[]): DetectedSubscription[] {
  // Group by normalised vendor
  const vendorGroups = new Map<string, CategorisedRow[]>();

  for (const row of rows) {
    if (row.type !== "expense") continue;
    if (!isLikelySubscription(row) && row.category !== "Subscriptions" && row.category !== "Software" && row.category !== "AI Tools" && row.category !== "Cloud Infrastructure") {
      continue;
    }

    const vendor = normaliseVendor(row.merchant);
    const group = vendorGroups.get(vendor) || [];
    group.push(row);
    vendorGroups.set(vendor, group);
  }

  const subscriptions: DetectedSubscription[] = [];

  for (const [vendor, groupRows] of vendorGroups) {
    if (groupRows.length < 2) continue;

    // Sort by date
    groupRows.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // Check if amounts are similar
    const amounts = groupRows.map((r) => r.amount);
    const avgAmount = amounts.reduce((s, a) => s + a, 0) / amounts.length;
    const allSimilar = amounts.every((a) => amountSimilar(a, avgAmount));

    if (!allSimilar) continue;

    // Determine billing cycle from date gaps
    const gaps: number[] = [];
    for (let i = 1; i < groupRows.length; i++) {
      const days = (new Date(groupRows[i].date).getTime() - new Date(groupRows[i - 1].date).getTime()) / (1000 * 60 * 60 * 24);
      gaps.push(days);
    }
    const avgGap = gaps.reduce((s, g) => s + g, 0) / gaps.length;

    let billingCycle = "monthly";
    if (avgGap >= 25 && avgGap <= 35) billingCycle = "monthly";
    else if (avgGap >= 85 && avgGap <= 95) billingCycle = "quarterly";
    else if (avgGap >= 350 && avgGap <= 380) billingCycle = "yearly";
    else if (avgGap >= 5 && avgGap <= 9) billingCycle = "weekly";

    const lastDate = new Date(groupRows[groupRows.length - 1].date);
    const nextBilling = new Date(lastDate);
    if (billingCycle === "monthly") nextBilling.setMonth(nextBilling.getMonth() + 1);
    else if (billingCycle === "quarterly") nextBilling.setMonth(nextBilling.getMonth() + 3);
    else if (billingCycle === "yearly") nextBilling.setFullYear(nextBilling.getFullYear() + 1);
    else if (billingCycle === "weekly") nextBilling.setDate(nextBilling.getDate() + 7);

    const confidence = Math.min(95, 60 + groupRows.length * 10);

    subscriptions.push({
      name: `${vendor} Subscription`,
      vendor,
      category: groupRows[0].category,
      amount: Math.round(avgAmount * 100) / 100,
      billingCycle,
      startDate: groupRows[0].date,
      nextBillingDate: nextBilling.toISOString().slice(0, 10),
      transactionCount: groupRows.length,
      confidence,
    });
  }

  return subscriptions.sort((a, b) => b.amount - a.amount);
}

export function detectDuplicateTools(subscriptions: DetectedSubscription[]): Array<{ category: string; vendors: string[]; message: string }> {
  const categoryGroups = new Map<string, string[]>();

  for (const sub of subscriptions) {
    const group = categoryGroups.get(sub.category) || [];
    if (!group.includes(sub.vendor)) group.push(sub.vendor);
    categoryGroups.set(sub.category, group);
  }

  const duplicates: Array<{ category: string; vendors: string[]; message: string }> = [];

  for (const [category, vendors] of categoryGroups) {
    if (vendors.length > 1 && ["AI Tools", "Software", "Cloud Infrastructure", "Marketing Tools"].includes(category)) {
      duplicates.push({
        category,
        vendors,
        message: `You may have overlapping ${category.toLowerCase()}. Review ${vendors.join(", ")} for possible consolidation.`,
      });
    }
  }

  return duplicates;
}
