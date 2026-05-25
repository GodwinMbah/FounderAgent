"use client";

import { Card } from "@/components/ui/Card";
import { SectionHeader } from "../shared/SectionHeader";
import { LineChart } from "@/components/ui/LineChart";
import { ChevronRight, ChevronDown } from "lucide-react";

const cashFlowData = [
  { label: "May", actual: 32000, forecast: 32000 },
  { label: "Jun", actual: 34500, forecast: 35000 },
  { label: "Jul", actual: 38000, forecast: 39000 },
  { label: "Aug", actual: 41000, forecast: 43000 },
  { label: "Sep", actual: 48250, forecast: 46000 },
  { label: "Oct", actual: 48250, forecast: 48000 },
];

export function CashFlowChart() {
  return (
    <Card padding="none" className="h-full overflow-hidden">
      <div className="p-5">
        <div className="flex items-center justify-between">
          <SectionHeader title="Cash Flow" subtitle="Actual vs Forecast" />
          <button className="flex items-center gap-1 rounded-md border border-[var(--border)] bg-[var(--background)] px-2.5 py-1 text-[11px] font-medium text-[var(--muted-foreground)]">
            Next 6 months <ChevronDown className="h-3 w-3" />
          </button>
        </div>

        <div className="mt-1 flex items-center gap-4">
          <span className="flex items-center gap-1.5 text-[11px] text-[var(--muted-foreground)]">
            <span className="h-1.5 w-3 rounded-full bg-[var(--accent)]" />
            Actual
          </span>
          <span className="flex items-center gap-1.5 text-[11px] text-[var(--muted-foreground)]">
            <span className="h-1.5 w-3 rounded-full bg-[var(--soft-lilac)]" />
            Forecast
          </span>
        </div>
      </div>

      <div className="px-5 pb-2 overflow-x-auto">
        <LineChart data={cashFlowData} width={520} height={180} />
      </div>

      <div className="px-5 pb-4">
        <button className="inline-flex items-center gap-1 text-xs font-medium text-[var(--accent)] hover:text-[var(--accent)]/80 transition-colors">
          View cash flow report <ChevronRight className="h-3 w-3" />
        </button>
      </div>
    </Card>
  );
}
