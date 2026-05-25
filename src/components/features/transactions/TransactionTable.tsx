"use client";

import { Badge } from "@/components/ui/Badge";
import { STATUS_VARIANTS } from "@/lib/utils/constants";
import { formatCurrency, formatDate } from "@/lib/utils/formatters";
import { Eye } from "lucide-react";
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

export function TransactionTable({ rows }: { rows: TransactionRow[] }) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] overflow-hidden">
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
            {rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-5 py-10 text-center text-[var(--muted-foreground)]">
                  No transactions found
                </td>
              </tr>
            ) : (
              rows.map((txn) => (
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
                    <button className="rounded-lg p-2 hover:bg-[var(--secondary)] transition-colors text-[var(--muted-foreground)]">
                      <Eye className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
