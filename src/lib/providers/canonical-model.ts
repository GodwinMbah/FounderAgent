/**
 * Canonical Transaction Model
 * Provider-agnostic normalised representation of a financial transaction.
 * Maps to/from the database `transactions` schema.
 */

import type { Transaction } from "@/lib/types";

export type ProviderType = "bank" | "payment_processor" | "accounting" | "generic";

export type SignConvention = "uk_bank" | "us_bank" | "accounting" | "unknown";

export type FeeHandling = "separate_row" | "included_in_amount" | "separate_column";

export type TransactionDirection = "income" | "expense" | "transfer" | "fee" | "neutral";

export interface CanonicalTransaction {
  // Core identity
  transactionDate: string; // ISO YYYY-MM-DD
  postedDate?: string; // ISO YYYY-MM-DD
  externalTransactionId?: string;
  transactionType?: string; // raw type from provider

  // Parties
  merchantName: string;
  description: string;
  reference?: string;
  counterpartyName?: string;

  // Amounts
  amount: number; // normalised signed amount: positive = income, negative = expense
  debitAmount?: number;
  creditAmount?: number;
  feeAmount?: number;
  originalAmount?: number;
  exchangeRate?: number;

  // Currency
  currency: string;
  originalCurrency?: string;
  feeCurrency?: string;

  // Balance & Account
  runningBalance?: number;
  accountName?: string;
  accountNumber?: string;

  // Categorisation
  originalMerchantName?: string;
  normalisedMerchantName?: string;
  displayMerchantName?: string;
  category?: string;
  subcategory?: string;
  categoryReason?: string;
  categoryConfidence?: number;
  groupingConfidence?: number;
  categoryEvidence?: Array<{
    category: string;
    confidence: number;
    source: string;
    reason: string;
  }>;
  businessMeaning?: string;
  kpiTreatment?: "included" | "excluded";
  incomeExpenseStatus?: "income" | "expense";
  merchantCategoryCode?: string;
  categorySource?: "system" | "user" | "user_rule" | "grouping";
  userConfirmedCategory?: boolean;
  intelligenceGroupId?: string;
  intelligenceGroupLabel?: string;
  intelligenceGroupReason?: string;
  intelligenceGroupSignals?: string[];

  // Status & Confidence
  status: string; // "needs_review" | "completed" | "pending" | "ai_suggested" | "possible_duplicate" | "transfer"
  confidenceScore: number;

  // Source tracking
  sourceProvider: string; // provider adapter id
  sourceFileId?: string; // upload id
  sourceRowNumber?: number; // 1-based CSV row number, including header row offset
  rawRowHash?: string; // stable hash of the provider row for lineage/dedup proof
  rowStatus?: string; // imported | duplicate_skipped | transfer | failed | needs_review
  kpiExcluded?: boolean;
  kpiExclusionReason?: string;
  duplicateOfTransactionId?: string;

  // Intelligence flags
  isTransfer: boolean;
  isFee: boolean;
  isCreditCardRepayment?: boolean;
  isSubscriptionCandidate?: boolean;
  isRecurringCandidate?: boolean;
  isPossibleDuplicate: boolean;
  isPersonalName?: boolean;
  transferPairId?: string;
  reviewReason?: string;

  // Raw preservation
  rawData: Record<string, string>;
  parseErrors: string[];
}

export interface CanonicalParseResult {
  transactions: CanonicalTransaction[];
  detectedProvider: string;
  providerConfidence: number;
  detectedDelimiter: string;
  detectedHeaderRow: number;
  columnCount: number;
  rowCount: number;
  failedRows: { rowNumber: number; errors: string[]; rawRow: string[] }[];
  detectedCurrency?: string;
  detectedDateFormat?: string;
  accountName?: string;
  latestBalance?: number;
}

/**
 * Map a CanonicalTransaction to the DB Transaction shape.
 * New fields are stored in metadata JSONB if DB columns don't exist yet.
 */
export function toDbTransaction(
  canonical: CanonicalTransaction,
  companyId: string,
  uploadId?: string,
  bankAccountId?: string
): Omit<Transaction, "id" | "createdAt" | "updatedAt"> {
  const type: "income" | "expense" = canonical.amount >= 0 ? "income" : "expense";
  const absAmount = Math.abs(canonical.amount);

  // Normalize status to valid DB enum values
  const validDbStatuses = [
    "categorised",
    "needs_review",
    "possible_subscription",
    "possible_duplicate",
    "unusual_spend",
    "ai_suggested",
    "user_confirmed",
  ];
  const statusLower = (canonical.status || "").toLowerCase().replace(/\s+/g, "_");
  const normalizedStatus = validDbStatuses.includes(statusLower) ? statusLower : "needs_review";

  return {
    companyId,
    uploadId,
    accountId: bankAccountId,
    sourceRowNumber: canonical.sourceRowNumber,
    externalTransactionId: canonical.externalTransactionId,
    postedDate: canonical.postedDate,
    currency: canonical.currency,
    sourceProvider: canonical.sourceProvider,
    rawRowHash: canonical.rawRowHash,
    reference: canonical.reference,
    rowStatus: canonical.rowStatus,
    kpiExcluded: canonical.kpiExcluded ?? canonical.isTransfer,
    kpiExclusionReason: canonical.kpiExclusionReason ?? (canonical.isTransfer ? "transfer" : undefined),
    duplicateOfTransactionId: canonical.duplicateOfTransactionId,
    feeAmount: canonical.feeAmount,
    runningBalance: canonical.runningBalance,
    date: canonical.transactionDate,
    merchant: canonical.merchantName,
    description: canonical.description,
    category: canonical.category,
    amount: absAmount,
    type,
    status: normalizedStatus,
    confidenceScore: canonical.confidenceScore,
    tags: canonical.isTransfer ? ["transfer"] : canonical.isFee ? ["fee"] : [],
    metadata: {
      // New canonical fields stored in metadata until DB migration adds columns
      posted_date: canonical.postedDate,
      external_transaction_id: canonical.externalTransactionId,
      transaction_type_raw: canonical.transactionType,
      reference: canonical.reference,
      counterparty_name: canonical.counterpartyName,
      debit_amount: canonical.debitAmount,
      credit_amount: canonical.creditAmount,
      fee_amount: canonical.feeAmount,
      original_amount: canonical.originalAmount,
      original_currency: canonical.originalCurrency,
      exchange_rate: canonical.exchangeRate,
      fee_currency: canonical.feeCurrency,
      running_balance: canonical.runningBalance,
      account_name: canonical.accountName,
      account_number: canonical.accountNumber,
      merchant_category_code: canonical.merchantCategoryCode,
      source_provider: canonical.sourceProvider,
      source_file_id: canonical.sourceFileId,
      source_row_number: canonical.sourceRowNumber,
      raw_row_hash: canonical.rawRowHash,
      row_status: canonical.rowStatus,
      currency: canonical.currency,
      original_merchant: canonical.originalMerchantName,
      normalised_merchant: canonical.normalisedMerchantName,
      display_merchant: canonical.displayMerchantName,
      detected_subcategory: canonical.subcategory,
      category_reason: canonical.categoryReason,
      category_confidence: canonical.categoryConfidence,
      grouping_confidence: canonical.groupingConfidence,
      category_evidence: canonical.categoryEvidence,
      business_meaning: canonical.businessMeaning,
      kpi_treatment: canonical.kpiTreatment,
      income_expense_status: canonical.incomeExpenseStatus,
      category_source: canonical.categorySource,
      user_confirmed_category: canonical.userConfirmedCategory,
      intelligence_group_id: canonical.intelligenceGroupId,
      intelligence_group_label: canonical.intelligenceGroupLabel,
      intelligence_group_reason: canonical.intelligenceGroupReason,
      intelligence_group_signals: canonical.intelligenceGroupSignals,
      is_transfer: canonical.isTransfer,
      is_fee: canonical.isFee,
      is_credit_card_repayment: canonical.isCreditCardRepayment,
      is_subscription_candidate: canonical.isSubscriptionCandidate,
      is_recurring_candidate: canonical.isRecurringCandidate,
      is_possible_duplicate: canonical.isPossibleDuplicate,
      kpi_excluded: canonical.kpiExcluded,
      kpi_exclusion_reason: canonical.kpiExclusionReason,
      duplicate_of_transaction_id: canonical.duplicateOfTransactionId,
      is_personal_name: canonical.isPersonalName,
      transfer_pair_id: canonical.transferPairId,
      review_reason: canonical.reviewReason,
      raw_data: canonical.rawData,
      parse_errors: canonical.parseErrors,
    },
  };
}

/**
 * Map a DB Transaction back to a CanonicalTransaction (best-effort).
 */
export function fromDbTransaction(tx: Transaction): CanonicalTransaction {
  const meta = (tx.metadata ?? {}) as Record<string, unknown>;
  const amount = tx.type === "income" ? tx.amount : -tx.amount;

  return {
    transactionDate: typeof tx.date === "string" ? tx.date : tx.date.toISOString().slice(0, 10),
    postedDate: tx.postedDate || (meta.posted_date as string) || undefined,
    externalTransactionId: tx.externalTransactionId || (meta.external_transaction_id as string) || undefined,
    transactionType: (meta.transaction_type_raw as string) || undefined,
    merchantName: tx.merchant || "Unknown",
    description: tx.description,
    reference: tx.reference || (meta.reference as string) || undefined,
    counterpartyName: (meta.counterparty_name as string) || undefined,
    amount,
    debitAmount: (meta.debit_amount as number) || undefined,
    creditAmount: (meta.credit_amount as number) || undefined,
    feeAmount: tx.feeAmount || (meta.fee_amount as number) || undefined,
    originalAmount: (meta.original_amount as number) || undefined,
    exchangeRate: (meta.exchange_rate as number) || undefined,
    currency: tx.currency || (meta.currency as string) || "GBP",
    originalCurrency: (meta.original_currency as string) || undefined,
    feeCurrency: (meta.fee_currency as string) || undefined,
    runningBalance: tx.runningBalance || (meta.running_balance as number) || undefined,
    accountName: (meta.account_name as string) || undefined,
    accountNumber: (meta.account_number as string) || undefined,
    category: tx.category,
    originalMerchantName: (meta.original_merchant as string) || tx.merchant || undefined,
    normalisedMerchantName: (meta.normalised_merchant as string) || undefined,
    displayMerchantName: (meta.display_merchant as string) || tx.merchant || undefined,
    subcategory: (meta.detected_subcategory as string) || undefined,
    categoryReason: (meta.category_reason as string) || undefined,
    categoryConfidence: (meta.category_confidence as number) || undefined,
    groupingConfidence: (meta.grouping_confidence as number) || undefined,
    categoryEvidence: (meta.category_evidence as CanonicalTransaction["categoryEvidence"]) || undefined,
    businessMeaning: (meta.business_meaning as string) || undefined,
    kpiTreatment: (meta.kpi_treatment as CanonicalTransaction["kpiTreatment"]) || undefined,
    incomeExpenseStatus: (meta.income_expense_status as CanonicalTransaction["incomeExpenseStatus"]) || undefined,
    merchantCategoryCode: (meta.merchant_category_code as string) || undefined,
    categorySource: (meta.category_source as CanonicalTransaction["categorySource"]) || undefined,
    userConfirmedCategory: (meta.user_confirmed_category as boolean) || undefined,
    intelligenceGroupId: (meta.intelligence_group_id as string) || undefined,
    intelligenceGroupLabel: (meta.intelligence_group_label as string) || undefined,
    intelligenceGroupReason: (meta.intelligence_group_reason as string) || undefined,
    intelligenceGroupSignals: (meta.intelligence_group_signals as string[]) || undefined,
    status: tx.status,
    confidenceScore: tx.confidenceScore ?? 0,
    sourceProvider: tx.sourceProvider || (meta.source_provider as string) || "unknown",
    sourceFileId: tx.uploadId || undefined,
    sourceRowNumber: (tx.sourceRowNumber as number | undefined) ?? (meta.source_row_number as number | undefined),
    rawRowHash: (tx.rawRowHash as string | undefined) ?? (meta.raw_row_hash as string | undefined),
    rowStatus: (tx.rowStatus as string | undefined) ?? (meta.row_status as string | undefined),
    kpiExcluded: (tx.kpiExcluded as boolean | undefined) ?? (meta.kpi_excluded as boolean | undefined),
    kpiExclusionReason: (tx.kpiExclusionReason as string | undefined) ?? (meta.kpi_exclusion_reason as string | undefined),
    duplicateOfTransactionId: (tx.duplicateOfTransactionId as string | undefined) ?? (meta.duplicate_of_transaction_id as string | undefined),
    isTransfer: (meta.is_transfer as boolean) ?? false,
    isFee: (meta.is_fee as boolean) ?? false,
    isCreditCardRepayment: (meta.is_credit_card_repayment as boolean) || undefined,
    isSubscriptionCandidate: (meta.is_subscription_candidate as boolean) || undefined,
    isRecurringCandidate: (meta.is_recurring_candidate as boolean) || undefined,
    isPossibleDuplicate: (meta.is_possible_duplicate as boolean) ?? false,
    isPersonalName: (meta.is_personal_name as boolean) || undefined,
    transferPairId: (meta.transfer_pair_id as string) || undefined,
    reviewReason: (meta.review_reason as string) || undefined,
    rawData: (meta.raw_data as Record<string, string>) || {},
    parseErrors: (meta.parse_errors as string[]) || [],
  };
}

/**
 * Create a minimal canonical transaction for a failed/diagnostic row.
 */
export function createFailedCanonical(
  rowNumber: number,
  errors: string[],
  rawRow: string[],
  rawHeaders: string[],
  sourceProvider: string
): CanonicalTransaction {
  const rawData: Record<string, string> = {};
  rawHeaders.forEach((h, i) => {
    rawData[h] = rawRow[i] || "";
  });

  return {
    transactionDate: new Date().toISOString().slice(0, 10),
    merchantName: "Unknown",
    description: errors.join("; "),
    amount: 0,
    currency: "GBP",
    status: "needs_review",
    confidenceScore: 0,
    sourceProvider,
    sourceRowNumber: rowNumber,
    isTransfer: false,
    isFee: false,
    isPossibleDuplicate: false,
    rawData,
    parseErrors: errors,
  };
}
