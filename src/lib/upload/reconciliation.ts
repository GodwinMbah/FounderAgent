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
  merchant?: string;
  amount?: number;
  currency?: string;
  category?: string;
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
  rowsCategorised: number;
  rowsLinkedToSubscriptions: number;
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
    rowsCategorised: num(rec.rowsCategorised),
    rowsLinkedToSubscriptions: num(rec.rowsLinkedToSubscriptions),
    reconciliationBalanced: rec.reconciliationBalanced === true,
    explanation: typeof rec.explanation === "string" ? rec.explanation : "",
    rowOutcomes,
  };
}
