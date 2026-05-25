"use client";

import { Sparkline } from "@/components/ui/Sparkline";
import { formatCurrency, formatPercent, formatNumber } from "@/lib/utils/formatters";
import { Wallet, TrendingUp, TrendingDown, Zap, Percent, Flame, Clock, Heart, ArrowUpRight, ArrowDownRight } from "lucide-react";

interface KpiItem {
  label: string;
  value: number;
  change?: number;
  changeLabel?: string;
  format?: "currency" | "percent" | "number" | "runway";
  icon: "wallet" | "trending-up" | "trending-down" | "zap" | "percent" | "flame" | "clock" | "heart";
  sparkline: number[];
  sparkColor: string;
  iconColor: string;
}

const iconMap = {
  wallet: Wallet,
  "trending-up": TrendingUp,
  "trending-down": TrendingDown,
  zap: Zap,
  percent: Percent,
  flame: Flame,
  clock: Clock,
  heart: Heart,
};

function formatValue(item: KpiItem): string {
  switch (item.format) {
    case "currency":
      return formatCurrency(item.value);
    case "percent":
      return formatPercent(item.value);
    case "runway":
      if (!Number.isFinite(item.value)) return "Infinite";
      if (item.value < 1) return "< 1 mo";
      if (item.value < 12) return `${Math.round(item.value)} months`;
      return `${(item.value / 12).toFixed(1)} years`;
    default:
      return formatNumber(item.value);
  }
}

export function KpiGrid({ items }: { items: KpiItem[] }) {
  return (
    <div className="grid gap-5 grid-cols-2 lg:grid-cols-4">
      {items.map((item, idx) => {
        const Icon = iconMap[item.icon];
        const isPositive = (item.change ?? 0) >= 0;
        const hasTrend = item.change !== undefined || item.changeLabel;
        return (
          <div
            key={idx}
            className="group relative overflow-hidden rounded-xl border border-[var(--border)] p-4 transition-all duration-300 hover:border-[var(--accent)]/15 card-glow-teal"
            style={{
              background: "linear-gradient(160deg, rgba(17,24,39,0.95) 0%, rgba(9,9,11,0.98) 60%, rgba(15,23,42,0.9) 100%)",
            }}
          >
            {/* Top accent glow line */}
            <div className="absolute inset-x-0 top-0 h-[1.5px] bg-gradient-to-r from-transparent via-[var(--accent)]/0 to-transparent group-hover:via-[var(--accent)]/30 transition-all duration-500" />

            {/* Subtle ambient corner glow */}
            <div
              className="absolute -top-10 -right-10 h-20 w-20 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-500"
              style={{ background: `radial-gradient(circle, ${item.iconColor}15 0%, transparent 70%)`, filter: "blur(12px)" }}
            />

            <div className="flex items-center justify-between relative">
              <div
                className="flex h-9 w-9 items-center justify-center rounded-lg border transition-all duration-300 group-hover:scale-105"
                style={{
                  borderColor: `${item.iconColor}30`,
                  background: `linear-gradient(135deg, ${item.iconColor}15 0%, ${item.iconColor}05 100%)`,
                  boxShadow: `0 0 12px ${item.iconColor}10`,
                }}
              >
                <Icon className="h-[15px] w-[15px]" style={{ color: item.iconColor }} />
              </div>
            </div>

            <div className="mt-3 relative">
              <p className="text-[11px] font-semibold text-[var(--muted-foreground)] uppercase tracking-wider">
                {item.label}
              </p>
              <p className="mt-1 text-2xl font-bold text-[var(--foreground)] tracking-tight">
                {formatValue(item)}
              </p>
            </div>

            {hasTrend && (
              <div className="mt-1 flex items-center gap-1.5 relative">
                {item.change !== undefined && (
                  <span
                    className={`inline-flex items-center text-[11px] font-bold ${
                      isPositive ? "text-[var(--success)]" : "text-[var(--danger)]"
                    }`}
                  >
                    {isPositive ? (
                      <ArrowUpRight className="mr-0.5 h-3 w-3" />
                    ) : (
                      <ArrowDownRight className="mr-0.5 h-3 w-3" />
                    )}
                    {item.changeLabel ?? `${Math.abs(item.change).toFixed(1)}%`}
                  </span>
                )}
                {item.changeLabel && item.change === undefined && (
                  <span className="text-[11px] font-bold text-[var(--success)]">{item.changeLabel}</span>
                )}
                <span className="text-[11px] text-[var(--muted-foreground)]">vs last 7 days</span>
              </div>
            )}

            <div className="mt-3 -mx-1 relative">
              <Sparkline data={item.sparkline} color={item.sparkColor} width={190} height={28} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
