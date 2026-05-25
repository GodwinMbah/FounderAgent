"use client";

import { Card } from "@/components/ui/Card";
import { SectionHeader } from "../shared/SectionHeader";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { formatCurrency } from "@/lib/utils/formatters";
import { subscriptions } from "@/lib/data";
import { ArrowDownRight, ChevronRight } from "lucide-react";
import Link from "next/link";

const subColors = [
  "#14b8a6",
  "#8b5cf6",
  "#38bdf8",
  "#fbbf24",
  "#f43f5e",
  "#22c55e",
  "#c4b5fd",
];

export function SubscriptionSpend() {
  const total = subscriptions.reduce((sum, s) => sum + s.amount, 0);
  const topSubs = subscriptions.slice(0, 5);

  return (
    <Card padding="none" className="h-full overflow-hidden">
      <div className="p-5">
        <div className="flex items-center justify-between">
          <SectionHeader title="Subscription Spend" subtitle="This month" />
        </div>

        <div className="mt-3 flex items-baseline gap-3">
          <span className="text-2xl font-bold text-[var(--foreground)]">{formatCurrency(total)}</span>
          <span className="flex items-center text-[11px] font-bold text-[var(--success)]">
            <ArrowDownRight className="h-3 w-3 mr-0.5" />
            6.3%
          </span>
          <span className="text-[11px] text-[var(--muted-foreground)]">vs last month</span>
        </div>

        <div className="mt-3">
          <ProgressBar value={total} max={35000} color="accent" size="sm" />
        </div>
      </div>

      <div className="px-5 pb-5 space-y-3">
        {topSubs.map((sub, i) => {
          const pct = (sub.amount / total) * 100;
          const color = subColors[i % subColors.length];
          return (
            <div key={sub.id} className="flex items-center gap-3">
              <div
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
                style={{ backgroundColor: `${color}30`, color }}
              >
                {sub.name.slice(0, 2).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-[var(--foreground)] truncate">{sub.name}</span>
                  <span className="text-sm font-semibold text-[var(--foreground)]">{formatCurrency(sub.amount)}</span>
                </div>
                <div className="flex items-center justify-between mt-0.5">
                  <span className="text-[11px] text-[var(--muted-foreground)] capitalize">{sub.billingCycle}</span>
                  <span className="text-[11px] text-[var(--muted-foreground)]">{pct.toFixed(0)}%</span>
                </div>
              </div>
            </div>
          );
        })}
        <div className="flex items-center justify-between pt-2 border-t border-[var(--border)]">
          <span className="text-xs text-[var(--muted-foreground)]">Other ({subscriptions.length - topSubs.length})</span>
          <span className="text-sm font-semibold text-[var(--foreground)]">
            {formatCurrency(subscriptions.slice(5).reduce((s, x) => s + x.amount, 0))}
          </span>
        </div>
      </div>

      <div className="px-5 pb-4">
        <Link
          href="/subscriptions"
          className="inline-flex items-center gap-1 text-xs font-medium text-[var(--accent)] hover:text-[var(--accent)]/80 transition-colors"
        >
          View all subscriptions <ChevronRight className="h-3 w-3" />
        </Link>
      </div>
    </Card>
  );
}
