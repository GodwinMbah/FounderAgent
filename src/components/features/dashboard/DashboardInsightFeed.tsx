"use client";

import { Card } from "@/components/ui/Card";
import { SectionHeader } from "../shared/SectionHeader";
import { Badge } from "@/components/ui/Badge";
import { Sparkles, ChevronRight } from "lucide-react";
import Link from "next/link";

interface Insight {
  id: string;
  priority: "critical" | "warning" | "opportunity" | "info";
  title: string;
  description: string;
  type: string;
}

const typeLabels: Record<string, string> = {
  subscription_increase: "COST OPTIMIZATION",
  cash_flow_warning: "RUNWAY UPDATE",
  revenue_increased_profit_dropped: "RUNWAY UPDATE",
  ad_spend_growth: "REVENUE OPPORTUNITY",
  cost_saving_opportunity: "COST OPTIMIZATION",
  growth_opportunity: "REVENUE OPPORTUNITY",
};

const typeColors: Record<string, { badge: "warning" | "success" | "info" | "danger"; border: string; bg: string }> = {
  "COST OPTIMIZATION": { badge: "warning", border: "border-[var(--warning)]/20", bg: "bg-[var(--warning)]/5" },
  "RUNWAY UPDATE": { badge: "success", border: "border-[var(--success)]/20", bg: "bg-[var(--success)]/5" },
  "REVENUE OPPORTUNITY": { badge: "info", border: "border-[var(--neon-cyan)]/20", bg: "bg-[var(--neon-cyan)]/5" },
  "RISK ALERT": { badge: "danger", border: "border-[var(--danger)]/20", bg: "bg-[var(--danger)]/5" },
};

export function DashboardInsightFeed({ insights }: { insights: Insight[] }) {
  return (
    <Card padding="none" className="h-full overflow-hidden">
      <div className="p-5">
        <div className="flex items-center gap-2 mb-1">
          <Sparkles className="h-4 w-4 text-[var(--highlight)]" />
          <SectionHeader title="AI Insight Feed" />
        </div>
      </div>

      <div className="px-5 pb-5 space-y-3">
        {insights.map((insight) => {
          const label = typeLabels[insight.type] ?? "INSIGHT";
          const colors = typeColors[label] ?? { badge: "info" as const, border: "border-[var(--border)]", bg: "bg-[var(--secondary)]/30" };

          return (
            <div
              key={insight.id}
              className={`rounded-xl border ${colors.border} ${colors.bg} p-4 hover:brightness-110 transition-all`}
            >
              <div className="flex items-center gap-2 mb-2">
                <Badge variant={colors.badge} size="sm">{label}</Badge>
                <span className="text-[10px] text-[var(--muted-foreground)] ml-auto">2h ago</span>
              </div>
              <p className="text-sm font-bold text-[var(--foreground)] leading-snug">
                {insight.title}
              </p>
              <p className="mt-1.5 text-xs text-[var(--muted-foreground)] leading-relaxed line-clamp-2">
                {insight.description}
              </p>
              <Link
                href="/ai-insights"
                className="mt-2.5 inline-flex items-center gap-0.5 text-[11px] font-semibold text-[var(--accent)] hover:underline"
              >
                View recommendation <ChevronRight className="h-3 w-3" />
              </Link>
            </div>
          );
        })}
      </div>

      <div className="px-5 pb-4">
        <Link
          href="/ai-insights"
          className="inline-flex items-center gap-1 text-xs font-medium text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
        >
          View all insights <ChevronRight className="h-3 w-3" />
        </Link>
      </div>
    </Card>
  );
}
