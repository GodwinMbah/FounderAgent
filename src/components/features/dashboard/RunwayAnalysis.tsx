"use client";

import { Card } from "@/components/ui/Card";
import { SectionHeader } from "../shared/SectionHeader";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { formatCurrency } from "@/lib/utils/formatters";
import { useCompanyCurrency } from "@/lib/hooks/useCompanyCurrency";
import { ArrowUpRight, ChevronRight } from "lucide-react";

export function RunwayAnalysis() {
  const { currency } = useCompanyCurrency();
  return (
    <Card padding="none" className="h-full overflow-hidden">
      <div className="p-5">
        <SectionHeader title="Runway Analysis" />

        <div className="mt-3">
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold text-[var(--foreground)] tracking-tight">10.3 months</span>
          </div>
          <div className="mt-1 flex items-center gap-1.5 text-xs">
            <span className="text-[var(--success)] font-bold flex items-center">
              <ArrowUpRight className="h-3 w-3 mr-0.5" />
              1.2 months
            </span>
            <span className="text-[var(--muted-foreground)]">vs last week</span>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-4">
          <div className="rounded-lg border border-[var(--border)] bg-[var(--background)] p-3">
            <p className="text-[10px] font-bold text-[var(--muted-foreground)] uppercase tracking-wider">Monthly Burn</p>
            <p className="mt-1 text-lg font-bold text-[var(--foreground)]">{formatCurrency(152000, 0, currency)}</p>
          </div>
          <div className="rounded-lg border border-[var(--border)] bg-[var(--background)] p-3">
            <p className="text-[10px] font-bold text-[var(--muted-foreground)] uppercase tracking-wider">Cash Balance</p>
            <p className="mt-1 text-lg font-bold text-[var(--foreground)]">{formatCurrency(1420000, 0, currency)}</p>
          </div>
        </div>

        <div className="mt-5 space-y-4">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-semibold text-[var(--foreground)]">Downside</span>
              <span className="text-xs text-[var(--muted-foreground)]">7.1 months</span>
            </div>
            <ProgressBar value={7.1} max={15} color="danger" size="sm" />
          </div>
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-semibold text-[var(--foreground)]">Base Case</span>
              <span className="text-xs text-[var(--muted-foreground)]">10.3 months</span>
            </div>
            <ProgressBar value={10.3} max={15} color="accent" size="sm" />
          </div>
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-semibold text-[var(--foreground)]">Upside</span>
              <span className="text-xs text-[var(--muted-foreground)]">14.6 months</span>
            </div>
            <ProgressBar value={14.6} max={15} color="success" size="sm" />
          </div>
        </div>
      </div>

      <div className="px-5 pb-4">
        <button className="inline-flex items-center gap-1 text-xs font-medium text-[var(--accent)] hover:text-[var(--accent)]/80 transition-colors">
          Model different scenarios <ChevronRight className="h-3 w-3" />
        </button>
      </div>
    </Card>
  );
}
