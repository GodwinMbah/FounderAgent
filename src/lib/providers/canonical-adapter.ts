/**
 * Canonical → NormalisedRow adapter
 * Bridges the new canonical model with downstream pipeline components
 * that still expect the old NormalisedRow shape.
 */

import type { CanonicalTransaction } from "./canonical-model";

export interface NormalisedRow {
  rowNumber: number;
  date: string;
  merchant: string;
  description: string;
  reference?: string;
  amount: number;
  type: "income" | "expense";
  currency?: string;
  originalAmount?: number;
  originalCurrency?: string;
  category?: string;
  status: string;
  confidenceScore: number;
  rawData: Record<string, string>;
  metadata?: Record<string, unknown>;
  parseErrors: string[];
  categoryReason?: string;
}

export function canonicalToNormalised(
  tx: CanonicalTransaction,
  rowNumber: number
): NormalisedRow {
  return {
    rowNumber,
    date: tx.transactionDate,
    merchant: tx.merchantName,
    description: tx.description,
    reference: tx.reference,
    amount: Math.abs(tx.amount),
    type: tx.amount >= 0 ? "income" : "expense",
    currency: tx.currency,
    originalAmount: tx.originalAmount,
    originalCurrency: tx.originalCurrency,
    category: tx.category,
    status: tx.status,
    confidenceScore: tx.confidenceScore,
    rawData: tx.rawData,
    metadata: {
      external_id: tx.externalTransactionId,
      reference: tx.reference,
      transaction_type: tx.transactionType,
      counterparty: tx.counterpartyName,
      fee_amount: tx.feeAmount,
      running_balance: tx.runningBalance,
      account_name: tx.accountName,
      account_number: tx.accountNumber,
      merchant_category_code: tx.merchantCategoryCode,
      source_provider: tx.sourceProvider,
      source_file_id: tx.sourceFileId,
      is_transfer: tx.isTransfer,
      is_fee: tx.isFee,
      is_possible_duplicate: tx.isPossibleDuplicate,
      is_personal_name: tx.isPersonalName,
      transfer_pair_id: tx.transferPairId,
      review_reason: tx.reviewReason,
      posted_date: tx.postedDate,
      exchange_rate: tx.exchangeRate,
      fee_currency: tx.feeCurrency,
    },
    parseErrors: tx.parseErrors,
  };
}

export function canonicalListToNormalised(
  transactions: CanonicalTransaction[]
): NormalisedRow[] {
  return transactions.map((tx, i) => canonicalToNormalised(tx, i + 2));
}
