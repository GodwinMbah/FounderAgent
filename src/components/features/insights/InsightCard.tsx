"use client";

import { Badge } from "@/components/ui/Badge";
import { AlertTriangle, AlertCircle, TrendingUp, Zap } from "lucide-react";

interface InsightCardProps {
  type: "critical" | "warning" | "opportunity" | "info";
  title: string;
  description: string;
  date?: string;
}

const typeConfig = {
  critical: { icon: AlertTriangle, border: "border-[var(--danger)]/20", bg: "bg-[var(--danger)]/5", text: "text-[var(--danger)]" },
  warning: { icon: AlertCircle, border: "border-[var(--warning)]/20", bg: "bg-[var(--warning)]/5", text: "text-[var(--warning)]" },
  opportunity: { icon: TrendingUp, border: "border-[var(--success)]/20", bg: "bg-[var(--success)]/5", text: "text-[var(--success)]" },
  info: { icon: Zap, border: "border-[var(--neon-cyan)]/20", bg: "bg-[var(--neon-cyan)]/5", text: "text-[var(--neon-cyan)]" },
};

export function InsightCard({ type, title, description, date }: InsightCardProps) {
  const config = typeConfig[type];
  const Icon = config.icon;

  return (
    <div className={`rounded-xl border ${config.border} ${config.bg} p-5 shadow-sm hover:shadow-md transition-shadow`}>
      <div className="flex gap-4">
        <div className={`mt-0.5 shrink-0 ${config.text}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <h3 className="text-base font-semibold text-[var(--foreground)]">{title}</h3>
            <div className="flex items-center gap-2 shrink-0">
              <Badge variant={type === "critical" ? "danger" : type === "warning" ? "warning" : type === "opportunity" ? "success" : "info"} size="sm">
                {type}
              </Badge>
              {date && <span className="text-xs text-[var(--muted-foreground)]">{date}</span>}
            </div>
          </div>
          <p className="mt-2 text-sm text-[var(--muted-foreground)] leading-relaxed">
            {description}
          </p>
        </div>
      </div>
    </div>
  );
}
