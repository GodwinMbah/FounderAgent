/**
 * Smart Categorisation Engine
 * Analyzes transactions and suggests categories with confidence scores
 */

import {
  Transaction,
  SmartCategorisationSuggestion,
  TransactionCategoryType,
  TransactionStatus,
} from "./types";

// Define merchant patterns and keywords for categorisation
interface MerchantPattern {
  keywords: string[];
  category: TransactionCategoryType;
  confidence: number; // 0-100
  action?: string;
}

interface UserCategoryRule {
  id: string;
  name: string;
  suggestedCategory: TransactionCategoryType;
  priority: number;
  condition: {
    field: string;
    operator: string;
    value: string;
    caseSensitive?: boolean;
  };
}

const MERCHANT_PATTERNS: MerchantPattern[] = [
  // Revenue
  {
    keywords: ["stripe", "payout"],
    category: "Revenue",
    confidence: 95,
  },
  {
    keywords: ["paypal", "transfer"],
    category: "Revenue",
    confidence: 80,
  },
  {
    keywords: ["invoiced", "invoice paid"],
    category: "Revenue",
    confidence: 90,
  },

  // Advertising & Marketing
  {
    keywords: ["meta", "facebook", "ads"],
    category: "Advertising",
    confidence: 95,
  },
  {
    keywords: ["google ads", "adwords"],
    category: "Advertising",
    confidence: 95,
  },
  {
    keywords: ["tiktok"],
    category: "Advertising",
    confidence: 85,
  },
  {
    keywords: ["linkedin ads"],
    category: "Advertising",
    confidence: 90,
  },

  // Software & Tools
  {
    keywords: ["google workspace", "gmail"],
    category: "Software",
    confidence: 95,
  },
  {
    keywords: ["slack"],
    category: "Software",
    confidence: 95,
  },
  {
    keywords: ["notion"],
    category: "Software",
    confidence: 95,
  },
  {
    keywords: ["figma"],
    category: "Software",
    confidence: 95,
  },
  {
    keywords: ["zapier"],
    category: "Software",
    confidence: 90,
  },
  {
    keywords: ["airtable"],
    category: "Software",
    confidence: 90,
  },
  {
    keywords: ["microsoft 365", "office 365"],
    category: "Software",
    confidence: 95,
  },

  // AI Tools
  {
    keywords: ["openai", "chatgpt"],
    category: "AI Tools",
    confidence: 95,
  },
  {
    keywords: ["claude", "anthropic"],
    category: "AI Tools",
    confidence: 95,
  },
  {
    keywords: ["kimi"],
    category: "AI Tools",
    confidence: 90,
  },
  {
    keywords: ["gemini", "bard"],
    category: "AI Tools",
    confidence: 90,
  },

  // Cloud Infrastructure
  {
    keywords: ["aws", "amazon web services"],
    category: "Cloud Infrastructure",
    confidence: 95,
  },
  {
    keywords: ["vercel"],
    category: "Cloud Infrastructure",
    confidence: 90,
  },
  {
    keywords: ["heroku"],
    category: "Cloud Infrastructure",
    confidence: 90,
  },
  {
    keywords: ["digitalocean", "do.com"],
    category: "Cloud Infrastructure",
    confidence: 90,
  },
  {
    keywords: ["firebase"],
    category: "Cloud Infrastructure",
    confidence: 85,
  },

  // Payment Processor Fees
  {
    keywords: ["stripe fee", "stripe charge"],
    category: "Payment Processor Fees",
    confidence: 95,
  },
  {
    keywords: ["paypal fee"],
    category: "Payment Processor Fees",
    confidence: 95,
  },
  {
    keywords: ["square", "sq."],
    category: "Payment Processor Fees",
    confidence: 85,
  },

  // Bank & Financial
  {
    keywords: ["hmrc", "tax"],
    category: "Tax",
    confidence: 85,
  },
  {
    keywords: ["bank fee", "monthly fee", "overdraft"],
    category: "Bank Fees",
    confidence: 85,
  },

  // Subscriptions (helper patterns)
  {
    keywords: ["subscription", "monthly subscription"],
    category: "Subscriptions",
    confidence: 70,
  },

  // Travel & Accommodation
  {
    keywords: ["hotel", "airbnb", "booking"],
    category: "Travel",
    confidence: 85,
  },
  {
    keywords: ["airline", "flight", "uber", "lyft", "taxi"],
    category: "Travel",
    confidence: 85,
  },

  // Office & Equipment
  {
    keywords: ["office depot", "staples"],
    category: "Office Costs",
    confidence: 90,
  },

  // Professional Services
  {
    keywords: ["lawyer", "accountant", "consultant"],
    category: "Professional Services",
    confidence: 85,
  },

  // Payroll (usually by name)
  {
    keywords: ["salary", "payroll", "wages"],
    category: "Payroll",
    confidence: 90,
  },

  // Contractors
  {
    keywords: ["freelancer", "contractor"],
    category: "Contractors",
    confidence: 85,
  },

  // Additional merchant patterns
  { keywords: ["highlevel"], category: "Software", confidence: 90 },
  { keywords: ["gohighlevel"], category: "Software", confidence: 90 },
  { keywords: ["zoom"], category: "Software", confidence: 95 },
  { keywords: ["cloudflare"], category: "Cloud Infrastructure", confidence: 90 },
  { keywords: ["instagram"], category: "Advertising", confidence: 90 },
  { keywords: ["amazon"], category: "Office Costs", confidence: 60, action: "review" },
  { keywords: ["airbnb"], category: "Travel", confidence: 60, action: "review" },
  { keywords: ["capital on tap"], category: "Credit Card Payment", confidence: 85 },
  { keywords: ["capital one"], category: "Credit Card Payment", confidence: 85 },
  { keywords: ["amex", "american express"], category: "Credit Card Payment", confidence: 85 },
  { keywords: ["barclaycard"], category: "Credit Card Payment", confidence: 85 },
  { keywords: ["lloyds card"], category: "Credit Card Payment", confidence: 85 },
  { keywords: ["tide credit"], category: "Credit Card Payment", confidence: 85 },
  { keywords: ["credit card fee", "card fee", "annual fee"], category: "Credit Card Fees", confidence: 85 },
  { keywords: ["interest charge", "card interest"], category: "Interest Charges", confidence: 85 },
  { keywords: ["klarna amazon"], category: "Office Costs", confidence: 70, action: "review" },
];

function suggestCategoryFromMcc(mcc: string): { category: TransactionCategoryType; confidence: number } | null {
  const map: Record<string, TransactionCategoryType> = {
    "5411": "Office Costs", "5812": "Travel", "5813": "Travel", "5814": "Travel",
    "7011": "Travel", "4111": "Travel", "4121": "Travel",
    "7372": "Software", "7375": "Software", "7392": "Professional Services",
    "5942": "Office Costs", "5999": "Office Costs", "7299": "Office Costs",
  };
  const cat = map[mcc];
  return cat ? { category: cat, confidence: 65 } : null;
}

/**
 * Analyze transaction merchant and description for categorisation
 * Returns a suggestion with confidence score
 */
export function suggestTransactionCategory(
  transaction: Transaction,
  userRules?: UserCategoryRule[]
): SmartCategorisationSuggestion {
  const text = `${transaction.merchant || ""} ${transaction.description}`.toLowerCase();
  const amount = transaction.amount;
  const type = transaction.type;

  // Step 1: Check user-defined rules (highest priority)
  if (userRules && userRules.length > 0) {
    for (const rule of userRules.sort((a, b) => b.priority - a.priority)) {
      if (ruleMatches(text, amount, rule)) {
        return {
          transactionId: transaction.id,
          suggestedCategory: rule.suggestedCategory,
          confidenceScore: 90,
          reason: `Matched custom rule: "${rule.name}"`,
          status: "AI Suggested",
          ruleApplied: rule.id,
          recommendedAction: "auto_categorise",
        };
      }
    }
  }

  // Step 2: Check merchant patterns
  let bestMatch: (MerchantPattern & { matchedKeywords: string[] }) | null =
    null;
  let bestMatchScore = 0;

  for (const pattern of MERCHANT_PATTERNS) {
    for (const keyword of pattern.keywords) {
      if (text.includes(keyword)) {
        const adjustedConfidence =
          pattern.confidence * getConfidenceMultiplier(type, pattern.category);
        if (adjustedConfidence > bestMatchScore) {
          bestMatch = { ...pattern, matchedKeywords: [keyword] };
          bestMatchScore = adjustedConfidence;
        }
      }
    }
  }

  // Step 3: Return suggestion or flag for review
  if (bestMatch && bestMatchScore >= 70) {
    const status = getTransactionStatus(bestMatchScore);
    return {
      transactionId: transaction.id,
      suggestedCategory: bestMatch.category,
      confidenceScore: Math.min(bestMatchScore, 100),
      reason: `Pattern matched: "${bestMatch.matchedKeywords[0]}"`,
      status,
      recommendedAction: bestMatchScore >= 85 ? "auto_categorise" : "review",
    };
  }

  // Step 3b: MCC fallback
  if (bestMatchScore < 70 && transaction.metadata?.mcc) {
    const mccResult = suggestCategoryFromMcc(String(transaction.metadata.mcc));
    if (mccResult && mccResult.confidence >= 60) {
      return {
        transactionId: transaction.id,
        suggestedCategory: mccResult.category,
        confidenceScore: mccResult.confidence,
        reason: `MCC fallback: ${transaction.metadata.mcc}`,
        status: "AI Suggested",
        recommendedAction: "review",
      };
    }
  }

  // Step 4: Check for subscription patterns
  if (isLikelySubscription(transaction)) {
    return {
      transactionId: transaction.id,
      suggestedCategory: "Subscriptions",
      confidenceScore: 60,
      reason: "Recurring pattern detected - likely subscription",
      status: "Possible Subscription",
      recommendedAction: "review",
    };
  }

  // Step 5: Flag as uncategorised - needs review
  return {
    transactionId: transaction.id,
    suggestedCategory: "Uncategorised Review",
    confidenceScore: 0,
    reason: "No matching patterns found",
    status: "Needs Review",
    recommendedAction: "flag",
  };
}

/**
 * Check if a user rule matches the transaction
 */
function ruleMatches(text: string, amount: number, rule: UserCategoryRule): boolean {
  const { condition } = rule;

  switch (condition.field) {
    case "merchant":
    case "description":
      const fieldText = text;
      switch (condition.operator) {
        case "contains":
          return fieldText.includes(
            condition.caseSensitive
              ? condition.value
              : condition.value.toLowerCase()
          );
        case "equals":
          return fieldText === condition.value.toLowerCase();
        case "starts_with":
          return fieldText.startsWith(condition.value.toLowerCase());
        default:
          return false;
      }

    case "amount_range":
      if (
        condition.operator === "between" &&
        Array.isArray(condition.value)
      ) {
        return amount >= condition.value[0] && amount <= condition.value[1];
      }
      return false;

    default:
      return false;
  }
}

/**
 * Adjust confidence based on transaction type
 * Revenue transactions with revenue patterns are highly confident
 */
function getConfidenceMultiplier(
  type: string,
  category: TransactionCategoryType
): number {
  if (type === "income" && category === "Revenue") {
    return 1.1; // Boost confidence for income revenue patterns
  }
  if (type === "expense" && category === "Revenue") {
    return 0.3; // Reduce confidence if income pattern on expense
  }
  return 1.0;
}

/**
 * Determine transaction status based on confidence
 */
function getTransactionStatus(confidence: number): TransactionStatus {
  if (confidence >= 90) return "Categorised";
  if (confidence >= 75) return "AI Suggested";
  if (confidence >= 60) return "Needs Review";
  return "Needs Review";
}

/**
 * Check if transaction is likely a recurring subscription
 * (This is simplified - real version would check historical data)
 */
function isLikelySubscription(transaction: Transaction): boolean {
  const text = `${transaction.merchant || ""} ${transaction.description}`.toLowerCase();

  // Keywords indicating subscriptions
  const subscriptionKeywords = [
    "monthly",
    "subscription",
    "recurring",
    "billing",
    "renewal",
    "membership",
  ];

  return subscriptionKeywords.some((keyword) => text.includes(keyword));
}

/**
 * Check for likely duplicate transactions
 * Simplified version - real version would use more sophisticated matching
 */
export function checkForDuplicates(
  transaction: Transaction,
  previousTransactions: Transaction[]
): {
  isDuplicate: boolean;
  similarTransactionIds: string[];
  confidence: number;
} {
  const duplicates: string[] = [];
  const dateThreshold = 2; // days

  for (const prev of previousTransactions) {
    // Similar amount
    if (Math.abs(prev.amount - transaction.amount) < 0.01) {
      // Same merchant
      if (
        prev.merchant &&
        transaction.merchant &&
        prev.merchant.toLowerCase() === transaction.merchant.toLowerCase()
      ) {
        // Similar date (within 2 days)
        const daysDiff = Math.abs(
          (new Date(prev.date).getTime() - new Date(transaction.date).getTime()) /
          (1000 * 60 * 60 * 24)
        );
        if (daysDiff <= dateThreshold) {
          duplicates.push(prev.id);
        }
      }
    }
  }

  return {
    isDuplicate: duplicates.length > 0,
    similarTransactionIds: duplicates,
    confidence: duplicates.length > 0 ? 85 : 0,
  };
}

/**
 * Detect unusual or spike transactions
 */
export function detectUnusualTransaction(
  transaction: Transaction,
  historicalAverages?: {
    averageAmount: number;
    maxAmount: number;
    categoryAverages: Record<string, number>;
  }
): {
  isUnusual: boolean;
  reason: string;
  severity: "low" | "medium" | "high";
} {
  if (!historicalAverages) {
    return { isUnusual: false, reason: "No historical data", severity: "low" };
  }

  const { averageAmount, maxAmount } = historicalAverages;

  // Check if amount is significantly higher than historical average
  if (transaction.amount > averageAmount * 2) {
    return {
      isUnusual: true,
      reason: `Transaction amount (${transaction.amount}) is 2x higher than average`,
      severity: transaction.amount > averageAmount * 5 ? "high" : "medium",
    };
  }

  // Check if amount exceeds historical maximum
  if (transaction.amount > maxAmount * 1.5) {
    return {
      isUnusual: true,
      reason: "Transaction amount exceeds historical maximum by 50%",
      severity: "high",
    };
  }

  return { isUnusual: false, reason: "Transaction appears normal", severity: "low" };
}

/**
 * Calculate confidence score for a category based on multiple factors
 */
export function calculateCategoryConfidence(
  transaction: Transaction,
  patterns: MerchantPattern[],
  userConfirmed?: boolean
): number {
  if (userConfirmed) {
    return 100; // User confirmed = 100% confidence
  }

  // Base score from pattern matching
  let score = 0;
  const text = `${transaction.merchant || ""} ${transaction.description}`.toLowerCase();

  for (const pattern of patterns) {
    for (const keyword of pattern.keywords) {
      if (text.includes(keyword)) {
        score = Math.max(score, pattern.confidence);
      }
    }
  }

  // Boost for income transactions
  if (transaction.type === "income") {
    score = Math.min(100, score * 1.1);
  }

  return Math.round(score);
}
