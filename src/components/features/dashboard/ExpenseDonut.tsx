"use client";

import { Card } from "@/components/ui/Card";
import { SectionHeader } from "../shared/SectionHeader";
import { DonutChart } from "@/components/ui/DonutChart";
import { formatCurrency } from "@/lib/utils/formatters";
import { expenseCategories } from "@/lib/data";
import { ChevronRight } from "lucide-react";
import Link from "next/link";

const donutColors = [
  "#14b8a6",
  "#8b5cf6",
  "#38bdf8",
  "#fbbf24",
  "#f43f5e",
  "#22c55e",
  "#c4b5fd",
  "#22d3ee",
];

export function ExpenseDonut() {
  const total = expenseCategories.reduce((sum, e) => sum + e.amount, 0);
  const segments = expenseCategories.slice(0, 5).map((cat, i) => ({
    label: cat.name,
    value: cat.amount,
    color: donutColors[i % donutColors.length],
  }));

  return (
    <Card padding="none" className="h-full overflow-hidden">
      <div className="p-5">
        <SectionHeader title="Top Expense Categories" subtitle="This month" />
      </div>

      <div className="px-5 pb-5 flex items-center gap-6">
        <DonutChart
          segments={segments}
          size={170}
          strokeWidth={24}
          centerLabel={formatCurrency(total, 0)}
          centerSubLabel="Total Spend"
        />
        <div className="flex-1 space-y-3">
          {segments.map((seg) => (
            <div key={seg.label} className="flex items-center gap-2.5">
              <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: seg.color }} />
              <span className="text-xs text-[var(--foreground)] truncate flex-1">{seg.label}</span>
              <span className="text-xs font-medium text-[var(--muted-foreground)]">
                {((seg.value / total) * 100).toFixed(0)}%
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="px-5 pb-4">
        <Link
          href="/pl-report"
          className="inline-flex items-center gap-1 text-xs font-medium text-[var(--accent)] hover:text-[var(--accent)]/80 transition-colors"
        >
          View full expense report <ChevronRight className="h-3 w-3" />
        </Link>
      </div>
    </Card>
  );
}
