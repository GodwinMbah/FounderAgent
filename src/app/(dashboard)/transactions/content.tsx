"use client";

import { useState, useMemo } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { MetricCard } from "@/components/ui/MetricCard";
import { DataTable } from "@/components/ui/DataTable";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { SectionCard } from "@/components/ui/SectionCard";
import { formatCurrency, formatDate } from "@/lib/utils/formatters";
import { useCompanyCurrency, type CurrencyCode } from "@/lib/hooks/useCompanyCurrency";
import type { Transaction } from "@/lib/types";
import MerchantLogo from "@/components/features/transaction/MerchantLogo";
import { getDateRange, type DateRangePreset } from "@/lib/date-range";
import { updateTransactionCategory } from "@/lib/actions/transactions";
import { ALL_CATEGORIES } from "@/lib/categories";
import { Search, ListFilter, Tag, ArrowUpDown, CreditCard, CheckCircle2, Brain, AlertCircle, Check } from "lucide-react";
import { loadTransactionsPage } from "./actions";

function formatStatusLabel(status: string) {
  return status
    .split("_")
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join(" ");
}

function getStatusVariant(status: string) {
  const normalized = status.toLowerCase();
  if (normalized === "categorised" || normalized === "categorized") return "success";
  if (normalized === "ai_suggested") return "info";
  return "warning";
}

interface UploadSummary {
  id: string;
  fileName: string;
  uploadedAt: string;
}

interface TransactionsContentProps {
  transactions: Transaction[];
  totalTransactions: number;
  uploads: UploadSummary[];
  initialPreset: string;
  initialFrom: string;
  initialTo: string;
  initialFilters?: {
    type?: string;
    uploadId?: string;
    category?: string;
    status?: string;
    duplicateStatus?: DuplicateFilter;
    kpiTreatment?: "all" | "included" | "excluded";
    currency?: string;
    sourceProvider?: string;
  };
}

const PAGE_SIZE = 100;

type DuplicateFilter = "all" | "duplicates" | "not_duplicates";

function mergeUniqueTransactions(current: Transaction[], nextPage: Transaction[]) {
  const seen = new Set(current.map((transaction) => transaction.id));
  const uniqueNextPage = nextPage.filter((transaction) => {
    if (seen.has(transaction.id)) return false;
    seen.add(transaction.id);
    return true;
  });

  return [...current, ...uniqueNextPage];
}

export default function TransactionsContent({ transactions: initialTransactions, totalTransactions: initialTotalTransactions, uploads, initialPreset, initialFrom, initialTo, initialFilters }: TransactionsContentProps) {
  const { currency } = useCompanyCurrency();
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState(initialFilters?.type ?? "all");
  const [categoryFilter, setCategoryFilter] = useState(initialFilters?.category ?? "all");
  const [uploadFilter, setUploadFilter] = useState(initialFilters?.uploadId ?? "all");
  const [statusFilter, setStatusFilter] = useState(initialFilters?.status ?? "all");
  const [duplicateFilter, setDuplicateFilter] = useState<DuplicateFilter>(initialFilters?.duplicateStatus ?? "all");
  const [kpiTreatmentFilter, setKpiTreatmentFilter] = useState<"all" | "included" | "excluded">(initialFilters?.kpiTreatment ?? "all");
  const [currencyFilter, setCurrencyFilter] = useState(initialFilters?.currency ?? "all");
  const [sourceProviderFilter, setSourceProviderFilter] = useState(initialFilters?.sourceProvider ?? "all");
  const [sort, setSort] = useState("newest");
  const [transactions, setTransactions] = useState<Transaction[]>(initialTransactions);
  const [totalCount, setTotalCount] = useState(initialTotalTransactions);
  const [pageLoading, setPageLoading] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  // Use DB count for total count, but derive category/status counts from currently loaded rows.
  const total = totalCount;
  const categorised = transactions.filter((t) => t.status.toLowerCase() === "categorised" || t.status.toLowerCase() === "categorized").length;
  const aiSuggested = transactions.filter((t) => t.status.toLowerCase() === "ai_suggested").length;
  const needsReview = transactions.filter((t) => t.status.toLowerCase() === "needs_review" || (t.confidenceScore ?? 0) < 90).length;

  const categories = useMemo(() => ALL_CATEGORIES, []);
  const currencies = useMemo(
    () => Array.from(new Set([currency, ...transactions.map((t) => t.currency).filter(Boolean)])),
    [currency, transactions]
  );
  const sourceProviders = useMemo(
    () => Array.from(new Set(transactions.map((t) => t.sourceProvider).filter(Boolean))),
    [transactions]
  );
  const selectedUpload = uploads.find((u) => u.id === uploadFilter);

  const serverFilters = useMemo(() => ({
    type: typeFilter,
    uploadId: uploadFilter,
    category: categoryFilter,
    status: statusFilter,
    duplicateStatus: duplicateFilter,
    kpiTreatment: kpiTreatmentFilter,
    currency: currencyFilter,
    sourceProvider: sourceProviderFilter,
  }), [typeFilter, uploadFilter, categoryFilter, statusFilter, duplicateFilter, kpiTreatmentFilter, currencyFilter, sourceProviderFilter]);

  async function fetchTransactions(
    nextFilters: typeof serverFilters,
    offset: number,
    append: boolean
  ) {
    setPageLoading(true);
    const result = await loadTransactionsPage({
      from: initialFrom,
      to: initialTo,
      limit: PAGE_SIZE,
      offset,
      ...nextFilters,
    });
    setPageLoading(false);

    if (result.success && result.transactions) {
      setTransactions((prev) => (append ? mergeUniqueTransactions(prev, result.transactions ?? []) : result.transactions ?? []));
      setTotalCount(result.total ?? result.transactions.length);
    } else if (result.error) {
      setSaveMessage(result.error);
    }
  }

  function applyServerFilter(next: Partial<typeof serverFilters>) {
    const merged = { ...serverFilters, ...next };
    if (next.type !== undefined) setTypeFilter(next.type);
    if (next.uploadId !== undefined) setUploadFilter(next.uploadId);
    if (next.category !== undefined) setCategoryFilter(next.category);
    if (next.status !== undefined) setStatusFilter(next.status);
    if (next.duplicateStatus !== undefined) setDuplicateFilter(next.duplicateStatus);
    if (next.kpiTreatment !== undefined) setKpiTreatmentFilter(next.kpiTreatment);
    if (next.currency !== undefined) setCurrencyFilter(next.currency);
    if (next.sourceProvider !== undefined) setSourceProviderFilter(next.sourceProvider);
    void fetchTransactions(merged, 0, false);
  }

  const filtered = useMemo(() => {
    let data = [...transactions];

    if (search.trim()) {
      const q = search.toLowerCase();
      data = data.filter(
        (t) =>
          (t.merchant ?? "").toLowerCase().includes(q) ||
          (t.description ?? "").toLowerCase().includes(q) ||
          (t.category ?? "").toLowerCase().includes(q)
      );
    }

    if (sort === "newest") {
      data.sort((a, b) => +new Date(b.date) - +new Date(a.date));
    } else if (sort === "oldest") {
      data.sort((a, b) => +new Date(a.date) - +new Date(b.date));
    } else if (sort === "amount-high") {
      data.sort((a, b) => b.amount - a.amount);
    } else if (sort === "amount-low") {
      data.sort((a, b) => a.amount - b.amount);
    }

    return data;
  }, [search, sort, transactions]);

  async function handleCategoryChange(transactionId: string, newCategory: string) {
    setSavingId(transactionId);
    setSaveMessage(null);
    const result = await updateTransactionCategory(transactionId, newCategory);
    setSavingId(null);
    if (result.success) {
      setSaveMessage(result.message);
      // Optimistically update local data
      setTransactions((prev) =>
        prev.map((t) => (t.id === transactionId ? { ...t, category: newCategory } : t))
      );
    } else {
      setSaveMessage(result.message);
    }
  }

  const categorySelectClass =
    "min-h-[44px] w-full max-w-[180px] rounded-lg border bg-[#09090B] py-2 px-3 text-sm text-[#F1F5F9] outline-none focus:border-[#14B8A6]/50 appearance-none cursor-pointer disabled:opacity-50";

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <PageHeader
          title="Transactions"
          subtitle="Smart transaction intelligence with AI categorisation and anomaly detection."
        />
        <div className="shrink-0 flex items-center gap-2">
          <span className="text-sm text-[var(--muted-foreground)]">
            {getDateRange(initialPreset as DateRangePreset, initialFrom, initialTo).label}
          </span>
          {initialPreset !== "allTime" && (
            <a
              href="/transactions?preset=allTime"
              className="text-xs px-2 py-1 rounded-md border border-[var(--border)] text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:border-[var(--accent)]/30 transition-colors"
            >
              All Time
            </a>
          )}
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Total Transactions"
          value={String(total)}
          icon={<CreditCard className="h-5 w-5" />}
          iconColor="#8B5CF6"
        />
        {transactions.length < total && (
          <p className="text-xs text-[var(--muted-foreground)] col-span-full">
            Showing {transactions.length} of {total} total transactions
            {selectedUpload ? ` from ${selectedUpload.fileName}` : " for the selected filters"}.
          </p>
        )}
        <MetricCard
          label="Categorised"
          value={String(categorised)}
          icon={<CheckCircle2 className="h-5 w-5" />}
          iconColor="#22C55E"
        />
        <MetricCard
          label="AI Suggested"
          value={String(aiSuggested)}
          icon={<Brain className="h-5 w-5" />}
          iconColor="#14B8A6"
        />
        <MetricCard
          label="Needs Review"
          value={String(needsReview)}
          icon={<AlertCircle className="h-5 w-5" />}
          iconColor="#FBBF24"
        />
      </div>

      {/* Save message toast */}
      {saveMessage && (
        <div className="flex items-center gap-2 rounded-lg border border-[#22C55E]/20 bg-[#22C55E]/10 px-4 py-2 text-sm text-[#22C55E]">
          <Check className="h-4 w-4" />
          {saveMessage}
        </div>
      )}

      {/* Filters */}
      <SectionCard>
        <div className="p-5">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94A3B8]" />
              <input
                type="text"
                placeholder="Search transactions..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-lg border bg-[#09090B] py-2 pl-9 pr-3 text-sm text-[#F1F5F9] outline-none focus:border-[#14B8A6]/50"
                style={{ borderColor: "rgba(148,163,184,0.16)" }}
              />
            </div>

            <div className="relative">
              <ListFilter className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94A3B8]" />
              <select
                value={typeFilter}
                onChange={(e) => applyServerFilter({ type: e.target.value })}
                className="rounded-lg border bg-[#09090B] py-2 pl-9 pr-8 text-sm text-[#F1F5F9] outline-none focus:border-[#14B8A6]/50 appearance-none"
                style={{ borderColor: "rgba(148,163,184,0.16)" }}
              >
                <option value="all">All Types</option>
                <option value="income">Income</option>
                <option value="expense">Expense</option>
              </select>
            </div>

            <div className="relative">
              <Tag className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94A3B8]" />
              <select
                value={categoryFilter}
                onChange={(e) => applyServerFilter({ category: e.target.value })}
                className="rounded-lg border bg-[#09090B] py-2 pl-9 pr-8 text-sm text-[#F1F5F9] outline-none focus:border-[#14B8A6]/50 appearance-none"
                style={{ borderColor: "rgba(148,163,184,0.16)" }}
              >
                <option value="all">All Categories</option>
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div className="relative">
              <ListFilter className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94A3B8]" />
              <select
                value={uploadFilter}
                onChange={(e) => applyServerFilter({ uploadId: e.target.value })}
                className="rounded-lg border bg-[#09090B] py-2 pl-9 pr-8 text-sm text-[#F1F5F9] outline-none focus:border-[#14B8A6]/50 appearance-none"
                style={{ borderColor: "rgba(148,163,184,0.16)" }}
              >
                <option value="all">All Uploads</option>
                {uploads.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.fileName}
                  </option>
                ))}
              </select>
            </div>

            <div className="relative">
              <ListFilter className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94A3B8]" />
              <select
                value={statusFilter}
                onChange={(e) => applyServerFilter({ status: e.target.value })}
                className="rounded-lg border bg-[#09090B] py-2 pl-9 pr-8 text-sm text-[#F1F5F9] outline-none focus:border-[#14B8A6]/50 appearance-none"
                style={{ borderColor: "rgba(148,163,184,0.16)" }}
              >
                <option value="all">All Statuses</option>
                <option value="categorised">Categorised</option>
                <option value="needs_review">Needs Review</option>
                <option value="ai_suggested">AI Suggested</option>
                <option value="possible_duplicate">Possible Duplicate</option>
                <option value="transfer">Transfer</option>
              </select>
            </div>

            <div className="relative">
              <ListFilter className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94A3B8]" />
              <select
                value={duplicateFilter}
                onChange={(e) => applyServerFilter({ duplicateStatus: e.target.value as DuplicateFilter })}
                className="rounded-lg border bg-[#09090B] py-2 pl-9 pr-8 text-sm text-[#F1F5F9] outline-none focus:border-[#14B8A6]/50 appearance-none"
                style={{ borderColor: "rgba(148,163,184,0.16)" }}
              >
                <option value="all">All Duplicate States</option>
                <option value="duplicates">Duplicates Only</option>
                <option value="not_duplicates">Not Duplicates</option>
              </select>
            </div>

            <div className="relative">
              <ListFilter className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94A3B8]" />
              <select
                value={kpiTreatmentFilter}
                onChange={(e) => applyServerFilter({ kpiTreatment: e.target.value as "all" | "included" | "excluded" })}
                className="rounded-lg border bg-[#09090B] py-2 pl-9 pr-8 text-sm text-[#F1F5F9] outline-none focus:border-[#14B8A6]/50 appearance-none"
                style={{ borderColor: "rgba(148,163,184,0.16)" }}
              >
                <option value="all">All KPI Treatments</option>
                <option value="included">KPI Included</option>
                <option value="excluded">KPI Excluded</option>
              </select>
            </div>

            <div className="relative">
              <ListFilter className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94A3B8]" />
              <select
                value={currencyFilter}
                onChange={(e) => applyServerFilter({ currency: e.target.value })}
                className="rounded-lg border bg-[#09090B] py-2 pl-9 pr-8 text-sm text-[#F1F5F9] outline-none focus:border-[#14B8A6]/50 appearance-none"
                style={{ borderColor: "rgba(148,163,184,0.16)" }}
              >
                <option value="all">All Currencies</option>
                {currencies.map((code) => (
                  <option key={code} value={code}>{code}</option>
                ))}
              </select>
            </div>

            <div className="relative">
              <ListFilter className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94A3B8]" />
              <select
                value={sourceProviderFilter}
                onChange={(e) => applyServerFilter({ sourceProvider: e.target.value })}
                className="rounded-lg border bg-[#09090B] py-2 pl-9 pr-8 text-sm text-[#F1F5F9] outline-none focus:border-[#14B8A6]/50 appearance-none"
                style={{ borderColor: "rgba(148,163,184,0.16)" }}
              >
                <option value="all">All Providers</option>
                {sourceProviders.map((provider) => (
                  <option key={provider} value={provider}>{provider}</option>
                ))}
              </select>
            </div>

            <div className="relative">
              <ArrowUpDown className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94A3B8]" />
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value)}
                className="rounded-lg border bg-[#09090B] py-2 pl-9 pr-8 text-sm text-[#F1F5F9] outline-none focus:border-[#14B8A6]/50 appearance-none"
                style={{ borderColor: "rgba(148,163,184,0.16)" }}
              >
                <option value="newest">Newest First</option>
                <option value="oldest">Oldest First</option>
                <option value="amount-high">Amount: High to Low</option>
                <option value="amount-low">Amount: Low to High</option>
              </select>
            </div>
          </div>
        </div>
      </SectionCard>

      {/* Data Table */}
      <SectionCard title="Transaction List" subtitle={`${filtered.length} transactions`}>
        {/* Desktop Table */}
        <div className="hidden sm:block">
          <DataTable
            columns={[
              {
                key: "sourceRowNumber",
                header: "Row",
                width: "90px",
                render: (row) => (
                  <div>
                    <p className="text-xs font-medium text-[#F1F5F9]">{row.sourceRowNumber ?? "—"}</p>
                    <p className="text-[10px] text-[#94A3B8]">{row.currency ?? currency}</p>
                  </div>
                ),
              },
              {
                key: "date",
                header: "Date",
                width: "110px",
                render: (row) => formatDate(row.date),
              },
              {
                key: "merchant",
                header: "Merchant",
                render: (row) => (
                  <div className="flex items-center gap-2">
                    <MerchantLogo name={row.merchant || ""} size="sm" />
                    <div>
                      <p className="text-sm font-medium text-[#F1F5F9]">{row.merchant}</p>
                      <p className="text-xs text-[#94A3B8]">{row.description}</p>
                      <p className="text-[10px] text-[#64748B] truncate max-w-[240px]">
                        DB {row.id}
                        {row.uploadId ? ` · Upload ${row.uploadId}` : ""}
                        {row.externalTransactionId ? ` · External ${row.externalTransactionId}` : ""}
                      </p>
                    </div>
                  </div>
                ),
              },
              {
                key: "category",
                header: "Category",
                render: (row) => (
                  <select
                    value={row.category || "Uncategorised"}
                    onChange={(e) => handleCategoryChange(row.id, e.target.value)}
                    disabled={savingId === row.id}
                    className={categorySelectClass}
                    style={{ borderColor: "rgba(148,163,184,0.16)" }}
                  >
                    <option value="Uncategorised">Uncategorised</option>
                    {ALL_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                ),
              },
              {
                key: "amount",
                header: "Amount",
                align: "right",
                width: "120px",
                render: (row) => (
                    <span className={row.type === "income" ? "text-[#22C55E]" : "text-[#F1F5F9]"}>
                      {row.type === "income" ? "+" : "-"}
                    {formatCurrency(row.amount, 0, (row.currency || currency) as CurrencyCode)}
                    </span>
                  ),
              },
              {
                key: "status",
                header: "Status",
                width: "130px",
                render: (row) => (
                  <div>
                    <StatusBadge variant={getStatusVariant(row.status)}>
                      {formatStatusLabel(row.status)}
                      {row.rowStatus ? ` · ${formatStatusLabel(row.rowStatus)}` : ""}
                    </StatusBadge>
                    {row.kpiExcluded && (
                      <p className="mt-1 text-[10px] text-violet-300">
                        KPI excluded{row.kpiExclusionReason ? `: ${row.kpiExclusionReason}` : ""}
                      </p>
                    )}
                  </div>
                ),
              },
              {
                key: "confidenceScore",
                header: "Confidence",
                width: "140px",
                render: (row) => (
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 flex-1 rounded-full bg-[#18181B] overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${row.confidenceScore ?? 0}%`,
                          background:
                            (row.confidenceScore ?? 0) >= 95
                              ? "#22C55E"
                              : (row.confidenceScore ?? 0) >= 85
                              ? "#FBBF24"
                              : "#F43F5E",
                        }}
                      />
                    </div>
                    <span className="text-xs text-[#94A3B8] w-8 text-right">{row.confidenceScore}%</span>
                  </div>
                ),
              },
            ]}
            data={filtered}
            keyExtractor={(row) => row.id}
          />
        </div>

        {/* Mobile Cards */}
        <div className="sm:hidden space-y-3">
          {filtered.map((t) => (
            <div key={t.id} className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 min-w-0">
                  <MerchantLogo name={t.merchant || ""} size="sm" />
                  <div className="min-w-0">
                    <p className="font-medium text-[var(--foreground)] truncate text-sm">{t.merchant || t.description}</p>
                    <p className="text-xs text-[var(--muted-foreground)]">
                      {formatDate(t.date)}{t.sourceRowNumber ? ` · Row ${t.sourceRowNumber}` : ""} · {t.currency ?? currency}
                    </p>
                    <p className="text-[10px] text-[var(--muted-foreground)] truncate">DB {t.id}</p>
                  </div>
                </div>
                <span className={`text-sm font-semibold whitespace-nowrap ml-2 ${t.type === "income" ? "text-[#22C55E]" : "text-[var(--foreground)]"}`}>
                  {t.type === "income" ? "+" : "-"}{formatCurrency(t.amount, 0, (t.currency || currency) as CurrencyCode)}
                </span>
              </div>
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <select
                  value={t.category || "Uncategorised"}
                  onChange={(e) => handleCategoryChange(t.id, e.target.value)}
                  disabled={savingId === t.id}
                  className={`${categorySelectClass} max-w-none`}
                  style={{ borderColor: "rgba(148,163,184,0.16)" }}
                >
                  <option value="Uncategorised">Uncategorised</option>
                  {ALL_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
                <StatusBadge variant={getStatusVariant(t.status)}>{formatStatusLabel(t.status)}</StatusBadge>
                {t.kpiExcluded && (
                  <StatusBadge variant="highlight">KPI excluded</StatusBadge>
                )}
              </div>
              <div className="flex items-center gap-2 mt-2">
                <div className="h-1.5 flex-1 rounded-full bg-[#18181B]">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${t.confidenceScore ?? 0}%`,
                      background: (t.confidenceScore ?? 0) >= 95 ? "#22C55E" : (t.confidenceScore ?? 0) >= 85 ? "#FBBF24" : "#F43F5E",
                    }}
                  />
                </div>
                <span className="text-xs text-[#94A3B8] w-8 text-right">{t.confidenceScore}%</span>
              </div>
            </div>
          ))}
          {filtered.length === 0 && (
            <p className="text-center text-[var(--muted-foreground)] text-sm py-10">No transactions found</p>
          )}
        </div>

        {transactions.length < totalCount && (
          <div className="border-t border-[var(--border)] p-4 text-center">
            <button
              onClick={() => fetchTransactions(serverFilters, transactions.length, true)}
              disabled={pageLoading}
              className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm text-[var(--foreground)] hover:border-[var(--accent)]/40 disabled:opacity-50 transition-colors"
            >
              {pageLoading ? "Loading..." : `Load more (${transactions.length} of ${totalCount})`}
            </button>
          </div>
        )}
      </SectionCard>
    </div>
  );
}
