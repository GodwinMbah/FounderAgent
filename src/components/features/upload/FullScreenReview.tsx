"use client";

import { useState, useMemo } from "react";
import {
  X,
  Search,
  Filter,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  TrendingDown,
  Shuffle,
  Zap,
  Calendar,
  CreditCard,
  HelpCircle,
} from "lucide-react";
import type { PreviewRow } from "@/lib/upload/wizard-types";
import type { PatternSuggestion } from "./types";
import { SuggestionCard } from "./SuggestionCard";

interface FullScreenReviewProps {
  open: boolean;
  onClose: () => void;
  suggestions: PatternSuggestion[];
  previewRows: PreviewRow[];
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  onApproveAll: () => void;
  onDismissAll: () => void;
}

type FilterTab = "all" | "pending" | "applied" | "rejected" | "high" | "medium" | "low" | "income" | "expense" | "transfer";

const TABS: { key: FilterTab; label: string; icon?: React.ReactNode }[] = [
  { key: "all", label: "All" },
  { key: "pending", label: "Pending" },
  { key: "applied", label: "Auto-Applied" },
  { key: "rejected", label: "Rejected" },
  { key: "high", label: "High Confidence" },
  { key: "medium", label: "Medium Confidence" },
  { key: "low", label: "Low Confidence" },
  { key: "income", label: "Income", icon: <TrendingUp className="h-3.5 w-3.5" /> },
  { key: "expense", label: "Expense", icon: <TrendingDown className="h-3.5 w-3.5" /> },
  { key: "transfer", label: "Transfer", icon: <Shuffle className="h-3.5 w-3.5" /> },
];

const REVIEW_CATEGORIES = new Set(["Uncategorised Review", "Needs Review", "Ambiguous"]);
const TRANSFER_CATEGORIES = new Set(["Transfers", "Internal Transfer", "International Transfer", "Money Transfer", "Credit Card Payment", "Loan Repayment"]);

export function FullScreenReview({
  open,
  onClose,
  suggestions,
  previewRows,
  onApprove,
  onReject,
  onApproveAll,
  onDismissAll,
}: FullScreenReviewProps) {
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<FilterTab>("all");

  const stats = useMemo(() => {
    const total = previewRows.length;
    const autoApplied = previewRows.filter((r) => !REVIEW_CATEGORIES.has(r.category) && (r.categoryConfidence ?? r.confidenceScore) >= 90).length;
    const pending = previewRows.filter((r) => !REVIEW_CATEGORIES.has(r.category) && (r.categoryConfidence ?? r.confidenceScore) >= 70 && (r.categoryConfidence ?? r.confidenceScore) < 90).length;
    const needsReview = previewRows.filter(
      (r) => REVIEW_CATEGORIES.has(r.category) || r.status === "needs_review" || (r.categoryConfidence ?? r.confidenceScore) < 70
    ).length;
    const recurring = previewRows.filter((r) => r.isRecurringCandidate || r.isSubscriptionCandidate).length;
    const transfers = previewRows.filter((r) => TRANSFER_CATEGORIES.has(r.category) || r.status === "transfer").length;
    const creditCards = previewRows.filter((r) => r.category === "Credit Card Payment" || r.isCreditCardRepayment).length;
    const ambiguous = previewRows.filter((r) => r.category === "Ambiguous").length;
    return { total, autoApplied, pending, needsReview, recurring, transfers, creditCards, ambiguous };
  }, [previewRows]);

  const filteredSuggestions = useMemo(() => {
    let result = suggestions;

    // Tab filter
    switch (activeTab) {
      case "pending":
        result = result.filter((s) => s.status === "pending");
        break;
      case "applied":
        result = result.filter((s) => s.status === "applied");
        break;
      case "rejected":
        result = result.filter((s) => s.status === "rejected");
        break;
      case "high":
        result = result.filter((s) => s.categoryConfidence >= 90);
        break;
      case "medium":
        result = result.filter((s) => s.categoryConfidence >= 70 && s.categoryConfidence < 90);
        break;
      case "low":
        result = result.filter((s) => s.categoryConfidence < 70);
        break;
      case "income":
        result = result.filter((s) =>
          s.affectedRowIds.some((id) => previewRows.find((r) => r.rowNumber === id)?.type === "income")
        );
        break;
      case "expense":
        result = result.filter((s) =>
          s.affectedRowIds.some((id) => previewRows.find((r) => r.rowNumber === id)?.type === "expense")
        );
        break;
      case "transfer":
        result = result.filter((s) => TRANSFER_CATEGORIES.has(s.suggestedCategory));
        break;
    }

    // Search filter
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (s) =>
          s.matchValue.toLowerCase().includes(q) ||
          s.suggestedCategory.toLowerCase().includes(q) ||
          s.reason.toLowerCase().includes(q) ||
          s.affectedRowIds.some((id) => {
            const row = previewRows.find((r) => r.rowNumber === id);
            return (
              row?.merchant?.toLowerCase().includes(q) ||
              row?.description?.toLowerCase().includes(q) ||
              row?.category?.toLowerCase().includes(q)
            );
          })
      );
    }

    return result;
  }, [suggestions, activeTab, search, previewRows]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[var(--background)]">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3 sm:px-6">
        <div>
          <h2 className="text-lg font-semibold text-[var(--foreground)]">Smart Suggestions Review</h2>
          <p className="text-xs text-[var(--muted-foreground)]">
            Review and approve category suggestions before importing
          </p>
        </div>
        <button
          onClick={onClose}
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--border)] text-[var(--muted-foreground)] transition-colors hover:bg-[var(--secondary)] hover:text-[var(--foreground)]"
        >
          <X className="h-5 w-5" />
        </button>
      </header>

      {/* Stats bar */}
      <div className="grid grid-cols-2 gap-2 border-b border-[var(--border)] bg-[var(--secondary)]/30 px-4 py-3 sm:grid-cols-4 sm:px-6 lg:grid-cols-8">
        <StatItem label="Total rows" value={stats.total} icon={<Filter className="h-3.5 w-3.5" />} />
        <StatItem label="Auto-categorised" value={stats.autoApplied} icon={<CheckCircle2 className="h-3.5 w-3.5 text-[var(--success)]" />} />
        <StatItem label="Suggested" value={stats.pending} icon={<Zap className="h-3.5 w-3.5 text-[var(--warning)]" />} />
        <StatItem label="Needs review" value={stats.needsReview} icon={<AlertCircle className="h-3.5 w-3.5 text-[var(--danger)]" />} />
        <StatItem label="Recurring" value={stats.recurring} icon={<Calendar className="h-3.5 w-3.5" />} />
        <StatItem label="Transfers" value={stats.transfers} icon={<Shuffle className="h-3.5 w-3.5" />} />
        <StatItem label="Credit card" value={stats.creditCards} icon={<CreditCard className="h-3.5 w-3.5" />} />
        <StatItem label="Ambiguous" value={stats.ambiguous} icon={<HelpCircle className="h-3.5 w-3.5" />} />
      </div>

      {/* Toolbar */}
      <div className="flex flex-col gap-3 border-b border-[var(--border)] px-4 py-3 sm:flex-row sm:items-center sm:px-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted-foreground)]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search merchant, description, reference, category..."
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--card)] py-2 pl-9 pr-4 text-sm text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:border-[var(--accent)] focus:outline-none"
          />
        </div>
        <div className="flex gap-2">
          <button
            onClick={onApproveAll}
            className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
          >
            Approve All
          </button>
          <button
            onClick={onDismissAll}
            className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--muted-foreground)] transition-colors hover:bg-[var(--secondary)]"
          >
            Dismiss All
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 overflow-x-auto border-b border-[var(--border)] px-4 py-2 sm:px-6">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex shrink-0 items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              activeTab === tab.key
                ? "bg-[var(--accent)]/10 text-[var(--accent)]"
                : "text-[var(--muted-foreground)] hover:bg-[var(--secondary)] hover:text-[var(--foreground)]"
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-6">
        {filteredSuggestions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-[var(--muted-foreground)]">
            <Filter className="mb-3 h-10 w-10 opacity-30" />
            <p className="text-sm">No suggestions match the current filter.</p>
            {search && (
              <button
                onClick={() => { setSearch(""); setActiveTab("all"); }}
                className="mt-2 text-sm text-[var(--accent)] hover:underline"
              >
                Clear filters
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-xs text-[var(--muted-foreground)]">
              Showing {filteredSuggestions.length} suggestion{filteredSuggestions.length === 1 ? "" : "s"}
            </p>
            {filteredSuggestions.map((s) => (
              <SuggestionCard
                key={s.id}
                suggestion={s}
                onApprove={onApprove}
                onReject={onReject}
                previewRows={previewRows}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StatItem({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 rounded-md bg-[var(--card)] px-3 py-2">
      {icon}
      <div>
        <p className="text-lg font-semibold leading-none text-[var(--foreground)]">{value}</p>
        <p className="mt-0.5 text-[10px] uppercase tracking-wider text-[var(--muted-foreground)]">{label}</p>
      </div>
    </div>
  );
}
