/**
 * Amount normaliser: converts provider-specific amounts into a clean signed decimal.
 * Positive = income, negative = expense.
 */

import { cleanAmountString } from "./amount-parser";
import type { SignConvention } from "./amount-parser";

export type { SignConvention };

export interface AmountNormalisationResult {
  amount: number; // normalised: positive = income, negative = expense
  type: "income" | "expense";
  currency?: string; // extracted currency symbol/code if found
  feeAmount?: number; // extracted fee if separate
  originalAmount?: number;
  originalCurrency?: string;
}

/* ------------------------------------------------------------------ */
/* Internal helpers                                                    */
/* ------------------------------------------------------------------ */

function cleanValue(value: string): {
  cleaned: string;
  currency?: string;
  isNegative: boolean;
} {
  let raw = value.trim();

  // Handle CR/DR suffixes/prefixes before other processing
  const crDrMatch = raw.match(/\b(CR|DR)\b/i);
  let crDrNegative = false;
  if (crDrMatch) {
    crDrNegative = crDrMatch[1].toUpperCase() === "DR";
    raw = raw.replace(/\b(CR|DR)\b/gi, "").trim();
  }

  const result = cleanAmountString(raw);
  return {
    cleaned: result.cleaned,
    currency: result.currency,
    isNegative: crDrNegative || result.isNegative,
  };
}

function parseAbsolute(value: string): { amount: number; currency?: string } {
  const { cleaned, currency } = cleanValue(value);
  const amount = Math.abs(parseFloat(cleaned) || 0);
  return { amount, currency };
}

/* ------------------------------------------------------------------ */
/* Exported functions                                                  */
/* ------------------------------------------------------------------ */

/**
 * Normalise a single amount string.
 */
export function normaliseAmount(
  value: string,
  signConvention: SignConvention,
  options?: {
    typeHint?: string; // e.g., "DEBIT", "CREDIT", "PAYMENT", "REFUND"
    currencyHint?: string; // known currency from adapter
    isFee?: boolean; // if true, always return as expense
  }
): AmountNormalisationResult | null {
  const { cleaned, currency: detectedCurrency, isNegative } = cleanValue(value);
  const absAmount = Math.abs(parseFloat(cleaned) || 0);

  if (absAmount === 0) return null;

  let amount = isNegative ? -absAmount : absAmount;

  if (options?.isFee) {
    amount = -absAmount;
  } else if (signConvention === "us_bank") {
    // positive raw = expense (negative), negative raw = income (positive)
    amount = -amount;
  } else if (signConvention === "unknown") {
    const hint = options?.typeHint?.toUpperCase().trim();
    if (hint) {
      const expenseHints = [
        "DEBIT",
        "PAYMENT",
        "CHARGE",
        "EXPENSE",
        "WITHDRAWAL",
        "OUT",
      ];
      const incomeHints = [
        "CREDIT",
        "REFUND",
        "DEPOSIT",
        "INCOME",
        "IN",
      ];
      const isExpenseHint = expenseHints.some((h) => hint.includes(h));
      const isIncomeHint = incomeHints.some((h) => hint.includes(h));

      if (isExpenseHint) {
        amount = -absAmount;
      } else if (isIncomeHint) {
        amount = absAmount;
      } else {
        // still ambiguous — default positive = income
        amount = absAmount;
      }
    } else {
      amount = absAmount;
    }
  }
  // uk_bank & accounting: keep the sign as-is (negative = expense, positive = income)

  const type: "income" | "expense" = amount >= 0 ? "income" : "expense";

  return {
    amount,
    type,
    currency: options?.currencyHint || detectedCurrency,
    originalAmount: absAmount,
    originalCurrency: detectedCurrency,
  };
}

/**
 * Normalise when provider has split debit/credit columns.
 */
export function normaliseSplitAmount(
  debitValue: string,
  creditValue: string,
  options?: {
    currencyHint?: string;
    typeHint?: string;
  }
): AmountNormalisationResult | null {
  const debit = parseAbsolute(debitValue);
  const credit = parseAbsolute(creditValue);

  if (debit.amount === 0 && credit.amount === 0) return null;

  let amount: number;
  let type: "income" | "expense";
  let currency: string | undefined;

  if (debit.amount > 0 && credit.amount === 0) {
    amount = -debit.amount;
    type = "expense";
    currency = debit.currency;
  } else if (credit.amount > 0 && debit.amount === 0) {
    amount = credit.amount;
    type = "income";
    currency = credit.currency;
  } else if (debit.amount > 0 && credit.amount > 0) {
    // Prefer credit; log warning
    amount = credit.amount;
    type = "income";
    currency = credit.currency;
    console.warn(
      `[amount-normaliser] Both debit (${debit.amount}) and credit (${credit.amount}) are non-zero. Preferring credit.`
    );
  } else {
    // Edge case: one column has a negative value (unexpected but handle gracefully)
    if (credit.amount > 0) {
      amount = credit.amount;
      type = "income";
      currency = credit.currency;
    } else if (debit.amount > 0) {
      amount = -debit.amount;
      type = "expense";
      currency = debit.currency;
    } else {
      return null;
    }
  }

  return {
    amount,
    type,
    currency: options?.currencyHint || currency,
  };
}

/**
 * Normalise when provider has "Money In / Money Out" or "Paid In / Paid Out" columns.
 */
export function normaliseInOutAmount(
  moneyIn: string,
  moneyOut: string,
  options?: {
    currencyHint?: string;
  }
): AmountNormalisationResult | null {
  const moneyInParsed = parseAbsolute(moneyIn);
  const moneyOutParsed = parseAbsolute(moneyOut);

  if (moneyInParsed.amount === 0 && moneyOutParsed.amount === 0) return null;

  let amount: number;
  let type: "income" | "expense";
  let currency: string | undefined;

  if (moneyOutParsed.amount > 0 && moneyInParsed.amount === 0) {
    amount = -moneyOutParsed.amount;
    type = "expense";
    currency = moneyOutParsed.currency;
  } else if (moneyInParsed.amount > 0 && moneyOutParsed.amount === 0) {
    amount = moneyInParsed.amount;
    type = "income";
    currency = moneyInParsed.currency;
  } else if (moneyOutParsed.amount > 0 && moneyInParsed.amount > 0) {
    amount = moneyInParsed.amount;
    type = "income";
    currency = moneyInParsed.currency;
    console.warn(
      `[amount-normaliser] Both money in (${moneyInParsed.amount}) and money out (${moneyOutParsed.amount}) are non-zero. Preferring money in.`
    );
  } else {
    if (moneyInParsed.amount > 0) {
      amount = moneyInParsed.amount;
      type = "income";
      currency = moneyInParsed.currency;
    } else if (moneyOutParsed.amount > 0) {
      amount = -moneyOutParsed.amount;
      type = "expense";
      currency = moneyOutParsed.currency;
    } else {
      return null;
    }
  }

  return {
    amount,
    type,
    currency: options?.currencyHint || currency,
  };
}

/**
 * Extract fee from a fee column.
 */
export function extractFee(
  feeValue: string,
  currencyHint?: string
): { feeAmount: number; feeCurrency?: string } | null {
  const { cleaned, currency } = cleanValue(feeValue);
  const amount = Math.abs(parseFloat(cleaned) || 0);
  if (amount === 0) return null;

  return {
    feeAmount: amount,
    feeCurrency: currencyHint || currency,
  };
}

/**
 * Determine sign convention from data samples.
 */
export function inferSignConvention(
  samples: { amount: number; description: string; type?: string }[]
): SignConvention {
  const expenseKeywords = ["payment", "purchase", "debit", "charge"];

  let positiveExpenses = 0;
  let negativeExpenses = 0;

  for (const sample of samples) {
    const desc = sample.description.toLowerCase();
    const isExpenseLike = expenseKeywords.some((kw) => desc.includes(kw));
    if (!isExpenseLike) continue;

    if (sample.amount > 0) {
      positiveExpenses++;
    } else if (sample.amount < 0) {
      negativeExpenses++;
    }
  }

  if (positiveExpenses > negativeExpenses) return "us_bank";
  if (negativeExpenses > positiveExpenses) return "uk_bank";
  return "unknown";
}
