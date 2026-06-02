"use client";

import { useState, useEffect, useCallback } from "react";
import {
  FileText,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  ChevronRight,
  Trash2,
  Eye,
  Database,
  X,
} from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils/formatters";
import { useCompanyCurrency } from "@/lib/hooks/useCompanyCurrency";
import {
  getUploadHistory,
  getUploadTransactions,
  deleteUploadAndTransactions,
  type UploadHistoryItem,
} from "@/app/(dashboard)/upload-centre/upload-history-actions";
import type { Transaction } from "@/lib/types";

type UploadFilter = "all" | "completed" | "failed" | "processing";

export default function UploadHistoryList() {
  const [uploads, setUploads] = useState<UploadHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUpload, setSelectedUpload] = useState<UploadHistoryItem | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [txLoading, setTxLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [filter, setFilter] = useState<UploadFilter>("all");

  const load = useCallback(async () => {
    setLoading(true);
    const result = await getUploadHistory();
    if (result.success && result.uploads) {
      setUploads(result.uploads);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleViewDetails(upload: UploadHistoryItem) {
    setSelectedUpload(upload);
    setTxLoading(true);
    const result = await getUploadTransactions(upload.id);
    if (result.success && result.transactions) {
      setTransactions(result.transactions);
    }
    setTxLoading(false);
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
                          {rec.totalParsed > 0 ? rec.totalParsed : upload.transactionCount ?? 0}
                        </span>
                        {rec.duplicateCount > 0 && (
                          <span className="text-amber-400">{rec.duplicateCount} dup</span>
                        )}
                        {rec.transferCount > 0 && (
                          <span className="text-violet-400">{rec.transferCount} xfer</span>
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
          loading={txLoading}
          onClose={() => setSelectedUpload(null)}
        />
      )}
    </div>
  );
}

function UploadDetailDrawer({
  upload,
  transactions,
  loading,
  onClose,
}: {
  upload: UploadHistoryItem;
  transactions: Transaction[];
  loading: boolean;
  onClose: () => void;
}) {
  const { currency } = useCompanyCurrency();
  const rec = upload.reconciliation;

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
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-[var(--border)] text-[var(--muted-foreground)] transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {/* Reconciliation */}
          {rec && (
            <div className="space-y-3">
              <h3 className="text-xs font-semibold text-[var(--foreground)] uppercase tracking-wider">Reconciliation</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                <DetailStat label="Rows Parsed" value={String(rec.totalParsed)} />
                <DetailStat label="Imported" value={String(upload.transactionCount ?? 0)} />
                <DetailStat label="Duplicates" value={String(rec.duplicateCount)} />
                <DetailStat label="Transfers" value={String(rec.transferCount)} />
                <DetailStat label="Needs Review" value={String(rec.needReviewCount)} />
                <DetailStat label="Categorised" value={String(rec.categorisedCount)} />
              </div>
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
            </div>
          )}

          {/* Transactions */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold text-[var(--foreground)] uppercase tracking-wider">Transactions</h3>
              <span className="text-xs text-[var(--muted-foreground)]">{transactions.length} rows</span>
            </div>

            {loading ? (
              <div className="flex items-center justify-center h-20">
                <RefreshCw className="h-4 w-4 animate-spin text-[var(--muted-foreground)]" />
              </div>
            ) : transactions.length === 0 ? (
              <p className="text-xs text-[var(--muted-foreground)]">No transactions found for this upload.</p>
            ) : (
              <div className="space-y-1.5">
                {transactions.slice(0, 50).map((tx) => (
                  <div
                    key={tx.id}
                    className="flex items-center justify-between rounded-lg border border-[var(--border)] px-3 py-2"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium text-[var(--foreground)] truncate">{tx.merchant || tx.description}</p>
                      <p className="text-[10px] text-[var(--muted-foreground)]">
                        {formatDate(tx.date)} · {tx.category} · {tx.status}
                      </p>
                    </div>
                    <span className={`text-xs font-semibold shrink-0 ml-2 ${tx.type === "income" ? "text-emerald-400" : "text-rose-400"}`}>
                      {tx.type === "income" ? "+" : "-"}
                      {formatCurrency(tx.amount, 2, currency)}
                    </span>
                  </div>
                ))}
                {transactions.length > 50 && (
                  <p className="text-xs text-[var(--muted-foreground)] text-center py-2">
                    Showing 50 of {transactions.length} transactions
                  </p>
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
