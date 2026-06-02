"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { STATUS_VARIANTS } from "@/lib/utils/constants";
import { formatCurrency, formatDate } from "@/lib/utils/formatters";
import { Eye, X } from "lucide-react";
import { MerchantAvatar } from "@/components/features/transaction/MerchantAvatar";

interface TransactionRow {
  id: string;
  date: Date | string;
  merchant?: string;
  description: string;
  category: string;
  type: "income" | "expense";
  amount: number;
  status: string;
  confidenceScore?: number;
}

function TransactionDetailModal({ txn, onClose }: { txn: TransactionRow; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-[var(--foreground)]">Transaction Details</h3>
          <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-[var(--secondary)] transition-colors text-[var(--muted-foreground)]">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <MerchantAvatar name={txn.merchant || txn.description} size="md" />
            <div>
              <p className="font-semibold text-[var(--foreground)]">{txn.merchant || txn.description}</p>
              <p className="text-xs text-[var(--muted-foreground)]">{txn.description}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-lg bg-[var(--secondary)]/40 p-3">
              <p className="text-xs text-[var(--muted-foreground)] mb-1">Date</p>
              <p className="font-medium text-[var(--foreground)]">{formatDate(txn.date)}</p>
            </div>
            <div className="rounded-lg bg-[var(--secondary)]/40 p-3">
              <p className="text-xs text-[var(--muted-foreground)] mb-1">Amount</p>
              <p className={`font-bold ${txn.type === "income" ? "text-[var(--success)]" : "text-[var(--danger)]"}`}>
                {txn.type === "income" ? "+" : "-"}{formatCurrency(txn.amount)}
              </p>
            </div>
            <div className="rounded-lg bg-[var(--secondary)]/40 p-3">
              <p className="text-xs text-[var(--muted-foreground)] mb-1">Category</p>
              <Badge variant="outline" size="sm">{txn.category}</Badge>
            </div>
            <div className="rounded-lg bg-[var(--secondary)]/40 p-3">
              <p className="text-xs text-[var(--muted-foreground)] mb-1">Status</p>
              <Badge variant={STATUS_VARIANTS[txn.status] ?? "default"} size="sm">
                {txn.status === "Needs Review" ? "Review" : txn.status}
              </Badge>
            </div>
          </div>
          <div className="rounded-lg bg-[var(--secondary)]/40 p-3">
            <p className="text-xs text-[var(--muted-foreground)] mb-1">Confidence Score</p>
            <div className="flex items-center gap-2">
              <div className="h-2 w-full rounded-full bg-[var(--muted)]">
                <div
                  className={`h-full rounded-full ${
                    (txn.confidenceScore || 0) >= 80
                      ? "bg-[var(--success)]"
                      : (txn.confidenceScore || 0) >= 60
                      ? "bg-[var(--warning)]"
                      : "bg-[var(--danger)]"
                  }`}
                  style={{ width: `${txn.confidenceScore || 0}%` }}
                />
              </div>
              <span className="text-xs font-medium text-[var(--foreground)]">{txn.confidenceScore || 0}%</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function TransactionTable({ rows }: { rows: TransactionRow[] }) {
  const [selectedTxn, setSelectedTxn] = useState<TransactionRow | null>(null);

  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] overflow-hidden">
        <div className="px-5 py-10 text-center text-[var(--muted-foreground)]">
          No transactions found
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Desktop Table */}
      <div className="hidden sm:block rounded-xl border border-[var(--border)] bg-[var(--card)] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] bg-[var(--secondary)]/50">
                <th className="px-5 py-3 text-left font-semibold text-[var(--muted-foreground)] text-xs uppercase tracking-wider">Date</th>
                <th className="px-5 py-3 text-left font-semibold text-[var(--muted-foreground)] text-xs uppercase tracking-wider">Merchant</th>
                <th className="px-5 py-3 text-left font-semibold text-[var(--muted-foreground)] text-xs uppercase tracking-wider">Category</th>
                <th className="px-5 py-3 text-right font-semibold text-[var(--muted-foreground)] text-xs uppercase tracking-wider">Amount</th>
                <th className="px-5 py-3 text-center font-semibold text-[var(--muted-foreground)] text-xs uppercase tracking-wider">Status</th>
                <th className="px-5 py-3 text-center font-semibold text-[var(--muted-foreground)] text-xs uppercase tracking-wider">Confidence</th>
                <th className="px-5 py-3 text-center font-semibold text-[var(--muted-foreground)] text-xs uppercase tracking-wider"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {rows.map((txn) => (
                <tr key={txn.id} className="hover:bg-[var(--secondary)]/30 transition-colors">
                  <td className="px-5 py-4 text-xs text-[var(--muted-foreground)] whitespace-nowrap">
                    {formatDate(txn.date)}
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <MerchantAvatar name={txn.merchant || txn.description} size="sm" />
                      <div>
                        <p className="font-medium text-[var(--foreground)] truncate max-w-[180px]">
                          {txn.merchant || txn.description}
                        </p>
                        <p className="text-xs text-[var(--muted-foreground)] truncate max-w-[180px]">
                          {txn.description}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <Badge variant="outline" size="sm">
                      {txn.category}
                    </Badge>
                  </td>
                  <td className="px-5 py-4 text-right font-semibold whitespace-nowrap">
                    <span className={txn.type === "income" ? "text-[var(--success)]" : "text-[var(--danger)]"}>
                      {txn.type === "income" ? "+" : "-"}
                      {formatCurrency(txn.amount)}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-center">
                    <Badge variant={STATUS_VARIANTS[txn.status] ?? "default"} size="sm">
                      {txn.status === "Needs Review" ? "Review" : txn.status}
                    </Badge>
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex items-center justify-center gap-2">
                      <div className="h-2 w-14 rounded-full bg-[var(--muted)]">
                        <div
                          className={`h-full rounded-full ${
                            (txn.confidenceScore || 0) >= 80
                              ? "bg-[var(--success)]"
                              : (txn.confidenceScore || 0) >= 60
                              ? "bg-[var(--warning)]"
                              : "bg-[var(--danger)]"
                          }`}
                          style={{ width: `${txn.confidenceScore || 0}%` }}
                        />
                      </div>
                      <span className="w-7 text-right text-xs font-medium text-[var(--foreground)]">
                        {txn.confidenceScore || 0}
                      </span>
                    </div>
                  </td>
                  <td className="px-5 py-4 text-center">
                    <button
                      onClick={() => setSelectedTxn(txn)}
                      className="rounded-lg p-2 hover:bg-[var(--secondary)] transition-colors text-[var(--muted-foreground)]"
                      title="View details"
                    >
                      <Eye className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile Cards */}
      <div className="sm:hidden space-y-3">
        {rows.map((txn) => (
          <button
            key={txn.id}
            onClick={() => setSelectedTxn(txn)}
            className="w-full text-left rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 hover:border-[var(--highlight)]/20 transition-colors"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 min-w-0">
                <MerchantAvatar name={txn.merchant || txn.description} size="sm" />
                <div className="min-w-0">
                  <p className="font-medium text-[var(--foreground)] truncate text-sm">{txn.merchant || txn.description}</p>
                  <p className="text-xs text-[var(--muted-foreground)]">{formatDate(txn.date)}</p>
                </div>
              </div>
              <span className={`text-sm font-semibold whitespace-nowrap ml-2 ${txn.type === "income" ? "text-[var(--success)]" : "text-[var(--danger)]"}`}>
                {txn.type === "income" ? "+" : "-"}{formatCurrency(txn.amount)}
              </span>
            </div>
            <div className="flex items-center gap-2 mt-2">
              <Badge variant="outline" size="sm">{txn.category}</Badge>
              <Badge variant={STATUS_VARIANTS[txn.status] ?? "default"} size="sm">
                {txn.status === "Needs Review" ? "Review" : txn.status}
              </Badge>
            </div>
          </button>
        ))}
      </div>

      {selectedTxn && <TransactionDetailModal txn={selectedTxn} onClose={() => setSelectedTxn(null)} />}
    </>
  );
}
