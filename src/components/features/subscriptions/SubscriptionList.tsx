"use client";

import { Badge } from "@/components/ui/Badge";
import { STATUS_VARIANTS } from "@/lib/utils/constants";
import { formatCurrency, formatDate } from "@/lib/utils/formatters";
import { Repeat, Calendar, CheckCircle, AlertTriangle } from "lucide-react";

interface SubscriptionItem {
  id: string;
  name: string;
  vendor?: string;
  category: string;
  amount: number;
  billingCycle: "monthly" | "quarterly" | "yearly";
  nextBillingDate: Date | string;
  status: string;
}

export function SubscriptionList({ items }: { items: SubscriptionItem[] }) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)]">
        <h2 className="font-semibold text-[var(--foreground)]">All Subscriptions</h2>
        <span className="text-xs text-[var(--muted-foreground)]">{items.length} active tools</span>
      </div>
      <div className="divide-y divide-[var(--border)]">
        {items.map((sub) => (
          <div
            key={sub.id}
            className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between hover:bg-[var(--secondary)]/30 transition-colors"
          >
            <div className="flex items-center gap-4 min-w-0">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--accent)]/10">
                <Repeat className="h-5 w-5 text-[var(--accent)]" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-[var(--foreground)] truncate">{sub.name}</p>
                <p className="text-xs text-[var(--muted-foreground)]">
                  {sub.category} · <span className="capitalize">{sub.billingCycle}</span>
                </p>
              </div>
            </div>
            <div className="flex items-center gap-6 sm:justify-end">
              <div className="flex items-center gap-1.5 text-xs text-[var(--muted-foreground)]">
                <Calendar className="h-3.5 w-3.5" />
                Next: {formatDate(sub.nextBillingDate)}
              </div>
              <div className="text-right">
                <p className="text-sm font-bold text-[var(--foreground)]">{formatCurrency(sub.amount)}</p>
                <p className="text-xs text-[var(--muted-foreground)]">
                  /{sub.billingCycle === "monthly" ? "mo" : sub.billingCycle === "yearly" ? "yr" : "qtr"}
                </p>
              </div>
              <Badge variant={STATUS_VARIANTS[sub.status] ?? "default"} size="sm">
                <span className="flex items-center gap-1">
                  {sub.status === "active" ? (
                    <CheckCircle className="h-3 w-3" />
                  ) : (
                    <AlertTriangle className="h-3 w-3" />
                  )}
                  {sub.status}
                </span>
              </Badge>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
