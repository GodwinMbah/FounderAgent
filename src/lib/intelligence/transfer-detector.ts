export interface TransferDetectionResult {
  isTransfer: boolean;
  transferPairId?: string;
  reviewReason?: string;
  confidence: number; // 0-100
}

interface Transaction {
  transactionType?: string;
  description: string;
  reference?: string;
  amount: number;
  merchantName: string;
  counterpartyName?: string;
  accountName?: string;
  currency: string;
  transactionDate: string;
  externalTransactionId?: string;
}

export function detectTransfer(
  transaction: Transaction,
  options?: {
    knownAccounts?: string[];
    sourceProvider?: string;
  }
): TransferDetectionResult {
  const {
    transactionType = "",
    description = "",
    reference = "",
    merchantName = "",
  } = transaction;

  const descLower = description.toLowerCase();
  const typeLower = transactionType.toLowerCase();
  const refUpper = reference.toUpperCase();
  const merchLower = merchantName.toLowerCase();

  // Guard: fees and interest charges are real expenses, never transfers
  const feeOrInterestKeywords = ["fee", "interest charge", "interest"];
  if (feeOrInterestKeywords.some((kw) => descLower.includes(kw))) {
    return { isTransfer: false, confidence: 0 };
  }

  // 1. Type-based (confidence 90)
  const typeKeywords = ["transfer", "payout", "withdrawal", "refund", "topup", "internal"];
  if (typeKeywords.some((kw) => typeLower.includes(kw))) {
    return { isTransfer: true, confidence: 90 };
  }

  // 2. Description-based (confidence 80)
  const descKeywords = [
    "transfer to",
    "transfer from",
    "payout to",
    "withdrawal to",
    "credit card payment",
    "credit card repayment",
    "loan repayment",
    "owner transfer",
    "capital repayment",
    "capital on tap",
    "capital one",
  ];
  if (descKeywords.some((kw) => descLower.includes(kw))) {
    return { isTransfer: true, confidence: 80 };
  }

  // 3. Reference-based (confidence 75)
  const refKeywords = ["TF", "TRANSFER", "PAYOUT", "INT"];
  if (refKeywords.some((kw) => refUpper.includes(kw))) {
    return { isTransfer: true, confidence: 75 };
  }

  // 4. Merchant-based (confidence 70)
  const knownPayoutProviders = ["stripe", "paypal", "square", "adyen", "wise", "revolut"];
  const payoutKeywords = ["payout", "withdrawal", "transfer", "settlement"];
  const isKnownProvider = knownPayoutProviders.some((p) => merchLower.includes(p));
  const hasPayoutKeyword = payoutKeywords.some((kw) => descLower.includes(kw));
  if (isKnownProvider && hasPayoutKeyword) {
    return { isTransfer: true, confidence: 70 };
  }

  // 5. Provider-specific rules
  const sourceProvider = (options?.sourceProvider || "").toLowerCase();

  if (sourceProvider === "stripe_csv" && typeLower === "payout") {
    return { isTransfer: true, confidence: 95 };
  }

  if (sourceProvider === "paypal_csv" && typeLower === "withdrawal") {
    return { isTransfer: true, confidence: 95 };
  }

  if (descLower.includes("credit card repayment")) {
    return { isTransfer: true, confidence: 85 };
  }

  // Specific rule: Capital On Tap with negative amount (money out) = credit card repayment / transfer
  if (descLower.includes("capital on tap") && transaction.amount < 0) {
    return { isTransfer: true, confidence: 90 };
  }

  if (descLower.includes("capital one") && transaction.amount < 0) {
    return { isTransfer: true, confidence: 90 };
  }

  if (
    descLower.includes("owner transfer") ||
    descLower.includes("director loan") ||
    descLower.includes("shareholder")
  ) {
    return {
      isTransfer: true,
      confidence: 60,
      reviewReason: "Internal ownership transfer requires manual review",
    };
  }

  return { isTransfer: false, confidence: 0 };
}

function parseDate(dateStr: string): Date {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) {
    throw new Error(`Invalid date: ${dateStr}`);
  }
  return d;
}

function datesWithinDays(a: string, b: string, days: number): boolean {
  const da = parseDate(a);
  const db = parseDate(b);
  const diffMs = Math.abs(da.getTime() - db.getTime());
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  return diffDays <= days;
}

function amountsAreOpposite(a: number, b: number, tolerancePercent: number = 1): boolean {
  if (a === 0 && b === 0) return false;
  const expected = -a;
  const diff = Math.abs(expected - b);
  const tolerance = Math.abs(a) * (tolerancePercent / 100);
  return diff <= tolerance;
}

function descriptionsReferenceEachOther(descA: string, descB: string): boolean {
  const a = descA.toLowerCase();
  const b = descB.toLowerCase();

  // Same entity mentioned
  const extractEntity = (s: string): string | null => {
    const patterns = [
      /transfer (?:to|from) ([\w\s]+)/i,
      /payout (?:to|from) ([\w\s]+)/i,
      /withdrawal (?:to|from) ([\w\s]+)/i,
    ];
    for (const p of patterns) {
      const m = s.match(p);
      if (m) return m[1].trim().toLowerCase();
    }
    return null;
  };

  const entityA = extractEntity(a);
  const entityB = extractEntity(b);
  if (entityA && entityB && entityA === entityB) return true;

  // Shared keywords indicating same transfer
  const sharedTransferKeywords = ["transfer", "payout", "withdrawal", "settlement", "internal"];
  const aHas = sharedTransferKeywords.filter((kw) => a.includes(kw));
  const bHas = sharedTransferKeywords.filter((kw) => b.includes(kw));
  if (aHas.length > 0 && bHas.length > 0) {
    // Check for account name overlap or counterparty hints
    const wordsA = new Set(a.split(/\s+/));
    const wordsB = new Set(b.split(/\s+/));
    let common = 0;
    wordsA.forEach((w) => {
      if (w.length > 3 && wordsB.has(w)) common++;
    });
    if (common >= 2) return true;
  }

  return false;
}

export function findTransferPairs(
  transactions: Array<Transaction>
): Map<number, number> {
  const pairs = new Map<number, number>();
  const n = transactions.length;

  for (let i = 0; i < n; i++) {
    if (pairs.has(i)) continue;

    for (let j = i + 1; j < n; j++) {
      if (pairs.has(j)) continue;

      const a = transactions[i];
      const b = transactions[j];

      // Same currency
      if (a.currency !== b.currency) continue;

      // Within 3 days
      if (!datesWithinDays(a.transactionDate, b.transactionDate, 3)) continue;

      // Opposite amounts (±1% tolerance)
      if (!amountsAreOpposite(a.amount, b.amount)) continue;

      // One income, one expense
      const aSign = Math.sign(a.amount);
      const bSign = Math.sign(b.amount);
      if (aSign === 0 || bSign === 0) continue;
      if (aSign === bSign) continue;

      // Descriptions reference each other or same entity
      if (!descriptionsReferenceEachOther(a.description, b.description)) {
        // Fallback: if both are already flagged as transfers by detectTransfer, pair them
        const aIsTransfer = detectTransfer(a).isTransfer;
        const bIsTransfer = detectTransfer(b).isTransfer;
        if (!aIsTransfer || !bIsTransfer) continue;
      }

      pairs.set(i, j);
      pairs.set(j, i);
      break;
    }
  }

  return pairs;
}
