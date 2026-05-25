/**
 * Intelligent column detection with confidence scoring
 * Maps CSV headers to standard transaction fields
 */

import { cleanHeader, type ParsedCsv } from "./csv-core";

export interface ColumnMapping {
  date?: { index: number; header: string; confidence: number };
  description?: { index: number; header: string; confidence: number };
  merchant?: { index: number; header: string; confidence: number };
  amount?: { index: number; header: string; confidence: number };
  debit?: { index: number; header: string; confidence: number };
  credit?: { index: number; header: string; confidence: number };
  type?: { index: number; header: string; confidence: number };
  currency?: { index: number; header: string; confidence: number };
  balance?: { index: number; header: string; confidence: number };
  fee?: { index: number; header: string; confidence: number };
  originalCurrency?: { index: number; header: string; confidence: number };
  originalAmount?: { index: number; header: string; confidence: number };
  paymentCurrency?: { index: number; header: string; confidence: number };
  totalAmount?: { index: number; header: string; confidence: number };
  state?: { index: number; header: string; confidence: number };
  mcc?: { index: number; header: string; confidence: number };
  relatedTransactionId?: { index: number; header: string; confidence: number };
  accountName?: { index: number; header: string; confidence: number };
  reference?: { index: number; header: string; confidence: number };
}

export interface MappingReport {
  mapping: ColumnMapping;
  detectedDateColumn: string | null;
  detectedAmountColumn: string | null;
  detectedDebitColumn: string | null;
  detectedCreditColumn: string | null;
  detectedDescriptionColumn: string | null;
  detectedMerchantColumn: string | null;
  detectedCurrencyColumn: string | null;
  detectedBalanceColumn: string | null;
  overallConfidence: number; // 0-100
  missingRequired: string[];
}

// Column pattern definitions: [exact matches, substring matches]
const COLUMN_PATTERNS: Record<
  keyof ColumnMapping,
  { exact: string[]; substring: string[]; weight: number }
> = {
  date: {
    exact: ["date", "transaction date", "posted date", "booking date", "value date", "created", "created date", "completed date", "started date"],
    substring: ["date", "posted", "booking", "value", "transaction_date", "posting_date", "booking_date", "value_date", "created_date", "completed_date", "started_date"],
    weight: 1.0,
  },
  description: {
    exact: ["description", "details", "reference", "memo", "narrative", "transaction description", "payment reference", "transfer name", "original reference"],
    substring: ["description", "details", "reference", "memo", "narrative", "transaction_description", "payment_reference", "note", "transfer_name", "original_reference"],
    weight: 0.9,
  },
  merchant: {
    exact: ["merchant", "vendor", "payee", "name", "counterparty", "customer", "supplier", "recipient"],
    substring: ["merchant", "vendor", "payee", "counterparty", "supplier", "recipient", "to", "from"],
    weight: 0.8,
  },
  amount: {
    exact: ["amount", "transaction amount", "gross", "net", "total", "value", "transaction value"],
    substring: ["amount", "gross", "net", "total", "value", "transaction_amount"],
    weight: 1.0,
  },
  debit: {
    exact: ["debit", "money out", "paid out", "withdrawal", "outflow"],
    substring: ["debit", "money_out", "paid_out", "withdrawal", "outflow", "out"],
    weight: 0.95,
  },
  credit: {
    exact: ["credit", "money in", "paid in", "deposit", "inflow"],
    substring: ["credit", "money_in", "paid_in", "deposit", "inflow", "in"],
    weight: 0.95,
  },
  type: {
    exact: ["type", "transaction type", "direction"],
    substring: ["type", "transaction_type", "direction"],
    weight: 0.7,
  },
  currency: {
    exact: ["currency", "currency code", "ccy", "curr"],
    substring: ["currency", "ccy", "curr", "currency_code"],
    weight: 0.6,
  },
  balance: {
    exact: ["balance", "running balance", "closing balance", "available balance", "account balance"],
    substring: ["balance", "running_balance", "closing_balance", "available_balance", "account_balance"],
    weight: 0.5,
  },
  fee: {
    exact: ["fee"],
    substring: ["fee"],
    weight: 0.8,
  },
  originalCurrency: {
    exact: ["orig currency"],
    substring: ["orig currency", "original_currency", "original currency"],
    weight: 0.6,
  },
  originalAmount: {
    exact: ["orig amount"],
    substring: ["orig amount", "original_amount", "original amount"],
    weight: 0.8,
  },
  paymentCurrency: {
    exact: ["payment currency"],
    substring: ["payment currency", "payment_currency"],
    weight: 0.6,
  },
  totalAmount: {
    exact: ["total amount"],
    substring: ["total amount", "total_amount"],
    weight: 0.85,
  },
  state: {
    exact: ["state"],
    substring: ["state", "status"],
    weight: 0.6,
  },
  mcc: {
    exact: ["mcc"],
    substring: ["mcc", "merchant category code"],
    weight: 0.5,
  },
  relatedTransactionId: {
    exact: ["related transaction id"],
    substring: ["related transaction id", "related_transaction_id"],
    weight: 0.5,
  },
  accountName: {
    exact: ["account"],
    substring: ["account", "account name", "account_name"],
    weight: 0.6,
  },
  reference: {
    exact: ["reference"],
    substring: ["reference", "ref"],
    weight: 0.8,
  },
};

function scoreMatch(header: string, patterns: { exact: string[]; substring: string[] }): number {
  const h = cleanHeader(header);

  for (const exact of patterns.exact) {
    if (h === exact) return 100;
  }

  for (const sub of patterns.substring) {
    if (h === sub) return 90;
    if (h.includes(sub)) return 75;
  }

  return 0;
}

export function mapColumns(parsed: ParsedCsv): MappingReport {
  const mapping: ColumnMapping = {};
  const headers = parsed.headers;

  for (const [field, patterns] of Object.entries(COLUMN_PATTERNS)) {
    let bestScore = 0;
    let bestIndex = -1;
    let bestHeader = "";

    for (let i = 0; i < headers.length; i++) {
      const score = scoreMatch(headers[i], patterns);
      if (score > bestScore) {
        bestScore = score;
        bestIndex = i;
        bestHeader = headers[i];
      }
    }

    if (bestIndex >= 0 && bestScore >= 50) {
      mapping[field as keyof ColumnMapping] = {
        index: bestIndex,
        header: bestHeader,
        confidence: Math.round(bestScore * patterns.weight),
      };
    }
  }

  // Calculate overall confidence
  const requiredFields = ["date", "description", "amount"] as const;
  const hasRequired = requiredFields.every((f) => mapping[f] || (f === "description" && mapping["merchant"]));

  const scores: number[] = [];
  for (const m of Object.values(mapping)) {
    if (m) scores.push(m.confidence);
  }

  const overallConfidence = scores.length > 0
    ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
    : 0;

  const missingRequired: string[] = [];
  if (!mapping.date) missingRequired.push("date");
  if (!mapping.description && !mapping.merchant) missingRequired.push("description/merchant");
  if (!mapping.amount && !mapping.debit && !mapping.credit) missingRequired.push("amount/debit/credit");

  return {
    mapping,
    detectedDateColumn: mapping.date?.header ?? null,
    detectedAmountColumn: mapping.amount?.header ?? null,
    detectedDebitColumn: mapping.debit?.header ?? null,
    detectedCreditColumn: mapping.credit?.header ?? null,
    detectedDescriptionColumn: mapping.description?.header ?? null,
    detectedMerchantColumn: mapping.merchant?.header ?? null,
    detectedCurrencyColumn: mapping.currency?.header ?? null,
    detectedBalanceColumn: mapping.balance?.header ?? null,
    overallConfidence,
    missingRequired,
  };
}
