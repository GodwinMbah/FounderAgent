"use client";

import { useMemo } from "react";
import type { PreviewRow } from "@/lib/upload/wizard-types";
import type { PatternSuggestion, MatchType } from "./types";

// Categories that should NEVER be auto-applied — they indicate uncertainty
const NON_AUTO_APPLY_CATEGORIES = new Set([
  "Uncategorised Review",
  "Uncategorised",
  "Needs Review",
  "Ambiguous",
  "",
  undefined,
]);

// Known merchant → canonical name + category + confidence
const KNOWN_MERCHANT_PATTERNS: Record<
  string,
  { category: string; confidence: number; reason: string }
> = {
  eventsconnecter: {
    category: "Software",
    confidence: 75,
    reason: "Eventsconnecter is an event management platform — likely Software or Marketing tool",
  },
  highlevel: {
    category: "Software",
    confidence: 92,
    reason: "HighLevel (GoHighLevel) is a marketing automation and CRM platform",
  },
  "highlevel agency": {
    category: "Software",
    confidence: 92,
    reason: "HighLevel Agency subscription — marketing automation SaaS",
  },
  "gohighlevel": {
    category: "Software",
    confidence: 92,
    reason: "GoHighLevel is a marketing automation and CRM platform",
  },
  "apple.com": {
    category: "Software",
    confidence: 80,
    reason: "Apple — likely Software, Subscriptions, or Cloud Services depending on amount",
  },
  apple: {
    category: "Software",
    confidence: 75,
    reason: "Apple — likely Software, Subscriptions, Cloud Services, or Hardware",
  },
  klarna: {
    category: "Ambiguous",
    confidence: 55,
    reason:
      "Klarna is payment method context; use the underlying merchant when one is visible",
  },
  stripe: {
    category: "Revenue",
    confidence: 85,
    reason: "Stripe — if money is coming IN, this is likely a payout or revenue",
  },
  "capital on tap": {
    category: "Credit Card Payment",
    confidence: 90,
    reason: "Capital On Tap is a business credit card provider — payments are credit card repayments",
  },
  "capital one": {
    category: "Credit Card Payment",
    confidence: 90,
    reason: "Capital One is a credit card provider — payments are credit card repayments",
  },
  amex: {
    category: "Credit Card Payment",
    confidence: 90,
    reason: "American Express is a credit card provider — payments are credit card repayments",
  },
  "american express": {
    category: "Credit Card Payment",
    confidence: 90,
    reason: "American Express is a credit card provider — payments are credit card repayments",
  },
  barclaycard: {
    category: "Credit Card Payment",
    confidence: 90,
    reason: "Barclaycard is a credit card provider — payments are credit card repayments",
  },
  "marketing commission": {
    category: "Sales Commission",
    confidence: 86,
    reason: "Marketing commission payout — sales/marketing commission expense",
  },
  commission: {
    category: "Sales Commission",
    confidence: 70,
    reason: "Commission payment — likely sales commission or referral payout",
  },
  consultancy: {
    category: "Professional Services",
    confidence: 80,
    reason: "Consultancy fee — Professional Services or Contractor expense",
  },
  "director fee": {
    category: "Professional Services",
    confidence: 75,
    reason: "Director fee — could be Professional Services, Owner Drawings, or Payroll depending on direction",
  },
  canva: {
    category: "Software",
    confidence: 90,
    reason: "Canva is a creative/design SaaS tool",
  },
  "gamma.app": {
    category: "Software",
    confidence: 85,
    reason: "Gamma.app is presentation/design software",
  },
  "manus ai": {
    category: "AI Tools",
    confidence: 90,
    reason: "Manus AI is an AI tool",
  },
  remitly: {
    category: "International Transfer",
    confidence: 88,
    reason: "Remitly is an international money transfer service",
  },
  moneyway: {
    category: "Loan Repayment",
    confidence: 86,
    reason: "Moneyway is a loan/vehicle finance repayment context",
  },
  netflix: {
    category: "Subscriptions",
    confidence: 85,
    reason: "Netflix is a subscription merchant",
  },
  hostinger: {
    category: "Cloud Infrastructure",
    confidence: 88,
    reason: "Hostinger is web hosting/cloud infrastructure",
  },
  "internal transfer": {
    category: "Internal Transfer",
    confidence: 90,
    reason: "Internal Transfer is an account/currency movement, not operating revenue or spend",
  },
};

const PERSONAL_MERCHANT_COMPANY_TERMS = new Set([
  "ltd",
  "limited",
  "inc",
  "llc",
  "plc",
  "gmbh",
  "group",
  "app",
  "ai",
  "software",
  "solutions",
  "service",
  "services",
  "contact",
  "car",
  "wash",
  "travel",
  "food",
  "foods",
  "store",
  "stores",
  "internal",
  "transfer",
  "bank",
  "capital",
  "stripe",
  "paypal",
  "amazon",
  "meta",
  "facebook",
  "google",
  "canva",
  "revolut",
  "wise",
]);

function looksLikePersonalMerchant(merchant: string): boolean {
  const words = merchant
    .trim()
    .replace(/[.'’]/g, "")
    .split(/\s+/)
    .filter(Boolean);

  if (words.length < 2 || words.length > 4) return false;
  if (words.some((word) => /\d/.test(word))) return false;

  const lower = words.map((word) => word.toLowerCase());
  if (lower.some((word) => PERSONAL_MERCHANT_COMPANY_TERMS.has(word))) return false;

  return words.every((word) => /^[A-Z][a-zA-Z-]+$/.test(word));
}

function lookupKnownMerchant(merchant: string): { category: string; confidence: number; reason: string } | null {
  const key = merchant.toLowerCase().trim();
  // Exact match first
  if (KNOWN_MERCHANT_PATTERNS[key]) return KNOWN_MERCHANT_PATTERNS[key];
  // Partial match
  for (const [pattern, data] of Object.entries(KNOWN_MERCHANT_PATTERNS)) {
    if (key.includes(pattern) || pattern.includes(key)) {
      return data;
    }
  }
  return null;
}

function canAutoApply(s: PatternSuggestion): boolean {
  // Never auto-apply uncertain categories
  if (NON_AUTO_APPLY_CATEGORIES.has(s.suggestedCategory)) return false;
  // Need high category confidence AND sufficient rows
  if (s.categoryConfidence < 90) return false;
  if (s.affectedRowIds.length < 5) return false;
  return true;
}

export function buildPatternSuggestions(rows: PreviewRow[]): PatternSuggestion[] {
  const suggestions: PatternSuggestion[] = [];
  let nextId = 1;

  const groupBy = (keyFn: (r: PreviewRow) => string | null) => {
    const map = new Map<string, PreviewRow[]>();
    rows.forEach((r) => {
      const k = keyFn(r);
      if (!k) return;
      const list = map.get(k) ?? [];
      list.push(r);
      map.set(k, list);
    });
    return map;
  };

  const dominantCategory = (group: PreviewRow[]): string | null => {
    const counts = new Map<string, number>();
    group.forEach((r) => {
      counts.set(r.category, (counts.get(r.category) ?? 0) + 1);
    });
    let best: [string, number] | null = null;
    counts.forEach((count, cat) => {
      if (!best || count > best[1]) best = [cat, count];
    });
    if (!best) return null;
    return best[1] / group.length >= 0.8 ? best[0] : null;
  };

  const addSuggestion = (
    matchType: MatchType,
    matchValue: string,
    category: string,
    groupConfidence: number,
    categoryConfidence: number,
    reason: string,
    group: PreviewRow[],
    options?: { forcePending?: boolean }
  ) => {
    if (categoryConfidence < 50) return; // Hide very low confidence

    const rowIds = group.map((r) => r.rowNumber);
    const s: PatternSuggestion = {
      id: `suggestion-${nextId++}`,
      matchType,
      matchValue,
      suggestedCategory: category,
      groupConfidence,
      categoryConfidence,
      reason,
      affectedRowIds: rowIds,
      status: "pending",
    };

    // Only mark as auto-applied if it passes safety checks
    if (!options?.forcePending && canAutoApply(s)) {
      s.status = "applied";
    }

    suggestions.push(s);
  };

  // ── 1. Merchant exact match (highest priority) ──
  const merchantGroups = groupBy((r) => (r.merchant ? r.merchant.trim().toLowerCase() : null));
  merchantGroups.forEach((group, merchantKey) => {
    if (group.length < 2) return;

    const merchantName = group[0].merchant || merchantKey;
    const known = lookupKnownMerchant(merchantName);
    const dirConsistent =
      group.every((r) => r.type === "income") || group.every((r) => r.type === "expense");
    const dirBoost = dirConsistent ? 10 : 0;

    if (known) {
      // Use known merchant pattern with override for income direction
      let category = known.category;
      let catConf = Math.min(100, known.confidence + dirBoost);
      let reason = known.reason;

      // Stripe income should be Revenue, not Payment Processor Fees
      if (merchantKey.includes("stripe") && group.some((r) => r.type === "income")) {
        category = "Revenue";
        catConf = 90;
        reason = "Stripe payout incoming — treated as Revenue";
      }
      // Klarna + Amazon should be Shopping, not Payment Processor Fees
      if (merchantKey.includes("klarna") && group.some((r) => r.description?.toLowerCase().includes("amazon"))) {
        category = "Office Costs";
        catConf = 65;
        reason = "Klarna Amazon purchase — categorised based on underlying merchant (Amazon), not payment method";
      }

      addSuggestion("merchant", merchantName, category, 90 + dirBoost, catConf, reason, group);
      return;
    }

    // Fall back to dominant category from existing rows
    const cat = dominantCategory(group);
    if (cat && !NON_AUTO_APPLY_CATEGORIES.has(cat)) {
      const personalMerchant = looksLikePersonalMerchant(merchantName);
      if (personalMerchant && cat === "Revenue") return;
      const categoryConfidence = personalMerchant
        ? Math.min(79, 80 + dirBoost)
        : 80 + dirBoost;
      const reason = personalMerchant
        ? `${group.length} transactions use a personal-name counterparty. Review row references before applying ${cat} to all rows.`
        : `${group.length} transactions from same merchant with consistent category`;

      addSuggestion(
        "merchant",
        merchantName,
        cat,
        85 + dirBoost,
        categoryConfidence,
        reason,
        group,
        { forcePending: personalMerchant }
      );
    } else if (group.length >= 5) {
      // Enough rows but no clear category — flag as ambiguous
      addSuggestion(
        "merchant",
        merchantName,
        "Uncategorised Review",
        85 + dirBoost,
        40,
        `${group.length} transactions from '${merchantName}' but category is unclear. Review needed.`,
        group
      );
    }
  });

  // ── 2. Description keyword patterns ──
  const keywordPatterns: { keyword: string; category: string; confidence: number; reason: string }[] = [
    { keyword: "commission", category: "Sales Commission", confidence: 84, reason: "Commission payment detected" },
    { keyword: "consultancy", category: "Professional Services", confidence: 80, reason: "Consultancy fee detected" },
    { keyword: "director", category: "Professional Services", confidence: 65, reason: "Director-related payment — may be fee, salary, or drawing" },
    { keyword: "subscription", category: "Software", confidence: 75, reason: "Subscription payment detected" },
    { keyword: "agency sub", category: "Software", confidence: 80, reason: "Agency subscription detected" },
    { keyword: "top up", category: "Ambiguous", confidence: 55, reason: "Account top-up without processor context needs review" },
    { keyword: "payout", category: "Revenue", confidence: 75, reason: "Payout detected — likely revenue from processor" },
    { keyword: "refund", category: "Revenue Adjustment", confidence: 76, reason: "Refund/reversal detected" },
    { keyword: "interest", category: "Interest Charges", confidence: 85, reason: "Interest charge detected" },
    { keyword: "card fee", category: "Credit Card Fees", confidence: 85, reason: "Credit card fee detected" },
    { keyword: "atm", category: "Bank Fees", confidence: 60, reason: "ATM withdrawal — may need review" },
  ];

  keywordPatterns.forEach(({ keyword, category, confidence, reason }) => {
    const group = rows.filter(
      (r) =>
        r.description?.toLowerCase().includes(keyword) ||
        r.merchant?.toLowerCase().includes(keyword)
    );
    if (group.length < 2) return;

    const dirConsistent =
      group.every((r) => r.type === "income") || group.every((r) => r.type === "expense");
    const dirBoost = dirConsistent ? 10 : 0;

    // For "top up" from Stripe — should be Revenue, not Transfer
    let finalCategory = category;
    let finalConf = confidence;
    let finalReason = reason;
    if (keyword === "top up" && group.some((r) => r.description?.toLowerCase().includes("stripe"))) {
      finalCategory = "Revenue";
      finalConf = 80;
      finalReason = "Stripe top-up — treated as revenue payout";
    }

    addSuggestion("keyword", keyword, finalCategory, 70 + dirBoost, finalConf + dirBoost, finalReason, group);
  });

  const referenceSemanticCategory = (
    referenceText: string,
    group: PreviewRow[]
  ): { category: string; confidence: number; reason: string } | null => {
    const ref = referenceText.toLowerCase();
    const incomeOnly = group.every((r) => r.type === "income");
    const expenseOnly = group.every((r) => r.type === "expense");

    if (/\b(marketing|sales|affiliate|referral)?\s*(rep\s*)?commis+s?ion\b/.test(ref)) {
      if (incomeOnly) {
        return {
          category: "Revenue",
          confidence: 82,
          reason: "Incoming commission reference indicates commission income",
        };
      }
      return {
        category: "Sales Commission",
        confidence: 90,
        reason: "Commission reference with outgoing payments indicates sales/marketing commission expense",
      };
    }

    if (ref.includes("customer service")) {
      return {
        category: "Customer Service",
        confidence: 85,
        reason: "Reference describes customer service management",
      };
    }

    if (ref.includes("refund")) {
      return {
        category: expenseOnly ? "Revenue Adjustment" : "Refunds",
        confidence: 80,
        reason: expenseOnly
          ? "Outgoing refund reference indicates revenue adjustment"
          : "Incoming refund reference indicates refund/reversal",
      };
    }

    if (ref.includes("stripe") && incomeOnly) {
      return {
        category: "Revenue",
        confidence: 90,
        reason: "Stripe reference on incoming rows indicates processor payout revenue",
      };
    }

    return null;
  };

  // ── 3. Reference prefix patterns ──
  const refGroups = groupBy((r) => {
    const ref = r.rawData["reference"] || r.rawData["Reference"] || r.rawData["ref"] || "";
    if (!ref) return null;
    const prefix = ref.trim().split(/[\d\-_]/)[0]?.toUpperCase();
    return prefix && prefix.length >= 2 ? prefix : null;
  });
  refGroups.forEach((group, prefix) => {
    if (group.length < 3) return;
    const cat = dominantCategory(group);
    const semantic = referenceSemanticCategory(prefix, group);
    if (!cat && !semantic) return;
    const dirConsistent =
      group.every((r) => r.type === "income") || group.every((r) => r.type === "expense");
    const dirBoost = dirConsistent ? 10 : 0;
    const category = semantic?.category ?? cat;
    if (!category) return;
    if (category === "Revenue" && !group.every((r) => r.type === "income")) return;

    addSuggestion(
      "reference",
      prefix,
      category,
      75 + dirBoost,
      semantic?.confidence ?? 70 + dirBoost,
      semantic?.reason ?? `${group.length} transactions with similar reference prefix '${prefix}'`,
      group
    );
  });

  // ── 4. Known processor patterns (direction-aware) ──
  const processorPatterns: { name: string; incomeCategory: string; expenseCategory: string; confidence: number }[] = [
    { name: "stripe", incomeCategory: "Revenue", expenseCategory: "Payment Processor Fees", confidence: 90 },
    { name: "paypal", incomeCategory: "Revenue", expenseCategory: "Payment Processor Fees", confidence: 85 },
    { name: "square", incomeCategory: "Revenue", expenseCategory: "Payment Processor Fees", confidence: 85 },
    { name: "shopify", incomeCategory: "Revenue", expenseCategory: "Software", confidence: 85 },
    { name: "gocardless", incomeCategory: "Revenue", expenseCategory: "Bank Fees", confidence: 80 },
  ];

  processorPatterns.forEach(({ name, incomeCategory, expenseCategory, confidence }) => {
    const group = rows.filter(
      (r) =>
        r.merchant?.toLowerCase().includes(name) ||
        r.description?.toLowerCase().includes(name)
    );
    if (group.length < 2) return;

    const incomeRows = group.filter((r) => r.type === "income");
    const expenseRows = group.filter((r) => r.type === "expense");

    if (incomeRows.length > 0) {
      addSuggestion(
        "processor",
        `${name} (income)`,
        incomeCategory,
        85,
        confidence,
        `${incomeRows.length} incoming ${name} transactions — likely payouts/revenue`,
        incomeRows
      );
    }
    if (expenseRows.length > 0) {
      addSuggestion(
        "processor",
        `${name} (expense)`,
        expenseCategory,
        85,
        confidence - 5,
        `${expenseRows.length} outgoing ${name} transactions — likely fees or payments`,
        expenseRows
      );
    }
  });

  // Deduplicate by affectedRowIds + suggestedCategory (keep highest categoryConfidence)
  const deduped = new Map<string, PatternSuggestion>();
  suggestions.forEach((s) => {
    const key = `${s.suggestedCategory}::${[...s.affectedRowIds].sort((a, b) => a - b).join(",")}`;
    const existing = deduped.get(key);
    if (!existing || s.categoryConfidence > existing.categoryConfidence) {
      deduped.set(key, s);
    }
  });

  return Array.from(deduped.values()).sort((a, b) => b.categoryConfidence - a.categoryConfidence);
}

interface UsePatternSuggestionsResult {
  suggestions: PatternSuggestion[];
  pendingSuggestions: PatternSuggestion[];
  autoAppliedSuggestions: PatternSuggestion[];
  totalPending: number;
}

export function usePatternSuggestions(previewRows: PreviewRow[]): UsePatternSuggestionsResult {
  const suggestions = useMemo(() => buildPatternSuggestions(previewRows), [previewRows]);

  const pendingSuggestions = suggestions.filter((s) => s.status === "pending");
  const autoAppliedSuggestions = suggestions.filter((s) => s.status === "applied");

  return {
    suggestions,
    pendingSuggestions,
    autoAppliedSuggestions,
    totalPending: pendingSuggestions.length,
  };
}
