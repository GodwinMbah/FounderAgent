"use client";

import { ReactNode } from "react";
import { ArrowUpRight, ArrowDownRight, Minus } from "lucide-react";

interface MetricCardProps {
  label: string;
  value: string;
  change?: string;
  changeType?: "positive" | "negative" | "neutral";
  icon?: ReactNode;
  iconColor?: string;
  className?: string;
}

export function MetricCard({
  label,
  value,
  change,
  changeType = "neutral",
  icon,
  iconColor = "var(--accent)",
  className = "",
}: MetricCardProps) {
  const changeColor =
    changeType === "positive"
      ? "text-[var(--success)]"
      : changeType === "negative"
      ? "text-[var(--danger)]"
      : "text-[var(--muted-foreground)]";

  return (
    <div
      className={`group relative overflow-hidden rounded-xl border border-[var(--border)] p-5 transition-all duration-300 hover:border-[var(--accent)]/15 ${className}`}
      style={{
        background: "linear-gradient(165deg, rgba(17,24,39,0.95) 0%, rgba(9,9,11,0.98) 50%, rgba(15,23,42,0.92) 100%)",
      }}
    >
      <div className="absolute inset-x-0 top-0 h-[1.5px] bg-gradient-to-r from-transparent via-[var(--accent)]/0 to-transparent group-hover:via-[var(--accent)]/30 transition-all duration-500" />
      <div
        className="absolute -top-10 -right-10 h-20 w-20 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-500"
        style={{ background: `radial-gradient(circle, ${iconColor}12 0%, transparent 70%)`, filter: "blur(12px)" }}
      />

      <div className="relative flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wider">
            {label}
          </p>
          <p className="mt-3 text-[28px] font-bold text-[var(--foreground)] tracking-tight leading-none">
            {value}
          </p>
          {change && (
            <div className="mt-2 flex items-center gap-1">
              {changeType === "positive" ? (
                <ArrowUpRight className="h-3 w-3 text-[var(--success)]" />
              ) : changeType === "negative" ? (
                <ArrowDownRight className="h-3 w-3 text-[var(--danger)]" />
              ) : (
                <Minus className="h-3 w-3 text-[var(--muted-foreground)]" />
              )}
              <span className={`text-xs font-bold ${changeColor}`}>{change}</span>
            </div>
          )}
        </div>
        {icon && (
          <div
            className="flex h-10 w-10 items-center justify-center rounded-lg border shrink-0 ml-3 transition-all duration-300 group-hover:scale-105"
            style={{
              borderColor: `${iconColor}25`,
              background: `linear-gradient(135deg, ${iconColor}12 0%, ${iconColor}04 100%)`,
              boxShadow: `0 0 12px ${iconColor}08`,
            }}
          >
            {icon}
          </div>
        )}
      </div>
    </div>
  );
}
