"use client";

import { useState, useEffect, useRef } from "react";
import { Check, X, Save } from "lucide-react";
import type { ApplyToSimilarConfirmProps } from "./types";

const matchTypeLabels: Record<ApplyToSimilarConfirmProps["matchType"], string> = {
  merchant: "merchant",
  reference: "reference",
  keyword: "keyword",
  processor: "processor",
};

function formatCurrency(amount: number, currency = "GBP"): string {
  return new Intl.NumberFormat(currency === "GBP" ? "en-GB" : "en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function ApplyToSimilarConfirm({
  category,
  count,
  matchType,
  matchValue,
  affectedRows,
  onApply,
  onCancel,
}: ApplyToSimilarConfirmProps) {
  const [saveAsRule, setSaveAsRule] = useState(true);
  const dialogRef = useRef<HTMLDivElement>(null);

  // Focus trap & escape key
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;
    dialog.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onCancel();
      }
      if (e.key === "Tab") {
        const focusable = dialog.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      previouslyFocused?.focus();
    };
  }, [onCancel]);

  const visibleRows = affectedRows.slice(0, 3);
  const remaining = count - visibleRows.length;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm sm:p-6"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="apply-similar-title"
        className="w-full max-w-md rounded-xl border border-[var(--border)] bg-[var(--card)] shadow-2xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-4">
          <h4 id="apply-similar-title" className="text-sm font-semibold text-[var(--foreground)]">
            Apply to similar transactions
          </h4>
          <button
            onClick={onCancel}
            aria-label="Close"
            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-[var(--muted-foreground)] transition-colors hover:bg-[var(--secondary)] hover:text-[var(--foreground)]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="space-y-4 px-5 py-4">
          <p className="text-sm leading-relaxed text-[var(--foreground)]">
            Apply <span className="font-semibold">&ldquo;{category}&rdquo;</span> to{" "}
            <span className="font-semibold">{count}</span> similar transactions?
          </p>

          <div className="rounded-lg border border-[var(--border)] bg-[var(--secondary)]/50 px-3 py-2">
            <p className="text-xs text-[var(--muted-foreground)]">
              Matched by <span className="font-semibold text-[var(--foreground)]">{matchTypeLabels[matchType]}</span>:{" "}
              <span className="font-semibold text-[var(--foreground)]">{matchValue}</span>
            </p>
          </div>

          {/* Affected rows */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-[var(--muted-foreground)]">Affected rows</p>
            <div className="space-y-1.5">
              {visibleRows.map((row) => (
                <div
                  key={row.rowNumber}
                  className="flex items-center justify-between rounded-md border border-[var(--border)] bg-[var(--secondary)]/30 px-3 py-2 text-xs"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="tabular-nums text-[var(--muted-foreground)]">#{row.rowNumber}</span>
                    <span className="truncate text-[var(--foreground)]">
                      {row.merchant || row.description}
                    </span>
                  </div>
                  <span className="shrink-0 tabular-nums text-[var(--foreground)]">
                    {formatCurrency(row.amount, row.currency)}
                  </span>
                </div>
              ))}
              {remaining > 0 && (
                <p className="px-1 text-xs text-[var(--muted-foreground)]">
                  +{remaining} more
                </p>
              )}
            </div>
          </div>

          {/* Save as rule */}
          <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--secondary)]/30 px-3 py-2.5 transition-colors hover:bg-[var(--secondary)]/50">
            <input
              type="checkbox"
              checked={saveAsRule}
              onChange={(e) => setSaveAsRule(e.target.checked)}
              className="h-4 w-4 rounded border-[var(--border)] bg-[var(--card)] text-[var(--accent)] accent-[var(--accent)]"
            />
            <Save className="h-3.5 w-3.5 text-[var(--muted-foreground)]" />
            <span className="text-xs text-[var(--foreground)]">Save as rule for future uploads</span>
          </label>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 border-t border-[var(--border)] px-5 py-4">
          <button
            onClick={onCancel}
            className="inline-flex items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--card)] px-4 py-2 text-xs font-semibold text-[var(--foreground)] transition-all hover:bg-[var(--secondary)]"
          >
            Cancel
          </button>
          <button
            onClick={() => onApply(saveAsRule)}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-[var(--accent)] px-4 py-2 text-xs font-semibold text-[var(--accent-foreground)] transition-all hover:bg-[var(--accent)]/90"
          >
            <Check className="h-3.5 w-3.5" />
            Apply
          </button>
        </div>
      </div>
    </div>
  );
}
