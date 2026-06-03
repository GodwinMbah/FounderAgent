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
  subcategory?: string;
  status: string;
  confidenceScore: number;
  rawData: Record<string, string>;
  metadata?: Record<string, unknown>;
  parseErrors: string[];
  categoryReason?: string;
  categoryConfidence?: number;
  groupingConfidence?: number;
  normalisedMerchant?: string;
  displayMerchant?: string;
  isCreditCardRepayment?: boolean;
  isSubscriptionCandidate?: boolean;
  isRecurringCandidate?: boolean;
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
    subcategory: tx.subcategory,
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
      original_merchant: tx.originalMerchantName,
      normalised_merchant: tx.normalisedMerchantName,
      display_merchant: tx.displayMerchantName,
      detected_subcategory: tx.subcategory,
      category_reason: tx.categoryReason,
      category_confidence: tx.categoryConfidence,
      grouping_confidence: tx.groupingConfidence,
      category_evidence: tx.categoryEvidence,
      business_meaning: tx.businessMeaning,
      kpi_treatment: tx.kpiTreatment,
      income_expense_status: tx.incomeExpenseStatus,
      is_transfer: tx.isTransfer,
      is_fee: tx.isFee,
      is_credit_card_repayment: tx.isCreditCardRepayment,
      is_subscription_candidate: tx.isSubscriptionCandidate,
      is_recurring_candidate: tx.isRecurringCandidate,
      is_possible_duplicate: tx.isPossibleDuplicate,
      is_personal_name: tx.isPersonalName,
      transfer_pair_id: tx.transferPairId,
      review_reason: tx.reviewReason,
      posted_date: tx.postedDate,
      exchange_rate: tx.exchangeRate,
      fee_currency: tx.feeCurrency,
    },
    parseErrors: tx.parseErrors,
    categoryReason: tx.categoryReason,
    categoryConfidence: tx.categoryConfidence,
    groupingConfidence: tx.groupingConfidence,
    normalisedMerchant: tx.normalisedMerchantName,
    displayMerchant: tx.displayMerchantName,
    isCreditCardRepayment: tx.isCreditCardRepayment,
    isSubscriptionCandidate: tx.isSubscriptionCandidate,
    isRecurringCandidate: tx.isRecurringCandidate,
  };
}

export function canonicalListToNormalised(
  transactions: CanonicalTransaction[]
): NormalisedRow[] {
  return transactions.map((tx, i) => canonicalToNormalised(tx, i + 2));
}
