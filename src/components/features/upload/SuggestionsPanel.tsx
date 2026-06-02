"use client";

import { useState } from "react";
import { Sparkles, CheckCheck, X, ChevronDown, ChevronUp } from "lucide-react";
import { SuggestionCard } from "./SuggestionCard";
import type { SuggestionsPanelProps } from "./types";

export function SuggestionsPanel({
  suggestions,
  onApprove,
  onReject,
  onApproveAll,
  onDismissAll,
  previewRows,
}: SuggestionsPanelProps) {
  const [collapsed, setCollapsed] = useState(false);

  const pendingCount = suggestions.filter((s) => s.status === "pending").length;
  const appliedCount = suggestions.filter((s) => s.status === "applied").length;

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--card)]">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3 sm:px-5 sm:py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--accent)]/10">
            <Sparkles className="h-4 w-4 text-[var(--accent)]" />
          </div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-[var(--foreground)]">Smart Suggestions</h3>
            {pendingCount > 0 && (
              <span className="inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-[var(--accent)] px-1.5 text-[11px] font-bold text-[var(--accent-foreground)]">
                {pendingCount}
              </span>
            )}
            {appliedCount > 0 && (
              <span className="inline-flex items-center rounded-md border border-[var(--success)]/20 bg-[var(--success)]/10 px-2 py-0.5 text-[11px] font-semibold text-[var(--success)]">
                {appliedCount} auto-applied
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {pendingCount > 0 && (
            <>
              <button
                onClick={onApproveAll}
                className="hidden sm:inline-flex items-center gap-1.5 rounded-lg bg-[var(--accent)] px-3 py-1.5 text-xs font-semibold text-[var(--accent-foreground)] transition-all hover:bg-[var(--accent)]/90"
              >
                <CheckCheck className="h-3.5 w-3.5" />
                Approve All
              </button>
              <button
                onClick={onDismissAll}
                className="hidden sm:inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-1.5 text-xs font-semibold text-[var(--foreground)] transition-all hover:bg-[var(--secondary)]"
              >
                <X className="h-3.5 w-3.5" />
                Dismiss All
              </button>
            </>
          )}
          <button
            onClick={() => setCollapsed((v) => !v)}
            aria-expanded={!collapsed}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[var(--muted-foreground)] transition-colors hover:bg-[var(--secondary)] hover:text-[var(--foreground)]"
          >
            {collapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Mobile bulk actions (visible when not collapsed) */}
      {!collapsed && pendingCount > 0 && (
        <div className="flex items-center gap-2 border-b border-[var(--border)] px-4 py-2 sm:hidden">
          <button
            onClick={onApproveAll}
            className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-[var(--accent)] px-3 py-2 text-xs font-semibold text-[var(--accent-foreground)] transition-all hover:bg-[var(--accent)]/90"
          >
            <CheckCheck className="h-3.5 w-3.5" />
            Approve All
          </button>
          <button
            onClick={onDismissAll}
            className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-xs font-semibold text-[var(--foreground)] transition-all hover:bg-[var(--secondary)]"
          >
            <X className="h-3.5 w-3.5" />
            Dismiss All
          </button>
        </div>
      )}

      {/* Cards */}
      {!collapsed && (
        <div className="max-h-[480px] space-y-3 overflow-y-auto p-3 sm:p-4">
          {suggestions.length === 0 ? (
            <div className="py-8 text-center">
              <p className="text-sm text-[var(--muted-foreground)]">
                No smart suggestions available for this upload.
              </p>
            </div>
          ) : (
            suggestions.map((suggestion) => (
              <SuggestionCard
                key={suggestion.id}
                suggestion={suggestion}
                onApprove={onApprove}
                onReject={onReject}
                previewRows={previewRows}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}
