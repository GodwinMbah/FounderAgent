/**
 * Enhanced categorisation engine v2
 * Uses merchant matching, keyword patterns, MCC codes, and amount heuristics.
 */

import { getProviderInfo } from "@/lib/providers/registry";

export interface CategorySuggestion {
  category: string;
  confidence: number; // 0-100
  reason: string;
  status: "categorised" | "ai_suggested" | "needs_review" | "possible_subscription";
}

interface UserRule {
  pattern: string;
  category: string;
  priority: number;
}

interface SuggestCategoryOptions {
  userRules?: UserRule[];
  historicalAvg?: number;
  historicalMax?: number;
}

interface TransactionInput {
  merchantName: string;
  description: string;
  amount: number;
  type: "income" | "expense";
  transactionType?: string;
  merchantCategoryCode?: string;
  isTransfer?: boolean;
  isFee?: boolean;
}

// ─── Keyword pattern groups ───────────────────────────────────────────

const PATTERN_GROUPS: Array<{ keywords: string[]; category: string }> = [
  {
    keywords: ["stripe", "paypal", "payout", "sales", "revenue", "refund"],
    category: "Revenue",
  },
  {
    keywords: [
      "google ads",
      "meta",
      "facebook",
      "instagram",
      "advertising",
      "marketing",
    ],
    category: "Advertising",
  },
  {
    keywords: [
      "slack",
      "notion",
      "figma",
      "zoom",
      "microsoft",
      "google workspace",
    ],
    category: "Software",
  },
  {
    keywords: ["openai", "anthropic", "claude", "chatgpt", "kimi"],
    category: "AI Tools",
  },
  {
    keywords: ["aws", "vercel", "cloudflare", "digitalocean", "heroku"],
    category: "Cloud Infrastructure",
  },
  {
    keywords: [
      "stripe fee",
      "paypal fee",
      "transaction fee",
      "processing fee",
    ],
    category: "Payment Processor Fees",
  },
  {
    keywords: ["hmrc", "tax", "vat", "irs"],
    category: "Tax",
  },
  {
    keywords: ["bank fee", "overdraft", "service charge"],
    category: "Bank Fees",
  },
  {
    keywords: [
      "airbnb",
      "hotel",
      "flight",
      "uber",
      "train",
      "booking.com",
    ],
    category: "Travel",
  },
  {
    keywords: ["amazon", "stationery", "office", "printer"],
    category: "Office Costs",
  },
  {
    keywords: ["accountant", "legal", "consultant", "advisor"],
    category: "Professional Services",
  },
  {
    keywords: ["salary", "payroll", "wage", "pension"],
    category: "Payroll",
  },
  {
    keywords: ["freelancer", "contractor", "upwork", "fiverr"],
    category: "Contractors",
  },
  {
    keywords: ["subscription", "recurring", "monthly", "annual"],
    category: "Subscriptions",
  },
  {
    keywords: ["equipment", "hardware", "laptop", "monitor"],
    category: "Office Costs",
  },
];

// ─── MCC fallback mapping ─────────────────────────────────────────────

const MCC_MAP: Record<string, string> = {
  "5411": "Office Costs",
  "5732": "Software",
  "5812": "Software",
  "4111": "Travel",
  "7011": "Travel",
};

// ─── Helpers ──────────────────────────────────────────────────────────

function normalise(text: string): string {
  return text.toLowerCase().trim();
}

function buildSearchText(tx: TransactionInput): string {
  return `${normalise(tx.merchantName)} ${normalise(tx.description)}`;
}

function mapConfidenceToStatus(
  confidence: number,
  category?: string
): CategorySuggestion["status"] {
  if (category === "Subscriptions" && confidence >= 75 && confidence < 90) {
    return "possible_subscription";
  }
  if (confidence >= 90) return "categorised";
  if (confidence >= 75) return "ai_suggested";
  return "needs_review";
}

function resolveFeeCategory(tx: TransactionInput): string {
  const text = buildSearchText(tx);
  const processorKeywords = [
    "stripe",
    "paypal",
    "square",
    "klarna",
    "processing",
    "transaction",
  ];
  if (processorKeywords.some((k) => text.includes(k))) {
    return "Payment Processor Fees";
  }
  return "Bank Fees";
}

// ─── Core suggestion engine ───────────────────────────────────────────

export function suggestCategory(
  transaction: TransactionInput,
  options?: SuggestCategoryOptions
): CategorySuggestion {
  const text = buildSearchText(transaction);
  const absAmount = Math.abs(transaction.amount);

  // 1. Transfer override
  if (transaction.isTransfer) {
    return {
      category: "Transfers",
      confidence: 100,
      reason: "Explicit transfer flag",
      status: "categorised",
    };
  }

  // 2. Fee override
  if (transaction.isFee) {
    const category = resolveFeeCategory(transaction);
    return {
      category,
      confidence: 100,
      reason: "Explicit fee flag",
      status: "categorised",
    };
  }

  // 3. User rules (highest priority wins)
  if (options?.userRules && options.userRules.length > 0) {
    const sortedRules = [...options.userRules].sort(
      (a, b) => b.priority - a.priority
    );
    for (const rule of sortedRules) {
      const pattern = normalise(rule.pattern);
      if (text.includes(pattern)) {
        return {
          category: rule.category,
          confidence: 90,
          reason: `Matched user rule: "${rule.pattern}"`,
          status: mapConfidenceToStatus(90, rule.category),
        };
      }
    }
  }

  // 4. Merchant exact match via registry
  const provider = getProviderInfo(transaction.merchantName);
  if (provider?.categoryHint) {
    return {
      category: provider.categoryHint,
      confidence: 95,
      reason: `Known merchant: ${provider.displayName}`,
      status: mapConfidenceToStatus(95, provider.categoryHint),
    };
  }

  // 5. Pattern / keyword match
  for (const group of PATTERN_GROUPS) {
    for (const keyword of group.keywords) {
      if (text.includes(keyword)) {
        return {
          category: group.category,
          confidence: 75,
          reason: `Keyword match: "${keyword}"`,
          status: mapConfidenceToStatus(75, group.category),
        };
      }
    }
  }

  // 6. MCC fallback
  if (transaction.merchantCategoryCode) {
    const mcc = transaction.merchantCategoryCode.trim();
    const mapped = MCC_MAP[mcc];
    if (mapped) {
      return {
        category: mapped,
        confidence: 60,
        reason: `MCC code ${mcc}`,
        status: mapConfidenceToStatus(60, mapped),
      };
    }
  }

  // 7. Amount heuristic
  if (
    options?.historicalAvg !== undefined &&
    options.historicalAvg > 0 &&
    absAmount > options.historicalAvg * 10
  ) {
    return {
      category: "Uncategorised Review",
      confidence: 50,
      reason: "Unusually large amount",
      status: "needs_review",
    };
  }

  // 8. Unknown fallback
  return {
    category: "Uncategorised Review",
    confidence: 0,
    reason: "No matching heuristics",
    status: "needs_review",
  };
}

// ─── Batch canonical categorisation ───────────────────────────────────

export function categoriseCanonicalRows(
  rows: TransactionInput[]
): Array<{
  merchantName: string;
  description: string;
  amount: number;
  type: "income" | "expense";
  category: string;
  confidenceScore: number;
  status: string;
  parseErrors: string[];
  rawData: Record<string, string>;
}> {
  return rows.map((row) => {
    const suggestion = suggestCategory(row);
    return {
      merchantName: row.merchantName,
      description: row.description,
      amount: row.amount,
      type: row.type,
      category: suggestion.category,
      confidenceScore: suggestion.confidence,
      status: suggestion.status,
      parseErrors: [],
      rawData: {},
    };
  });
}
