import type { FinancialDataSourceStatus } from "@/lib/db/data-source-shared";
import { formatCoverageDate } from "@/lib/db/data-source-shared";

interface DataCoverageBannerProps {
  status: FinancialDataSourceStatus;
  selectedLabel: string;
  compact?: boolean;
}

export function DataCoverageBanner({ status, selectedLabel, compact = false }: DataCoverageBannerProps) {
  if (!status.hasActiveDataSource) return null;

  const range =
    status.earliestTransactionDate && status.latestTransactionDate
      ? `${formatCoverageDate(status.earliestTransactionDate)} to ${formatCoverageDate(status.latestTransactionDate)}`
      : "No dated transactions";
  const selectedCount = status.selectedTransactionCount ?? status.activeTransactionCount;

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--card)]/70 px-4 py-3">
      <div className={`flex gap-2 ${compact ? "flex-col" : "flex-col md:flex-row md:items-center md:justify-between"}`}>
        <p className="text-xs text-[var(--muted-foreground)]">
          <span className="font-semibold text-[var(--foreground)]">Data available:</span> {range}
        </p>
        <p className="text-xs text-[var(--muted-foreground)]">
          <span className="font-semibold text-[var(--foreground)]">Selected:</span> {selectedLabel}.{" "}
          <span className="font-semibold text-[var(--foreground)]">Source:</span> {selectedCount} transaction
          {selectedCount === 1 ? "" : "s"} from {status.activeUploadCount} upload
          {status.activeUploadCount === 1 ? "" : "s"}.
        </p>
      </div>
      {selectedCount === 0 && (
        <p className="mt-2 text-xs font-medium text-[var(--warning)]">
          No transactions found in selected range. Upload new data to see latest results.
        </p>
      )}
    </div>
  );
}
