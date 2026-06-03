"use client";

import { useState, useEffect } from "react";
import {
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Trash2,
  Eye,
  Database,
  X,
} from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils/formatters";
import { useCompanyCurrency, type CurrencyCode } from "@/lib/hooks/useCompanyCurrency";
import {
  getUploadHistory,
  getUploadTransactions,
  deleteUploadAndTransactions,
  refreshUploadCategories,
  type UploadHistoryItem,
} from "@/app/(dashboard)/upload-centre/upload-history-actions";
import type { Transaction } from "@/lib/types";
import type { ImportRowOutcome } from "@/lib/upload/reconciliation";
import { formatKpiExclusionReason } from "@/lib/kpi-treatment";

type UploadFilter = "all" | "completed" | "failed" | "processing";
type DetailFilters = {
  status: string;
  category: string;
  currency: string;
  duplicateStatus: "all" | "duplicates" | "not_duplicates";
};

const PAGE_SIZE = 100;
const DEFAULT_DETAIL_FILTERS: DetailFilters = {
  status: "all",
  category: "all",
  currency: "all",
  duplicateStatus: "all",
};

export default function UploadHistoryList() {
  const [uploads, setUploads] = useState<UploadHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUpload, setSelectedUpload] = useState<UploadHistoryItem | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [rowOutcomes, setRowOutcomes] = useState<ImportRowOutcome[]>([]);
  const [txLoading, setTxLoading] = useState(false);
  const [txTotal, setTxTotal] = useState(0);
  const [txHasMore, setTxHasMore] = useState(false);
  const [txError, setTxError] = useState<string | null>(null);
  const [detailFilters, setDetailFilters] = useState<DetailFilters>(DEFAULT_DETAIL_FILTERS);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [refreshingId, setRefreshingId] = useState<string | null>(null);
  const [refreshMessage, setRefreshMessage] = useState<string | null>(null);
  const [filter, setFilter] = useState<UploadFilter>("all");

  useEffect(() => {
    let cancelled = false;

    async function loadUploads() {
      const result = await getUploadHistory();
      if (cancelled) return;
      if (result.success && result.uploads) {
        setUploads(result.uploads);
      }
      setLoading(false);
    }

    void loadUploads();

    return () => {
      cancelled = true;
    };
  }, []);

  async function handleViewDetails(upload: UploadHistoryItem) {
    setSelectedUpload(upload);
    setTransactions([]);
    setRowOutcomes([]);
    setTxTotal(0);
    setTxHasMore(false);
    setTxError(null);
    setDetailFilters(DEFAULT_DETAIL_FILTERS);
    await loadUploadTransactions(upload.id, DEFAULT_DETAIL_FILTERS, 0, true);
  }

  async function loadUploadTransactions(
    uploadId: string,
    filters: DetailFilters,
    offset: number,
    replace: boolean
  ) {
    setTxLoading(true);
    const result = await getUploadTransactions(uploadId, {
      limit: PAGE_SIZE,
      offset,
      ...filters,
    });
    if (result.success && result.transactions) {
      setTransactions((prev) => (replace ? result.transactions ?? [] : [...prev, ...(result.transactions ?? [])]));
      if (result.rowOutcomes) setRowOutcomes(result.rowOutcomes);
      setTxTotal(result.total ?? result.transactions.length);
      setTxHasMore(result.hasMore ?? false);
      setTxError(null);
    } else {
      setTxError(result.error ?? "Failed to load transactions for this upload.");
    }
    setTxLoading(false);
  }

  function handleDetailFiltersChange(filters: DetailFilters) {
    setDetailFilters(filters);
    if (selectedUpload) {
      setTransactions([]);
      void loadUploadTransactions(selectedUpload.id, filters, 0, true);
    }
  }

  async function handleDelete(uploadId: string) {
    if (!confirm("Delete this upload and all its transactions? This cannot be undone.")) return;
    setDeletingId(uploadId);
    const result = await deleteUploadAndTransactions(uploadId);
    setDeletingId(null);
    if (result.success) {
      setUploads((prev) => prev.filter((u) => u.id !== uploadId));
      if (selectedUpload?.id === uploadId) setSelectedUpload(null);
    } else {
      alert(result.error || "Delete failed");
    }
  }

  async function handleRefreshCategories(uploadId: string) {
    setRefreshingId(uploadId);
    setRefreshMessage(null);
    const result = await refreshUploadCategories(uploadId);
    setRefreshingId(null);

    if (!result.success) {
      setRefreshMessage(result.error ?? "Category refresh failed.");
      return;
    }

    setRefreshMessage(
      `Category refresh updated ${result.refreshed ?? 0} row${result.refreshed === 1 ? "" : "s"}; protected ${result.protectedRows ?? 0} user-confirmed row${result.protectedRows === 1 ? "" : "s"}.`
    );

    const history = await getUploadHistory();
    if (history.success && history.uploads) {
      setUploads(history.uploads);
      const refreshedUpload = history.uploads.find((upload) => upload.id === uploadId);
      if (refreshedUpload) setSelectedUpload(refreshedUpload);
    }
    if (selectedUpload?.id === uploadId) {
      await loadUploadTransactions(uploadId, detailFilters, 0, true);
    }
  }

  if (loading) {
    return (
      <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6">
        <div className="flex items-center gap-2 text-sm text-[var(--muted-foreground)]">
          <RefreshCw className="h-4 w-4 animate-spin" />
          Loading upload history...
        </div>
      </div>
    );
  }

  const filteredUploads = uploads.filter((u) => {
    if (filter === "all") return true;
    return u.status === filter;
  });

  const counts = {
    all: uploads.length,
    completed: uploads.filter((u) => u.status === "completed").length,
    failed: uploads.filter((u) => u.status === "failed").length,
    processing: uploads.filter((u) => u.status === "processing").length,
  };

  if (uploads.length === 0) {
    return (
      <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6">
        <p className="text-sm text-[var(--muted-foreground)]">No uploads yet. Upload a file to see it here.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-[var(--foreground)]">Upload History</h3>
        <span className="text-xs text-[var(--muted-foreground)]">{uploads.length} upload{uploads.length !== 1 ? "s" : ""}</span>
      </div>
      {refreshMessage && (
        <div className="rounded-lg border border-[var(--accent)]/20 bg-[var(--accent)]/10 px-3 py-2 text-xs text-[var(--foreground)]">
          {refreshMessage}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1">
        {([
          { key: "all", label: "All" },
          { key: "completed", label: "Completed" },
          { key: "failed", label: "Failed" },
          { key: "processing", label: "Processing" },
        ] as const).map((tab) => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              filter === tab.key
                ? "bg-[var(--accent)]/10 text-[var(--accent)]"
                : "text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--border)]/40"
            }`}
          >
            {tab.label}
            <span className="ml-1.5 text-[10px] opacity-70">{counts[tab.key]}</span>
          </button>
        ))}
      </div>

      <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] overflow-hidden">
        <div className="divide-y divide-[var(--border)]">
          {filteredUploads.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <p className="text-sm text-[var(--muted-foreground)]">No uploads match the selected filter.</p>
            </div>
          ) : (
            filteredUploads.map((upload) => {
            const rec = upload.reconciliation;
            const status = upload.status;
            const isDone = status === "completed";
            const isFailed = status === "failed";

            return (
              <div key={upload.id} className="px-4 py-3 hover:bg-[var(--border)]/30 transition-colors">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="shrink-0">
                      {isDone ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                      ) : isFailed ? (
                        <AlertCircle className="h-4 w-4 text-rose-400" />
                      ) : (
                        <RefreshCw className="h-4 w-4 text-amber-400 animate-spin" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-[var(--foreground)] truncate">{upload.fileName}</p>
                      <p className="text-xs text-[var(--muted-foreground)]">
                        {formatDate(upload.uploadedAt)} · {upload.source?.replace(/_/g, " ")}
                        {rec?.sourceCurrency && ` · ${rec.sourceCurrency}`}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {rec && (
                      <div className="hidden sm:flex items-center gap-3 text-xs text-[var(--muted-foreground)]">
                        <span className="flex items-center gap-1">
                          <Database className="h-3 w-3" />
                          {rec.rowsInFile > 0 ? rec.rowsInFile : upload.transactionCount ?? 0}
                        </span>
                        {rec.rowsSkippedDuplicate > 0 && (
                          <span className="text-amber-400">{rec.rowsSkippedDuplicate} dup</span>
                        )}
                        {rec.rowsMarkedTransfer > 0 && (
                          <span className="text-violet-400">{rec.rowsMarkedTransfer} xfer</span>
                        )}
                      </div>
                    )}
                    <button
                      onClick={() => handleViewDetails(upload)}
                      className="p-1.5 rounded-lg hover:bg-[var(--border)] text-[var(--muted-foreground)] transition-colors"
                      title="View details"
                    >
                      <Eye className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(upload.id)}
                      disabled={deletingId === upload.id}
                      className="p-1.5 rounded-lg hover:bg-rose-500/10 text-[var(--muted-foreground)] hover:text-rose-400 transition-colors disabled:opacity-50"
                      title="Delete upload and transactions"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })
          )}
        </div>
      </div>

      {/* Detail Drawer */}
      {selectedUpload && (
        <UploadDetailDrawer
          upload={selectedUpload}
          transactions={transactions}
          rowOutcomes={rowOutcomes}
          total={txTotal}
          hasMore={txHasMore}
          error={txError}
          loading={txLoading}
          filters={detailFilters}
          onFiltersChange={handleDetailFiltersChange}
          onLoadMore={() => loadUploadTransactions(selectedUpload.id, detailFilters, transactions.length, false)}
          onRefreshCategories={() => handleRefreshCategories(selectedUpload.id)}
          refreshingCategories={refreshingId === selectedUpload.id}
          onClose={() => setSelectedUpload(null)}
        />
      )}
    </div>
  );
}

function UploadDetailDrawer({
  upload,
  transactions,
  rowOutcomes,
  total,
  hasMore,
  error,
  loading,
  filters,
  onFiltersChange,
  onLoadMore,
  onRefreshCategories,
  refreshingCategories,
  onClose,
}: {
  upload: UploadHistoryItem;
  transactions: Transaction[];
  rowOutcomes: ImportRowOutcome[];
  total: number;
  hasMore: boolean;
  error: string | null;
  loading: boolean;
  filters: DetailFilters;
  onFiltersChange: (filters: DetailFilters) => void;
  onLoadMore: () => void;
  onRefreshCategories: () => void;
  refreshingCategories: boolean;
  onClose: () => void;
}) {
  const { currency } = useCompanyCurrency();
  const rec = upload.reconciliation;
  const lastCategoryRefreshAt = upload.metadata?.last_category_refresh_at as string | undefined;
  const lastCategoryRefreshCount = upload.metadata?.last_category_refresh_count as number | undefined;
  const outcomeFilterKey = `${upload.id}:${filters.status}:${filters.category}:${filters.currency}:${filters.duplicateStatus}`;
  const [outcomePage, setOutcomePage] = useState({ key: outcomeFilterKey, count: PAGE_SIZE });
  const categories = Array.from(new Set([
    ...transactions.map((tx) => tx.category).filter(Boolean),
    ...rowOutcomes.map((row) => row.category).filter(Boolean),
  ])) as string[];
  const currencies = Array.from(new Set([
    ...transactions.map((tx) => tx.currency).filter(Boolean),
    ...rowOutcomes.map((row) => row.currency).filter(Boolean),
  ])) as string[];
  const filteredOutcomes = rowOutcomes.filter((row) => {
    if (filters.status !== "all" && row.status !== filters.status && row.reviewStatus !== filters.status) return false;
    if (filters.category !== "all" && row.category !== filters.category) return false;
    if (filters.currency !== "all" && row.currency !== filters.currency) return false;
    if (filters.duplicateStatus === "duplicates" && row.duplicateStatus !== "duplicate") return false;
    if (filters.duplicateStatus === "not_duplicates" && row.duplicateStatus === "duplicate") return false;
    return true;
  });
  const visibleOutcomeCount = outcomePage.key === outcomeFilterKey ? outcomePage.count : PAGE_SIZE;
  const visibleOutcomes = filteredOutcomes.slice(0, visibleOutcomeCount);

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm transition-opacity" onClick={onClose} />

      {/* Drawer */}
      <div className="fixed inset-y-0 right-0 z-50 w-full sm:w-[540px] md:w-[640px] bg-[var(--background)] border-l border-[var(--border)] shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)]">
          <div>
            <h2 className="text-sm font-semibold text-[var(--foreground)]">{upload.fileName}</h2>
            <p className="text-[11px] text-[var(--muted-foreground)]">
              {formatDate(upload.uploadedAt)} · {upload.status}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onRefreshCategories}
              disabled={refreshingCategories || transactions.length === 0}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-3 py-2 text-xs text-[var(--foreground)] transition-colors hover:border-[var(--accent)]/40 disabled:opacity-50"
              title="Refresh system categories without creating duplicate rows or overwriting user-confirmed corrections"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${refreshingCategories ? "animate-spin" : ""}`} />
              Refresh categories
            </button>
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-[var(--border)] text-[var(--muted-foreground)] transition-colors">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {/* Reconciliation */}
          {rec && (
            <div className="space-y-3">
              <h3 className="text-xs font-semibold text-[var(--foreground)] uppercase tracking-wider">Reconciliation</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                <DetailStat label="Rows in File" value={String(rec.rowsInFile)} />
                <DetailStat label="Rows Parsed" value={String(rec.rowsParsed)} />
                <DetailStat label="Rows Valid" value={String(rec.rowsValid)} />
                <DetailStat label="Imported" value={String(rec.rowsInserted)} />
                <DetailStat label="Duplicates" value={String(rec.rowsSkippedDuplicate)} />
                <DetailStat label="Transfers" value={String(rec.rowsMarkedTransfer)} />
                <DetailStat label="Excluded KPIs" value={String(rec.rowsExcludedFromKpis)} />
                <DetailStat label="Failed" value={String(rec.rowsFailed)} />
                <DetailStat label="Needs Review" value={String(rec.rowsNeedingReview)} />
                <DetailStat label="Uncategorised" value={String(rec.rowsUncategorised)} />
                <DetailStat label="Ambiguous" value={String(rec.rowsAmbiguous)} />
                <DetailStat label="Categorised" value={String(rec.rowsCategorised)} />
                <DetailStat label="High Confidence" value={String(rec.rowsHighConfidence)} />
                <DetailStat label="Revenue Rows" value={String(rec.rowsIncludedInRevenue)} />
                <DetailStat label="Expense Rows" value={String(rec.rowsIncludedInExpenses)} />
                <DetailStat label="Cash Flow Rows" value={String(rec.rowsIncludedInCashFlow)} />
                <DetailStat label="User Rule" value={String(rec.rowsCategorisedByUserRule)} />
                <DetailStat label="System Intel" value={String(rec.rowsCategorisedBySystemIntelligence)} />
                <DetailStat label="Linked Subs" value={String(rec.rowsLinkedToSubscriptions)} />
                <DetailStat label="Fee Rows" value={String(rec.rowsWithFees)} />
                <DetailStat label="Refunds" value={String(rec.rowsWithRefunds)} />
                <DetailStat label="Card Repayments" value={String(rec.rowsWithCreditCardRepaymentTreatment)} />
                <DetailStat label="Balanced" value={rec.reconciliationBalanced ? "Yes" : "No"} />
              </div>
              {rec.explanation && (
                <p className={`text-xs ${rec.reconciliationBalanced ? "text-emerald-300" : "text-rose-300"}`}>
                  {rec.explanation}
                </p>
              )}
            </div>
          )}

          {/* Intelligence */}
          {rec && (
            <div className="space-y-3">
              <h3 className="text-xs font-semibold text-[var(--foreground)] uppercase tracking-wider">Intelligence</h3>
              <div className="grid grid-cols-3 gap-2">
                <DetailStat label="Subscriptions" value={String(rec.subscriptionsDetected)} />
                <DetailStat label="Alerts" value={String(rec.alertsCreated)} />
                <DetailStat label="Recommendations" value={String(rec.recommendationsCreated)} />
              </div>
              {lastCategoryRefreshAt && (
                <p className="text-xs text-[var(--muted-foreground)]">
                  Categories refreshed {formatDate(lastCategoryRefreshAt)}
                  {lastCategoryRefreshCount !== undefined ? ` · ${lastCategoryRefreshCount} row${lastCategoryRefreshCount === 1 ? "" : "s"} updated` : ""}
                  . User-confirmed corrections are protected.
                </p>
              )}
            </div>
          )}

          {/* Transactions */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold text-[var(--foreground)] uppercase tracking-wider">CSV Row Outcomes</h3>
              <span className="text-xs text-[var(--muted-foreground)]">
                Showing {visibleOutcomes.length} of {filteredOutcomes.length} matching rows
                {rowOutcomes.length !== filteredOutcomes.length ? ` (${rowOutcomes.length} total)` : ""}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <select
                value={filters.status}
                onChange={(event) => onFiltersChange({ ...filters, status: event.target.value })}
                className="rounded-lg border border-[var(--border)] bg-[var(--card)] px-2 py-2 text-xs text-[var(--foreground)]"
              >
                <option value="all">All statuses</option>
                <option value="categorised">Categorised</option>
                <option value="needs_review">Needs review</option>
                <option value="ai_suggested">AI suggested</option>
                <option value="possible_duplicate">Possible duplicate</option>
                <option value="transfer">Transfer</option>
                <option value="duplicate_skipped">Duplicate skipped</option>
                <option value="failed">Failed</option>
              </select>
              <select
                value={filters.duplicateStatus}
                onChange={(event) => onFiltersChange({ ...filters, duplicateStatus: event.target.value as DetailFilters["duplicateStatus"] })}
                className="rounded-lg border border-[var(--border)] bg-[var(--card)] px-2 py-2 text-xs text-[var(--foreground)]"
              >
                <option value="all">All duplicate states</option>
                <option value="duplicates">Duplicates only</option>
                <option value="not_duplicates">Not duplicates</option>
              </select>
              <select
                value={filters.category}
                onChange={(event) => onFiltersChange({ ...filters, category: event.target.value })}
                className="rounded-lg border border-[var(--border)] bg-[var(--card)] px-2 py-2 text-xs text-[var(--foreground)]"
              >
                <option value="all">All categories</option>
                {categories.map((category) => (
                  <option key={category} value={category}>{category}</option>
                ))}
              </select>
              <select
                value={filters.currency}
                onChange={(event) => onFiltersChange({ ...filters, currency: event.target.value })}
                className="rounded-lg border border-[var(--border)] bg-[var(--card)] px-2 py-2 text-xs text-[var(--foreground)]"
              >
                <option value="all">All currencies</option>
                {currencies.map((code) => (
                  <option key={code} value={code}>{code}</option>
                ))}
              </select>
            </div>

            {visibleOutcomes.length > 0 ? (
              <div className="space-y-1.5">
                {visibleOutcomes.map((row) => (
                  <div
                    key={`${row.rowNumber}-${row.rawRowHash ?? row.externalTransactionId ?? row.status}`}
                    className="rounded-lg border border-[var(--border)] px-3 py-2"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-[var(--foreground)] truncate">
                          Row {row.rowNumber} · {row.merchant || row.description || row.status}
                        </p>
                        <p className="text-[10px] text-[var(--muted-foreground)]">
                          {row.transactionDate ? `${formatDate(row.transactionDate)} · ` : ""}
                          {row.category || "No category"}{row.subcategory ? ` / ${row.subcategory}` : ""} · {row.status}
                          {row.kpiTreatment === "excluded" ? ` · KPI excluded: ${formatKpiExclusionReason(row.kpiExclusionReason, row.category)}` : " · KPI included"}
                        </p>
                        <p className="text-[10px] text-[var(--muted-foreground)] truncate">
                          {row.transactionId ? `DB ${row.transactionId}` : "No DB transaction"}
                          {row.externalTransactionId ? ` · External ${row.externalTransactionId}` : ""}
                          {row.rawRowHash ? ` · Hash ${row.rawRowHash}` : ""}
                        </p>
                        {(row.reason || row.failureReason || row.categoryReason) && (
                          <p className="mt-1 text-[10px] text-[var(--muted-foreground)] line-clamp-2">
                            {row.reason || row.failureReason || row.categoryReason}
                          </p>
                        )}
                        {row.intelligenceGroupReason && (
                          <p className="mt-1 text-[10px] text-sky-300/80 line-clamp-2">
                            {row.intelligenceGroupReason}
                          </p>
                        )}
                      </div>
                      {row.amount !== undefined && (
                        <span className={`text-xs font-semibold shrink-0 ${row.direction === "income" ? "text-emerald-400" : "text-rose-400"}`}>
                          {row.direction === "income" ? "+" : "-"}
                          {formatCurrency(row.amount, 2, (row.currency || currency) as CurrencyCode)}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
                {visibleOutcomeCount < filteredOutcomes.length && (
                  <button
                    onClick={() => setOutcomePage({ key: outcomeFilterKey, count: visibleOutcomeCount + PAGE_SIZE })}
                    className="w-full rounded-lg border border-[var(--border)] px-3 py-2 text-xs text-[var(--foreground)] hover:border-[var(--accent)]/40 transition-colors"
                  >
                    Load more row outcomes
                  </button>
                )}
              </div>
            ) : (
              <p className="text-xs text-[var(--muted-foreground)]">No row outcomes match these filters.</p>
            )}
          </div>

          {/* Transactions */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold text-[var(--foreground)] uppercase tracking-wider">Database Transactions</h3>
              <span className="text-xs text-[var(--muted-foreground)]">{transactions.length} of {total} DB rows loaded</span>
            </div>

            <a
              href={`/transactions?preset=allTime&uploadId=${upload.id}`}
              className="inline-flex rounded-lg border border-[var(--border)] px-3 py-2 text-xs text-[var(--foreground)] hover:border-[var(--accent)]/40 transition-colors"
            >
              View imported transactions
            </a>

            {loading ? (
              <div className="flex items-center justify-center h-20">
                <RefreshCw className="h-4 w-4 animate-spin text-[var(--muted-foreground)]" />
              </div>
            ) : error ? (
              <div className="rounded-lg border border-rose-500/20 bg-rose-500/10 p-3">
                <p className="text-xs text-rose-300">{error}</p>
              </div>
            ) : transactions.length === 0 ? (
              <p className="text-xs text-[var(--muted-foreground)]">No transactions found for this upload.</p>
            ) : (
              <div className="space-y-1.5">
                {transactions.map((tx) => (
                  <div
                    key={tx.id}
                    className="flex items-center justify-between rounded-lg border border-[var(--border)] px-3 py-2"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium text-[var(--foreground)] truncate">
                        {tx.sourceRowNumber ? `Row ${tx.sourceRowNumber} · ` : ""}{tx.merchant || tx.description}
                      </p>
                      <p className="text-[10px] text-[var(--muted-foreground)]">
                        {formatDate(tx.date)} · {tx.category} · {tx.status}
                        {tx.rowStatus ? ` · ${tx.rowStatus}` : ""}
                        {tx.kpiExcluded ? ` · KPI excluded: ${formatKpiExclusionReason(tx.kpiExclusionReason, tx.category)}` : ""}
                      </p>
                      <p className="text-[10px] text-[var(--muted-foreground)] truncate">
                        DB {tx.id}
                        {tx.externalTransactionId ? ` · External ${tx.externalTransactionId}` : ""}
                        {tx.rawRowHash ? ` · Hash ${tx.rawRowHash}` : ""}
                      </p>
                    </div>
                    <span className={`text-xs font-semibold shrink-0 ml-2 ${tx.type === "income" ? "text-emerald-400" : "text-rose-400"}`}>
                      {tx.type === "income" ? "+" : "-"}
                      {formatCurrency(tx.amount, 2, (tx.currency || currency) as CurrencyCode)}
                    </span>
                  </div>
                ))}
                {hasMore && (
                  <button
                    onClick={onLoadMore}
                    className="w-full rounded-lg border border-[var(--border)] px-3 py-2 text-xs text-[var(--foreground)] hover:border-[var(--accent)]/40 transition-colors"
                  >
                    Load more
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

function DetailStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[var(--border)] px-3 py-2">
      <p className="text-[10px] text-[var(--muted-foreground)] uppercase">{label}</p>
      <p className="text-sm font-bold text-[var(--foreground)]">{value}</p>
    </div>
  );
}
