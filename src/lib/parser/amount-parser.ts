/**
 * Amount normalisation: currencies, negatives, debit/credit columns, parentheses
 */

export type SignConvention = "uk_bank" | "us_bank" | "accounting" | "unknown";

export interface AmountParseResult {
  amount: number; // absolute value
  type: "income" | "expense";
  rawValue: string;
  currency?: string;
  originalAmount?: number;
  originalCurrency?: string;
}

const CURRENCY_SYMBOLS: Record<string, string> = {
  "£": "GBP",
  "€": "EUR",
  "$": "USD",
  "¥": "JPY",
  "₹": "INR",
  "A$": "AUD",
  "C$": "CAD",
};

export function extractCurrencySymbol(raw: string): string | undefined {
  for (const [symbol, code] of Object.entries(CURRENCY_SYMBOLS)) {
    if (raw.includes(symbol)) return code;
  }
  // Check for 3-letter currency codes
  const codeMatch = raw.match(/\b(USD|EUR|GBP|AUD|CAD|JPY|INR)\b/i);
  if (codeMatch) return codeMatch[1].toUpperCase();
  return undefined;
}

export function cleanAmountString(raw: string): { cleaned: string; isNegative: boolean; currency?: string } {
  let cleaned = raw.trim();
  const currency = extractCurrencySymbol(cleaned);

  // Remove currency symbols — FIX: A$ and C$ must be matched as literals, not char class
  cleaned = cleaned.replace(/[$£€¥₹]|A\$|C\$/g, "");

  // Remove currency codes
  cleaned = cleaned.replace(/\b(USD|EUR|GBP|AUD|CAD|JPY|INR)\b/gi, "");

  // Check for parentheses indicating negative: (123.45)
  const isParenthesesNegative = cleaned.startsWith("(") && cleaned.endsWith(")");
  if (isParenthesesNegative) {
    cleaned = cleaned.replace(/[()]/g, "");
  }

  // Check for explicit negative sign
  const isExplicitNegative = cleaned.startsWith("-") || cleaned.startsWith("–");

  // Remove non-numeric except decimal point and minus
  cleaned = cleaned.replace(/[^0-9.\-]/g, "");

  // Validate: reject multiple decimal points
  const dotCount = (cleaned.match(/\./g) || []).length;
  if (dotCount > 1) {
    // Keep only first decimal point, remove rest
    let first = true;
    cleaned = cleaned.split("").filter((c) => {
      if (c === ".") {
        if (first) { first = false; return true; }
        return false;
      }
      return true;
    }).join("");
  }

  // Handle European comma-as-decimal (e.g. "1.234,56" or "1234,56")
  // NOTE: This must run BEFORE comma removal because we need the raw string
  // Re-process from original to catch commas
  const originalCheck = raw.trim().replace(/[$£€¥₹]|A\$|C\$/g, "").replace(/\b(USD|EUR|GBP|AUD|CAD|JPY|INR)\b/gi, "");
  if (originalCheck.includes(",") && originalCheck.includes(".")) {
    const lastComma = originalCheck.lastIndexOf(",");
    const lastDot = originalCheck.lastIndexOf(".");
    if (lastComma > lastDot) {
      cleaned = originalCheck.replace(/\./g, "").replace(",", ".").replace(/[^0-9.\-]/g, "");
    } else {
      cleaned = originalCheck.replace(/,/g, "").replace(/[^0-9.\-]/g, "");
    }
  } else if (originalCheck.includes(",")) {
    const commaParts = originalCheck.split(",");
    if (commaParts.length === 2 && commaParts[1].length <= 2) {
      cleaned = originalCheck.replace(",", ".").replace(/[^0-9.\-]/g, "");
    } else {
      cleaned = originalCheck.replace(/,/g, "").replace(/[^0-9.\-]/g, "");
    }
  }

  const isNegative = isParenthesesNegative || isExplicitNegative;

  return { cleaned, isNegative, currency };
}

export function parseAmount(raw: string, signConvention: SignConvention = "unknown"): AmountParseResult {
  const { cleaned, isNegative, currency } = cleanAmountString(raw);
  const value = parseFloat(cleaned) || 0;
  const amount = Math.abs(value);

  // Determine type based on sign convention and explicit negativity
  // UK bank standard (default): negative = expense (money out), positive = income (money in)
  // US bank convention: positive = expense (debit), negative = income (credit/refund)
  let type: "income" | "expense";
  if (signConvention === "us_bank") {
    type = isNegative ? "income" : "expense";
  } else if (signConvention === "accounting") {
    type = isNegative ? "expense" : "income";
  } else {
    // UK bank / unknown / default: negative = money out, positive = money in
    type = isNegative ? "expense" : "income";
  }

  return { amount, type, rawValue: raw, currency, originalAmount: amount, originalCurrency: currency };
}

/**
 * Parse amount when separate debit and credit columns exist
 */
export function parseDebitCredit(
  debitRaw: string,
  creditRaw: string
): AmountParseResult | null {
  const debit = parseAmount(debitRaw || "0");
  const credit = parseAmount(creditRaw || "0");

  if (debit.amount > 0 && credit.amount === 0) {
    return { amount: debit.amount, type: "expense", rawValue: debitRaw, currency: debit.currency };
  }
  if (credit.amount > 0 && debit.amount === 0) {
    return { amount: credit.amount, type: "income", rawValue: creditRaw, currency: credit.currency };
  }
  if (debit.amount > 0 && credit.amount > 0) {
    return debit.amount > credit.amount
      ? { amount: debit.amount, type: "expense", rawValue: debitRaw, currency: debit.currency }
      : { amount: credit.amount, type: "income", rawValue: creditRaw, currency: credit.currency };
  }

  return null;
}

/**
 * Parse amount with an explicit type column
 */
export function parseAmountWithType(
  amountRaw: string,
  typeRaw: string
): AmountParseResult {
  const parsed = parseAmount(amountRaw);
  const typeLower = typeRaw.toLowerCase().trim();

  if (
    typeLower.includes("income") ||
    typeLower.includes("credit") ||
    typeLower.includes("deposit") ||
    typeLower.includes("in")
  ) {
    return { ...parsed, type: "income" };
  }
  if (
    typeLower.includes("expense") ||
    typeLower.includes("debit") ||
    typeLower.includes("withdrawal") ||
    typeLower.includes("out")
  ) {
    return { ...parsed, type: "expense" };
  }

  return parsed;
}
