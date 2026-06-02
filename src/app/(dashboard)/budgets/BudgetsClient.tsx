"use client";

import { PageHeader } from "@/components/ui/PageHeader";
import { MetricCard } from "@/components/ui/MetricCard";
import { ChartCard } from "@/components/ui/ChartCard";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { SectionCard } from "@/components/ui/SectionCard";
import { formatCurrency, formatCurrencyCompact } from "@/lib/utils/formatters";
import { useCompanyCurrency } from "@/lib/hooks/useCompanyCurrency";
import { getDateRange } from "@/lib/date-range";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from "recharts";
import {
  Wallet, TrendingDown, PiggyBank, AlertTriangle,
} from "lucide-react";

const barColors = {
  budget: "#8B5CF6",
  actual: "#14B8A6",
};

interface BudgetCategory {
  name: string;
  budget: number;
  actual: number;
  variance: number;
  status: string;
}

interface BudgetAlert {
  category: string;
  message: string;
  severity: "warning" | "info";
}

interface Props {
  totalBudget: number;
  spent: number;
  remaining: number;
  percentUsed: number;
  categories: BudgetCategory[];
  alerts: BudgetAlert[];
  initialPreset: Parameters<typeof getDateRange>[0];
  initialFrom: string;
  initialTo: string;
}

export default function BudgetsClient({
  totalBudget,
  spent,
  remaining,
  percentUsed,
  categories,
  alerts,
  initialPreset,
  initialFrom,
  initialTo,
}: Props) {
  const { currency } = useCompanyCurrency();
  const overBudgetCount = categories.filter((c) => c.actual > c.budget).length;

  return (
    <div className="space-y-8">
      <PageHeader title="Budgets" subtitle="Compare planned budget against actual spend." />

      {/* Date Range */}
      <div className="flex items-center justify-end">
        <span className="text-xs text-[var(--muted-foreground)] hidden sm:inline">
          {getDateRange(initialPreset, initialFrom, initialTo).label}
        </span>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <MetricCard
          label="Total Budget"
          value={formatCurrency(totalBudget, 0, currency)}
          change="Monthly"
          changeType="neutral"
          icon={<Wallet className="h-5 w-5" />}
          iconColor="#8B5CF6"
        />
        <MetricCard
          label="Spent"
          value={formatCurrency(spent, 0, currency)}
          change={`${percentUsed.toFixed(1)}% used`}
          changeType={percentUsed > 90 ? "negative" : "neutral"}
          icon={<TrendingDown className="h-5 w-5" />}
          iconColor="#14B8A6"
        />
        <MetricCard
          label="Remaining"
          value={formatCurrency(remaining, 0, currency)}
          change="Available"
          changeType="positive"
          icon={<PiggyBank className="h-5 w-5" />}
          iconColor="#22C55E"
        />
        <MetricCard
          label="Over Budget"
          value={String(overBudgetCount)}
          change={overBudgetCount === 0 ? "On track" : "Categories"}
          changeType={overBudgetCount === 0 ? "positive" : "negative"}
          icon={<AlertTriangle className="h-5 w-5" />}
          iconColor={overBudgetCount === 0 ? "#22C55E" : "#F43F5E"}
        />
      </div>

      {/* Chart */}
      <ChartCard title="Budget vs Actual" subtitle="Planned spend compared to real outflows">
        <div className="w-full h-full min-h-0 min-w-0">
          <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 1, height: 1 }}>
            <BarChart data={categories} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.12)" />
              <XAxis dataKey="name" tick={{ fill: "#94A3B8", fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "#94A3B8", fontSize: 12 }} axisLine={false} tickLine={false} tickFormatter={(v) => v !== undefined ? formatCurrencyCompact(Number(v), currency) : ""} />
              <Tooltip
                formatter={(value) => value !== undefined ? formatCurrency(Number(value), 0, currency) : ""}
                contentStyle={{ background: "#111827", border: "1px solid rgba(148,163,184,0.16)", borderRadius: "8px", fontSize: "12px", color: "#f1f5f9" }}
              />
              <Bar dataKey="budget" fill={barColors.budget} radius={[6, 6, 0, 0]} />
              <Bar dataKey="actual" fill={barColors.actual} radius={[6, 6, 0, 0]}>
                {categories.map((cat, index) => (
                  <Cell key={`cell-${index}`} fill={cat.actual > cat.budget ? "#F43F5E" : barColors.actual} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </ChartCard>

      {/* Alerts & Adjustments */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <SectionCard title="Budget Alerts" subtitle="Active warnings from your budget tracker">
          <div className="space-y-3">
            {alerts.map((alert, idx) => (
              <div key={idx} className="flex items-start gap-4 rounded-lg border border-[var(--border)] bg-[#09090B] px-5 py-4">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border" style={{ borderColor: alert.severity === "warning" ? "rgba(251,191,36,0.2)" : "rgba(20,184,166,0.2)", background: alert.severity === "warning" ? "linear-gradient(135deg, rgba(251,191,36,0.12) 0%, rgba(251,191,36,0.04) 100%)" : "linear-gradient(135deg, rgba(20,184,166,0.12) 0%, rgba(20,184,166,0.04) 100%)" }}>
                  <AlertTriangle className={`h-4 w-4 ${alert.severity === "warning" ? "text-[#FBBF24]" : "text-[#14B8A6]"}`} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-[#F1F5F9]">{alert.category}</p>
                    <StatusBadge variant={alert.severity === "warning" ? "warning" : "info"}>{alert.severity}</StatusBadge>
                  </div>
                  <p className="text-xs text-[#94A3B8] mt-0.5">{alert.message}</p>
                </div>
              </div>
            ))}
            {alerts.length === 0 && (
              <p className="text-sm text-[#94A3B8] text-center py-6">No active budget alerts</p>
            )}
          </div>
        </SectionCard>

        <SectionCard title="Recommended Adjustments" subtitle="FounderAgent suggestions">
          <div className="space-y-3">
            <p className="text-sm text-[#94A3B8] text-center py-6">
              Budget recommendations will appear when variance exceeds your alert threshold.
            </p>
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
