export interface FinancialDataSourceStatus {
  hasActiveDataSource: boolean;
  activeUploadCount: number;
  activeTransactionCount: number;
  manualTransactionCount: number;
  activeUploadTransactionCount: number;
  connectedAccountCount?: number;
  connectedTransactionCount?: number;
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
    return "Connect your bank account or upload a statement to begin.";
  }

  const range =
    status.earliestTransactionDate && status.latestTransactionDate
      ? `${formatCoverageDate(status.earliestTransactionDate)} to ${formatCoverageDate(status.latestTransactionDate)}`
      : "No dated transactions";

  const sourceParts = getSourceBreakdownParts(status);

  return `Data available: ${range}. Source: ${sourceParts.join(", ")}.`;
}

export function getSourceBreakdownParts(status: FinancialDataSourceStatus): string[] {
  const sourceParts: string[] = [];
  if (status.activeUploadTransactionCount > 0 || status.activeUploadCount > 0) {
    sourceParts.push(`${status.activeUploadTransactionCount} transaction${
      status.activeUploadTransactionCount === 1 ? "" : "s"
    } from ${status.activeUploadCount} upload${status.activeUploadCount === 1 ? "" : "s"}`);
  }
  if ((status.connectedTransactionCount ?? 0) > 0) {
    sourceParts.push(`${status.connectedTransactionCount} connected account transaction${
      status.connectedTransactionCount === 1 ? "" : "s"
    }`);
  }
  if (status.manualTransactionCount > 0) {
    sourceParts.push(`${status.manualTransactionCount} manual transaction${status.manualTransactionCount === 1 ? "" : "s"}`);
  }
  if (sourceParts.length === 0 && (status.connectedAccountCount ?? 0) > 0) {
    sourceParts.push(`${status.connectedAccountCount} connected account${status.connectedAccountCount === 1 ? "" : "s"} awaiting transactions`);
  }

  return sourceParts;
}

export function getSourceBreakdown(status: FinancialDataSourceStatus): string {
  const parts = getSourceBreakdownParts(status);
  return parts.length > 0 ? parts.join(", ") : "no active source rows";
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
