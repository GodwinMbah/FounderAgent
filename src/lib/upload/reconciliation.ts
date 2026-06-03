export type ImportRowStatus =
  | "inserted"
  | "duplicate_skipped"
  | "failed"
  | "transfer"
  | "needs_review";

export interface ImportRowOutcome {
  rowNumber: number;
  status: ImportRowStatus;
  transactionId?: string;
  duplicateOfTransactionId?: string;
  externalTransactionId?: string;
  rawRowHash?: string;
  sourceFileName?: string;
  sourceProvider?: string;
  transactionDate?: string;
  merchant?: string;
  description?: string;
  reference?: string;
  amount?: number;
  currency?: string;
  originalAmount?: number;
  originalCurrency?: string;
  feeAmount?: number;
  direction?: "income" | "expense";
  transactionType?: string;
  category?: string;
  subcategory?: string;
  confidence?: number;
  categoryConfidence?: number;
  groupingConfidence?: number;
  reviewStatus?: string;
  duplicateStatus?: "duplicate" | "not_duplicate";
  kpiTreatment?: "included" | "excluded";
  kpiExclusionReason?: string;
  failureReason?: string;
  categoryReason?: string;
  intelligenceGroupId?: string;
  intelligenceGroupReason?: string;
  signalsUsed?: string[];
  reason?: string;
}

export interface ImportReconciliation {
  rowsInFile: number;
  rowsParsed: number;
  rowsValid: number;
  rowsInserted: number;
  rowsSkippedDuplicate: number;
  rowsMarkedTransfer: number;
  rowsExcludedFromKpis: number;
  rowsFailed: number;
  rowsNeedingReview: number;
  rowsUncategorised: number;
  rowsAmbiguous: number;
  rowsCategorised: number;
  rowsHighConfidence: number;
  rowsCategorisedByUserRule: number;
  rowsCategorisedBySystemIntelligence: number;
  rowsIncludedInRevenue: number;
  rowsIncludedInExpenses: number;
  rowsIncludedInCashFlow: number;
  rowsLinkedToSubscriptions: number;
  rowsWithFees: number;
  rowsWithRefunds: number;
  rowsWithCreditCardRepaymentTreatment: number;
  reconciliationBalanced: boolean;
  explanation: string;
  rowOutcomes: ImportRowOutcome[];
}

function num(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

export function getImportReconciliation(
  metadata?: Record<string, unknown> | null
): ImportReconciliation | null {
  const raw = metadata?.import_reconciliation;
  if (!raw || typeof raw !== "object") return null;
  const rec = raw as Record<string, unknown>;
  const rowOutcomes = Array.isArray(rec.rowOutcomes)
    ? (rec.rowOutcomes as ImportRowOutcome[])
    : [];

  return {
    rowsInFile: num(rec.rowsInFile),
    rowsParsed: num(rec.rowsParsed),
    rowsValid: num(rec.rowsValid),
    rowsInserted: num(rec.rowsInserted),
    rowsSkippedDuplicate: num(rec.rowsSkippedDuplicate),
    rowsMarkedTransfer: num(rec.rowsMarkedTransfer),
    rowsExcludedFromKpis: num(rec.rowsExcludedFromKpis),
    rowsFailed: num(rec.rowsFailed),
    rowsNeedingReview: num(rec.rowsNeedingReview),
    rowsUncategorised: num(rec.rowsUncategorised),
    rowsAmbiguous: num(rec.rowsAmbiguous),
    rowsCategorised: num(rec.rowsCategorised),
    rowsHighConfidence: num(rec.rowsHighConfidence),
    rowsCategorisedByUserRule: num(rec.rowsCategorisedByUserRule),
    rowsCategorisedBySystemIntelligence: num(rec.rowsCategorisedBySystemIntelligence),
    rowsIncludedInRevenue: num(rec.rowsIncludedInRevenue),
    rowsIncludedInExpenses: num(rec.rowsIncludedInExpenses),
    rowsIncludedInCashFlow: num(rec.rowsIncludedInCashFlow),
    rowsLinkedToSubscriptions: num(rec.rowsLinkedToSubscriptions),
    rowsWithFees: num(rec.rowsWithFees),
    rowsWithRefunds: num(rec.rowsWithRefunds),
    rowsWithCreditCardRepaymentTreatment: num(rec.rowsWithCreditCardRepaymentTreatment),
    reconciliationBalanced: rec.reconciliationBalanced === true,
    explanation: typeof rec.explanation === "string" ? rec.explanation : "",
    rowOutcomes,
  };
}
