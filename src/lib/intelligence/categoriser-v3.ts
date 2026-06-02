/**
 * Categoriser v3 — Smart Categorisation Engine
 *
 * Multi-layer approach:
 *   1. User rules (highest priority)
 *   2. Reference-based patterns (Stripe, AWS, HMRC, etc.)
 *   3. Keyword fallback patterns
 *   4. Personal name detection
 *   5. Business model confidence boosts
 */

import { detectPersonalName } from "./personal-name-detector";

// ─── Types ────────────────────────────────────────────────────────────

export type MatchSource = "reference" | "keyword" | "userRule" | "nameDetection";

export interface V3Transaction {
  id?: string;
  amount: number;
  type: "income" | "expense";
  description?: string;
  merchant?: string;
  reference?: string;
}

export interface V3Context {
  businessModel: string;
  revenueModels: string[];
  costStructure: string[];
  userRules: Array<{
    merchantPattern?: string;
    descriptionPattern?: string;
    referencePattern?: string;
    provider?: string;
    direction?: "income" | "expense";
    category: string;
    confidenceBoost: number;
  }>;
}

export interface V3CategoryResult {
  category: string;
  confidence: number;
  status: "categorised" | "ai_suggested" | "needs_review";
  reason: string;
}

interface ScoredMatch {
  category: string;
  confidence: number;
  source: MatchSource;
  reason: string;
}

interface RefPattern {
  keywords: string[];
  category: string;
  baseConfidence: number;
  amountCondition?: "positive" | "negative";
  requiresCostStructure?: string;
}

// ─── Reference patterns (strong signal) ───────────────────────────────

const REFERENCE_PATTERNS: RefPattern[] = [
  {
    keywords: ["stripe", "paypal", "square", "gocardless", "sumup", "worldpay"],
    category: "Revenue",
    baseConfidence: 95,
    amountCondition: "positive",
  },
  {
    keywords: ["stripe", "paypal", "square", "gocardless", "sumup", "worldpay"],
    category: "Payment Processor Fees",
    baseConfidence: 95,
    amountCondition: "negative",
  },
  {
    keywords: ["shopify", "woocommerce", "bigcommerce", "magento", "prestashop", "etsy", "ebay"],
    category: "Revenue",
    baseConfidence: 95,
    amountCondition: "positive",
  },
  {
    keywords: ["aws", "vercel", "cloudflare", "gcp", "google cloud", "azure", "heroku", "digitalocean", "linode", "akamai", "fastly"],
    category: "Cloud Infrastructure",
    baseConfidence: 95,
  },
  {
    keywords: ["openai", "anthropic", "claude", "kimi", "perplexity", "groq", "replicate", "huggingface", "cohere", "ai"],
    category: "AI Tools",
    baseConfidence: 95,
  },
  {
    keywords: ["meta", "google ads", "facebook ads", "instagram ads", "linkedin ads", "twitter ads", "x ads", "tiktok ads", "snapchat ads", "pinterest ads"],
    category: "Advertising",
    baseConfidence: 95,
  },
  {
    keywords: ["mailchimp", "klaviyo", "hubspot", "salesforce", "marketo", "activecampaign", "convertkit", "beehiiv", "substack"],
    category: "Marketing",
    baseConfidence: 85,
  },
  {
    keywords: ["hmrc", "irs", "tax", "vat", "corporation tax", "income tax"],
    category: "Tax",
    baseConfidence: 90,
  },
  {
    keywords: ["payroll", "salary", "pension", "workplace pension", "auto-enrolment"],
    category: "Payroll",
    baseConfidence: 90,
  },
  {
    keywords: ["contractor", "freelancer", "upwork", "fiverr", "toptal", "peopleperhour", "guru"],
    category: "Contractors",
    baseConfidence: 85,
  },
  {
    keywords: ["uber eats", "deliveroo", "just eat", "foodpanda", "grubhub", "doordash"],
    category: "Food and Meals",
    baseConfidence: 80,
  },
  {
    keywords: ["uber trip", "uber ride", "lyft", "bolt", "grab", "taxi", "cab"],
    category: "Travel",
    baseConfidence: 80,
  },
  {
    keywords: ["airbnb", "booking.com", "hotel", "hostel", "marriott", "hilton", "expedia"],
    category: "Accommodation",
    baseConfidence: 80,
  },
  {
    keywords: ["british airways", "easyjet", "ryanair", "virgin atlantic", "lufthansa", "air france", "delta", "united"],
    category: "Travel",
    baseConfidence: 80,
  },
  {
    keywords: ["trainline", "national rail", "amtrak", "eurostar", "rail"],
    category: "Travel",
    baseConfidence: 80,
  },
  {
    keywords: ["bank charge", "overdraft", "monthly fee", "account fee", "service charge", "standing charge"],
    category: "Bank Fees",
    baseConfidence: 85,
  },
  {
    keywords: ["capital on tap", "capital one", "amex", "barclaycard", "lloyds card", "tide credit", "revolut card repayment"],
    category: "Credit Card Payment",
    baseConfidence: 90,
    amountCondition: "negative",
  },
  {
    keywords: ["credit card fee", "card fee", "annual fee"],
    category: "Credit Card Fees",
    baseConfidence: 85,
  },
  {
    keywords: ["interest charge", "card interest"],
    category: "Interest Charges",
    baseConfidence: 85,
  },
  {
    keywords: ["fedex", "ups", "dhl", "royal mail", "usps", "parcel force", "hermes", "evri"],
    category: "Shipping and Fulfilment",
    baseConfidence: 85,
    requiresCostStructure: "shipping",
  },
  {
    keywords: ["inventory", "supplier", "wholesale", "stock", "raw material", "manufacturing"],
    category: "COGS",
    baseConfidence: 85,
    requiresCostStructure: "cogs",
  },
  {
    keywords: ["notion", "figma", "slack", "zoom", "loom", "calendly", "typeform", "airtable"],
    category: "Software",
    baseConfidence: 85,
  },
  {
    keywords: ["highlevel", "gohighlevel", "high level", "agency sub"],
    category: "Software",
    baseConfidence: 92,
  },
  {
    keywords: ["apple.com", "apple store", "apple inc", "apple services"],
    category: "Software",
    baseConfidence: 80,
  },
  {
    keywords: ["eventsconnecter", "events connector", "event connect"],
    category: "Software",
    baseConfidence: 75,
  },
  {
    keywords: ["marketing commission", "sales commission", "commission payout", "commission payment"],
    category: "Sales and Marketing",
    baseConfidence: 80,
  },
  {
    keywords: ["director consultancy", "director fee", "consultancy fee", "consulting fee"],
    category: "Professional Services",
    baseConfidence: 75,
  },
  {
    keywords: ["stripe top up", "stripe payout", "stripe revenue", "stripe transfer"],
    category: "Revenue",
    baseConfidence: 90,
    amountCondition: "positive",
  },
  {
    keywords: ["klarna amazon", "klarna purchase", "amazon via klarna"],
    category: "Office Costs",
    baseConfidence: 65,
  },
  {
    keywords: ["xero", "quickbooks", "sage", "freeagent", "quickfile", "kashflow", "crunch"],
    category: "Professional Services",
    baseConfidence: 85,
  },
  {
    keywords: ["o2", "vodafone", "ee", "three", "t-mobile", "bt", "virgin media", "sky"],
    category: "Utilities",
    baseConfidence: 80,
  },
  {
    keywords: ["octopus energy", "british gas", "edf", "eon", "scottish power", "npower", "bulb"],
    category: "Utilities",
    baseConfidence: 80,
  },
  {
    keywords: ["netflix", "spotify", "disney", "apple music", "youtube premium", "amazon prime"],
    category: "Subscriptions",
    baseConfidence: 75,
  },
  {
    keywords: ["udemy", "coursera", "linkedin learning", "skillshare", "pluralsight", "masterclass"],
    category: "Training and Education",
    baseConfidence: 75,
  },
  {
    keywords: ["aviva", "axa", "allianz", "direct line", "admiral", "hiscox", "qbe", "zurich"],
    category: "Insurance",
    baseConfidence: 80,
  },
  {
    keywords: ["github", "gitlab", "bitbucket", "docker", "npm", "jetbrains", "codeium", "sourcegraph"],
    category: "Software",
    baseConfidence: 85,
  },
  {
    keywords: ["zapier", "n8n", "make", "workato", "tray.io", "base44"],
    category: "Software",
    baseConfidence: 85,
  },
  {
    keywords: ["pipedrive", "hubspot crm", "salesforce", "close", "outreach", "apollo", "zoominfo"],
    category: "Software",
    baseConfidence: 80,
  },
];

// ─── Keyword patterns (fallback) ──────────────────────────────────────

interface KeywordPattern {
  keywords: string[];
  category: string;
  baseConfidence: number;
  amountCondition?: "positive" | "negative";
}

const KEYWORD_PATTERNS: KeywordPattern[] = [
  { keywords: ["software", "saas", "subscription", "app"], category: "Software", baseConfidence: 75 },
  { keywords: ["cloud", "hosting", "server", "cdn"], category: "Cloud Infrastructure", baseConfidence: 75 },
  { keywords: ["ai", "llm", "gpt", "model", "embedding"], category: "AI Tools", baseConfidence: 75 },
  { keywords: ["ad", "advertising", "campaign", "ppc", "cpc"], category: "Advertising", baseConfidence: 75 },
  { keywords: ["marketing", "seo", "content", "social media"], category: "Marketing", baseConfidence: 70 },
  { keywords: ["bank fee", "overdraft", "service charge", "maintenance fee"], category: "Bank Fees", baseConfidence: 75 },
  { keywords: ["professional services", "consultant", "advisor", "consulting"], category: "Professional Services", baseConfidence: 75 },
  { keywords: ["travel", "hotel", "flight", "uber trip", "taxi"], category: "Travel", baseConfidence: 70 },
  { keywords: ["office", "stationery", "supplies", "printer", "paper"], category: "Office Costs", baseConfidence: 70 },
  { keywords: ["equipment", "hardware", "laptop", "monitor", "desktop"], category: "Office Costs", baseConfidence: 70 },
  { keywords: ["legal", "lawyer", "solicitor", "barrister"], category: "Professional Services", baseConfidence: 75 },
  { keywords: ["dividend", "dividends", "shareholder"], category: "Owner Drawings", baseConfidence: 80 },
  { keywords: ["capital", "investment", "funding", "seed", "series"], category: "Capital Injection", baseConfidence: 75, amountCondition: "positive" },
  { keywords: ["refund", "chargeback", "reversal"], category: "Refunds", baseConfidence: 75 },
  { keywords: ["transfer", "internal transfer", "between accounts"], category: "Transfers", baseConfidence: 70 },
  { keywords: ["interest", "savings interest"], category: "Revenue", baseConfidence: 70, amountCondition: "positive" },
  { keywords: ["training", "course", "certification", "workshop"], category: "Training and Education", baseConfidence: 70 },
  { keywords: ["insurance", "premium", "policy"], category: "Insurance", baseConfidence: 75 },
  { keywords: ["mobile", "phone", "broadband", "internet"], category: "Utilities", baseConfidence: 70 },
  { keywords: ["family", "childcare", "nursery", "school fees"], category: "Family Support", baseConfidence: 65 },
  { keywords: ["personal", "personal spending", "personal use"], category: "Personal Spending", baseConfidence: 65 },
  { keywords: ["credit card", "card repayment", "card payment"], category: "Credit Card Payment", baseConfidence: 75, amountCondition: "negative" },
  { keywords: ["commission"], category: "Sales and Marketing", baseConfidence: 70 },
  { keywords: ["consultancy", "consulting", "consultant fee"], category: "Professional Services", baseConfidence: 75 },
  { keywords: ["highlevel", "gohighlevel"], category: "Software", baseConfidence: 85 },
  { keywords: ["eventsconnecter"], category: "Software", baseConfidence: 70 },
  { keywords: ["apple.com", "apple store"], category: "Software", baseConfidence: 75 },
  { keywords: ["stripe top up", "stripe payout"], category: "Revenue", baseConfidence: 80, amountCondition: "positive" },
];

// ─── Business model boosts ────────────────────────────────────────────

const BUSINESS_MODEL_BOOSTS: Record<string, Record<string, number>> = {
  saas: {
    "Software": 5,
    "Cloud Infrastructure": 5,
    "AI Tools": 5,
    "Marketing": 3,
    "Advertising": 3,
  },
  ecommerce: {
    "Shipping and Fulfilment": 5,
    "Advertising": 5,
    "Payment Processor Fees": 5,
    "COGS": 5,
    "Inventory": 3,
  },
  physical_products: {
    "Shipping and Fulfilment": 5,
    "Advertising": 5,
    "Payment Processor Fees": 5,
    "COGS": 5,
    "Inventory": 3,
  },
  agency: {
    "Professional Services": 5,
    "Contractors": 5,
    "Advertising": 5,
    "Software": 3,
  },
  consulting: {
    "Professional Services": 5,
    "Contractors": 5,
    "Advertising": 5,
    "Software": 3,
  },
  services: {
    "Professional Services": 5,
    "Contractors": 5,
    "Advertising": 5,
    "Software": 3,
  },
  marketplace: {
    "Payment Processor Fees": 5,
    "Bank Fees": 5,
    "Advertising": 3,
  },
  content: {
    "Marketing": 5,
    "Advertising": 3,
    "Software": 3,
  },
};

// ─── Helpers ──────────────────────────────────────────────────────────

function normalise(text: string | undefined): string {
  return (text || "").toLowerCase().trim();
}

function buildSearchText(tx: V3Transaction): string {
  return `${normalise(tx.description)} ${normalise(tx.merchant)} ${normalise(tx.reference)}`;
}

function textContainsKeyword(text: string, keyword: string): boolean {
  if (keyword.includes(" ")) {
    return text.includes(keyword);
  }
  const regex = new RegExp(`\\b${keyword}\\b`, "i");
  return regex.test(text);
}

function getBusinessBoost(context: V3Context, category: string): number {
  const model = normalise(context.businessModel);
  const boosts = BUSINESS_MODEL_BOOSTS[model] || {};
  let boost = boosts[category] || 0;

  for (const rm of context.revenueModels) {
    const rmBoosts = BUSINESS_MODEL_BOOSTS[normalise(rm)] || {};
    boost = Math.max(boost, rmBoosts[category] || 0);
  }

  return boost;
}

function mapConfidenceToStatus(confidence: number): V3CategoryResult["status"] {
  if (confidence >= 90) return "categorised";
  if (confidence >= 75) return "ai_suggested";
  return "needs_review";
}

function sourcePriority(source: MatchSource): number {
  switch (source) {
    case "reference": return 3;
    case "userRule": return 2;
    case "keyword": return 1;
    case "nameDetection": return 0;
  }
}

function pickBestMatch(matches: ScoredMatch[]): ScoredMatch | null {
  if (matches.length === 0) return null;

  return matches.reduce((best, current) => {
    if (current.confidence > best.confidence) return current;
    if (current.confidence === best.confidence) {
      if (sourcePriority(current.source) > sourcePriority(best.source)) return current;
    }
    return best;
  });
}

// ─── Core engine ──────────────────────────────────────────────────────

export function categoriseV3(
  transactions: V3Transaction[],
  context: V3Context
): V3CategoryResult[] {
  return transactions.map((tx) => categoriseSingleV3(tx, context));
}

function categoriseSingleV3(
  tx: V3Transaction,
  context: V3Context
): V3CategoryResult {
  const text = buildSearchText(tx);
  const matches: ScoredMatch[] = [];

  // 1. User rules
  for (const rule of context.userRules) {
    let matchCount = 0;
    const reasonParts: string[] = [];

    const merchantPattern = normalise(rule.merchantPattern);
    if (merchantPattern && text.includes(merchantPattern)) {
      matchCount++;
      reasonParts.push(`merchant "${rule.merchantPattern}"`);
    }

    const descriptionPattern = normalise(rule.descriptionPattern);
    if (descriptionPattern && tx.description?.toLowerCase().includes(descriptionPattern)) {
      matchCount++;
      reasonParts.push(`description "${rule.descriptionPattern}"`);
    }

    const referencePattern = normalise(rule.referencePattern);
    if (referencePattern && tx.reference?.toLowerCase().includes(referencePattern)) {
      matchCount++;
      reasonParts.push(`reference "${rule.referencePattern}"`);
    }

    if (rule.provider && tx.merchant?.toLowerCase().includes(rule.provider.toLowerCase())) {
      matchCount++;
      reasonParts.push(`provider "${rule.provider}"`);
    }

    if (matchCount > 0) {
      let confidence = Math.min(100, 80 + rule.confidenceBoost + getBusinessBoost(context, rule.category));
      if (matchCount > 1) {
        confidence = Math.min(100, confidence + 5 * (matchCount - 1));
      }
      if (rule.direction && rule.direction === tx.type) {
        confidence = Math.min(100, confidence + 10);
      }

      matches.push({
        category: rule.category,
        confidence,
        source: "userRule",
        reason: `Matched user rule on ${reasonParts.join(", ")} → ${rule.category}`,
      });
    }
  }

  // 2. Reference-based patterns
  for (const ref of REFERENCE_PATTERNS) {
    if (ref.requiresCostStructure && !context.costStructure.map(normalise).includes(ref.requiresCostStructure)) {
      continue;
    }
    if (ref.amountCondition === "positive" && tx.amount <= 0) continue;
    if (ref.amountCondition === "negative" && tx.amount >= 0) continue;

    for (const keyword of ref.keywords) {
      if (textContainsKeyword(text, keyword)) {
        const boost = getBusinessBoost(context, ref.category);
        matches.push({
          category: ref.category,
          confidence: Math.min(100, ref.baseConfidence + boost),
          source: "reference",
          reason: `Reference match: "${keyword}" → ${ref.category}`,
        });
        break;
      }
    }
  }

  // 3. Keyword patterns (fallback)
  for (const kp of KEYWORD_PATTERNS) {
    if (kp.amountCondition === "positive" && tx.amount <= 0) continue;
    if (kp.amountCondition === "negative" && tx.amount >= 0) continue;

    for (const keyword of kp.keywords) {
      if (textContainsKeyword(text, keyword)) {
        const boost = getBusinessBoost(context, kp.category);
        matches.push({
          category: kp.category,
          confidence: Math.min(100, kp.baseConfidence + boost),
          source: "keyword",
          reason: `Keyword match: "${keyword}" → ${kp.category}`,
        });
        break;
      }
    }
  }

  // 4. Personal name detection
  if (matches.length === 0) {
    const nameText = tx.merchant || tx.description || "";
    const nameResult = detectPersonalName(nameText, tx.amount, tx.reference);
    if (nameResult.isPersonalName) {
      if (nameResult.suggestedCategories.length > 0) {
        for (const cat of nameResult.suggestedCategories) {
          matches.push({
            category: cat,
            confidence: Math.min(100, nameResult.confidence),
            source: "nameDetection",
            reason: nameResult.reason,
          });
        }
      } else {
        matches.push({
          category: "Uncategorised Review",
          confidence: 45,
          source: "nameDetection",
          reason: nameResult.reason || "Personal name — review needed",
        });
      }
    }
  }

  // 5. Pick best match
  const best = pickBestMatch(matches);

  if (best) {
    return {
      category: best.category,
      confidence: best.confidence,
      reason: best.reason,
      status: mapConfidenceToStatus(best.confidence),
    };
  }

  // 6. Fallback
  return {
    category: "Uncategorised Review",
    confidence: 0,
    reason: "No matching patterns",
    status: "needs_review",
  };
}
