"use client";

import { useState, useMemo } from "react";
import { Check, X, ChevronDown, Building2, Text, KeyRound, CreditCard } from "lucide-react";
import type { SuggestionCardProps } from "./types";

const matchTypeConfig = {
  merchant: { icon: Building2, label: "merchant", color: "text-[var(--sky-blue)]" },
  reference: { icon: Text, label: "reference", color: "text-[var(--soft-lilac)]" },
  keyword: { icon: KeyRound, label: "keyword", color: "text-[var(--warning)]" },
  processor: { icon: CreditCard, label: "processor", color: "text-[var(--neon-cyan)]" },
};

function formatCurrency(amount: number, currency = "USD"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function SuggestionCard({ suggestion, onApprove, onReject, previewRows }: SuggestionCardProps) {
  const [expanded, setExpanded] = useState(false);

  const config = matchTypeConfig[suggestion.matchType];
  const Icon = config.icon;

  const affectedRows = useMemo(
    () => previewRows.filter((r) => suggestion.affectedRowIds.includes(r.rowNumber)),
    [previewRows, suggestion.affectedRowIds]
  );

  const catConf = suggestion.categoryConfidence;
  const confidenceColor =
    catConf >= 90
      ? "bg-[var(--success)]"
      : catConf >= 70
        ? "bg-[var(--warning)]"
        : "bg-[var(--danger)]";

  const isApplied = suggestion.status === "applied";
  const isRejected = suggestion.status === "rejected";
  const isDisabled = isApplied || isRejected;

  return (
    <div
      className={`
        rounded-xl border bg-[var(--card)] transition-all duration-200
        ${isApplied ? "border-[var(--success)]/30" : "border-[var(--border)]"}
        ${isRejected ? "opacity-60" : ""}
        hover:border-[var(--border)]/80
      `}
    >
      <div className="p-4 sm:p-5">
        {/* Main row */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-4">
          {/* Icon */}
          <div
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--secondary)] ${config.color}`}
          >
            <Icon className="h-5 w-5" />
          </div>

          {/* Message */}
          <div className="min-w-0 flex-1">
            <p className="text-sm leading-relaxed text-[var(--foreground)]">
              We found{" "}
              <span className="font-semibold">{suggestion.affectedRowIds.length}</span>{" "}
              similar transactions from{" "}
              <span className="font-semibold">{suggestion.matchValue}</span>. Suggested
              category:{" "}
              <span className="font-semibold">{suggestion.suggestedCategory}</span>.
            </p>

            {/* Reason */}
            {suggestion.reason && (
              <p className="mt-1 text-xs italic text-[var(--muted-foreground)]">
                {suggestion.reason}
              </p>
            )}

            {/* Confidence bars */}
            <div className="mt-3 space-y-2">
              <div>
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className="text-[var(--muted-foreground)]">Category confidence</span>
                  <span className="font-medium text-[var(--foreground)]">{catConf}%</span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--muted)]">
                  <div
                    className={`h-1.5 rounded-full ${confidenceColor} transition-all duration-500`}
                    style={{ width: `${catConf}%` }}
                    role="progressbar"
                    aria-valuenow={catConf}
                    aria-valuemin={0}
                    aria-valuemax={100}
                  />
                </div>
              </div>
              <div>
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className="text-[var(--muted-foreground)]">Group confidence</span>
                  <span className="font-medium text-[var(--foreground)]">{suggestion.groupConfidence}%</span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--muted)]">
                  <div
                    className="h-1.5 rounded-full bg-[var(--accent)] transition-all duration-500"
                    style={{ width: `${suggestion.groupConfidence}%` }}
                    role="progressbar"
                    aria-valuenow={suggestion.groupConfidence}
                    aria-valuemin={0}
                    aria-valuemax={100}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex shrink-0 items-start gap-2">
            {isApplied && (
              <span className="inline-flex items-center rounded-md border border-[var(--success)]/20 bg-[var(--success)]/10 px-2 py-1 text-xs font-semibold text-[var(--success)]">
                Applied
              </span>
            )}
            <button
              onClick={() => onApprove(suggestion.id)}
              disabled={isDisabled}
              aria-label={`Approve suggestion for ${suggestion.matchValue}`}
              className={`
                inline-flex h-8 w-8 items-center justify-center rounded-lg transition-all
                ${
                  isDisabled
                    ? "cursor-not-allowed opacity-40"
                    : "bg-[var(--accent)]/10 text-[var(--accent)] hover:bg-[var(--accent)]/20"
                }
              `}
            >
              <Check className="h-4 w-4" />
            </button>
            <button
              onClick={() => onReject(suggestion.id)}
              disabled={isDisabled}
              aria-label={`Reject suggestion for ${suggestion.matchValue}`}
              className={`
                inline-flex h-8 w-8 items-center justify-center rounded-lg transition-all
                ${
                  isDisabled
                    ? "cursor-not-allowed opacity-40"
                    : "bg-[var(--danger)]/10 text-[var(--danger)] hover:bg-[var(--danger)]/20"
                }
              `}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Expandable affected rows */}
        {affectedRows.length > 0 && (
          <button
            onClick={() => setExpanded((v) => !v)}
            aria-expanded={expanded}
            className="mt-3 flex items-center gap-1 text-xs font-medium text-[var(--muted-foreground)] transition-colors hover:text-[var(--foreground)]"
          >
            <ChevronDown
              className={`h-3.5 w-3.5 transition-transform ${expanded ? "rotate-180" : ""}`}
            />
            {expanded ? "Hide" : "Show"} {affectedRows.length} affected row
            {affectedRows.length === 1 ? "" : "s"}
          </button>
        )}

        {expanded && (
          <div className="mt-3 overflow-hidden rounded-lg border border-[var(--border)]">
            <table className="w-full text-left text-xs">
              <thead className="bg-[var(--secondary)] text-[var(--muted-foreground)]">
                <tr>
                  <th className="px-3 py-2 font-medium">Row</th>
                  <th className="px-3 py-2 font-medium">Date</th>
                  <th className="px-3 py-2 font-medium">Merchant</th>
                  <th className="px-3 py-2 font-medium text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {affectedRows.slice(0, 5).map((row) => (
                  <tr key={row.rowNumber} className="text-[var(--foreground)]">
                    <td className="px-3 py-2 tabular-nums">{row.rowNumber}</td>
                    <td className="px-3 py-2">{row.date}</td>
                    <td className="px-3 py-2">{row.merchant || row.description}</td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {formatCurrency(row.amount, row.currency)}
                    </td>
                  </tr>
                ))}
                {affectedRows.length > 5 && (
                  <tr>
                    <td
                      colSpan={4}
                      className="px-3 py-2 text-center text-[var(--muted-foreground)]"
                    >
                      +{affectedRows.length - 5} more
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
