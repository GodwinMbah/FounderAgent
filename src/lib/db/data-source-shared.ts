export interface FinancialDataSourceStatus {
  hasActiveDataSource: boolean;
  activeUploadCount: number;
  activeTransactionCount: number;
  manualTransactionCount: number;
  activeUploadTransactionCount: number;
  selectedTransactionCount?: number;
  earliestTransactionDate?: string;
  latestTransactionDate?: string;
  selectedFrom?: string;
  selectedTo?: string;
}

export function formatCoverageDate(date?: string): string {
  if (!date) return "No transaction dates";
  const parsed = new Date(`${date}T00:00:00`);
  return parsed.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function getCoverageSummary(status: FinancialDataSourceStatus): string {
  if (!status.hasActiveDataSource) {
    return "No active financial data source connected.";
  }

  const range =
    status.earliestTransactionDate && status.latestTransactionDate
      ? `${formatCoverageDate(status.earliestTransactionDate)} to ${formatCoverageDate(status.latestTransactionDate)}`
      : "No dated transactions";

  return `Data available: ${range}. Source: ${status.activeTransactionCount} transaction${
    status.activeTransactionCount === 1 ? "" : "s"
  } from ${status.activeUploadCount} upload${status.activeUploadCount === 1 ? "" : "s"}.`;
}

export function applyActiveSourceFilter<T extends { or: (query: string) => T; is: (column: string, value: null) => T }>(
  query: T,
  activeUploadIds: string[]
): T {
  if (activeUploadIds.length === 0) {
    return query.is("upload_id", null);
  }

  return query.or(`upload_id.is.null,upload_id.in.(${activeUploadIds.join(",")})`);
}
