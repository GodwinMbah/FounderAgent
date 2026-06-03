"use client";

import { useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { MetricCard } from "@/components/ui/MetricCard";
import { ChartCard } from "@/components/ui/ChartCard";
import { AgentBanner } from "@/components/features/dashboard/AgentBanner";
import { formatCurrency, formatCurrencyCompact } from "@/lib/utils/formatters";
import { useCompanyCurrency } from "@/lib/hooks/useCompanyCurrency";
import type { DashboardMetrics, MonthlyMetric, Subscription, Alert, Transaction } from "@/lib/types";
import { getDateRange, type DateRangePreset } from "@/lib/date-range";
import { getEligibleKPIs, formatKPIValue, getKPIChange } from "@/lib/business-intelligence/kpi-eligibility";
import type { CompanyBusinessProfile } from "@/lib/business-intelligence/types";
import type { KPICardConfig } from "@/lib/business-intelligence/types";
import KPIDrilldownDrawer from "@/components/features/dashboard/KPIDrilldownDrawer";
import { Sun, Sunrise, Moon } from "lucide-react";
import * as Icons from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from "recharts";

const COLORS = ["#14B8A6", "#8B5CF6", "#38BDF8", "#FBBF24", "#F43F5E", "#22C55E"];

function getKPIGridClass(count: number): string {
  if (count <= 2) return "grid-cols-1 md:grid-cols-2";
  if (count <= 3) return "grid-cols-1 md:grid-cols-3";
  if (count <= 4) return "grid-cols-2 lg:grid-cols-4";
  if (count <= 6) return "grid-cols-2 md:grid-cols-3";
  if (count <= 8) return "grid-cols-2 md:grid-cols-3 lg:grid-cols-4";
  return "grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4";
}

function getGreetingText(hour: number) {
  if (hour >= 5 && hour < 12) return "Good morning";
  if (hour >= 12 && hour < 18) return "Good afternoon";
  return "Good evening";
}

function getGreetingIcon(hour: number) {
  if (hour >= 5 && hour < 12) return <Sunrise className="h-4 w-4 text-[var(--accent)]" />;
  if (hour >= 12 && hour < 18) return <Sun className="h-4 w-4 text-[var(--warning)]" />;
  return <Moon className="h-4 w-4 text-[var(--soft-lilac)]" />;
}

interface DashboardContentProps {
  metrics: DashboardMetrics;
  monthlyMetrics: MonthlyMetric[];
  subscriptions: Subscription[];
  alerts: Alert[];
  topExpenses: { name: string; amount: number }[];
  transactions: Transaction[];
  companyProfile: CompanyBusinessProfile;
  initialPreset: DateRangePreset;
  initialFrom: string;
  initialTo: string;
}

export default function DashboardContent({
  metrics,
  monthlyMetrics,
  subscriptions,
  alerts,
  topExpenses,
  transactions,
  companyProfile,
  initialPreset,
  initialFrom,
  initialTo,
}: DashboardContentProps) {
  const [selectedKPI, setSelectedKPI] = useState<KPICardConfig | null>(null);
  const { currency } = useCompanyCurrency();
  const hour = new Date().getHours();
  const greetingText = getGreetingText(hour);
  const greetingIcon = getGreetingIcon(hour);
  const formattedDate = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const cashFlowData = monthlyMetrics.map((m) => ({
    month: m.month.slice(5),
    inflow: m.cashIn,
    outflow: m.cashOut,
    net: m.profit,
  }));

  const expenseData = topExpenses.map((e) => ({ name: e.name, value: e.amount }));
  const totalExpenses = expenseData.reduce((sum, e) => sum + e.value, 0);

  const eligibleKPIs = getEligibleKPIs(companyProfile, metrics);
  const dateRangeLabel = getDateRange(initialPreset, initialFrom, initialTo).label;
  const sourceUploadCount = new Set(transactions.map((t) => t.uploadId).filter(Boolean)).size;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Command Centre"
        subtitle="Your AI finance copilot is watching cash, runway, revenue, spend, and risk signals."
      />

      {/* Greeting Bar */}
      <div className="flex items-center justify-between rounded-xl border border-[var(--highlight)]/15 bg-gradient-to-r from-[var(--highlight)]/8 to-transparent px-5 py-3.5">
        <div className="flex items-center gap-2.5">
          {greetingIcon}
          <span className="text-sm font-semibold text-[var(--soft-lilac)]">{greetingText}, Founder</span>
        </div>
        <span className="text-xs text-[var(--muted-foreground)]">{formattedDate}</span>
      </div>

      {/* Date Range Label + KPIs */}
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <span className="text-xs text-[var(--muted-foreground)]">
            {getDateRange(initialPreset, initialFrom, initialTo).label}
          </span>
        </div>

        <div className={`grid gap-5 ${getKPIGridClass(eligibleKPIs.length)}`}>
          {eligibleKPIs.map((kpi) => {
            const Icon = (Icons as unknown as Record<string, React.ComponentType<{ className?: string; style?: React.CSSProperties }>>)[kpi.icon];
            const value = formatKPIValue(kpi, metrics, currency);
            const change = getKPIChange(kpi, monthlyMetrics, metrics);
            return (
              <MetricCard
                key={kpi.id}
                label={kpi.label}
                value={value}
                change={change?.text ?? "—"}
                changeType={change?.type ?? "neutral"}
                icon={Icon ? <Icon className="h-4 w-4" style={{ color: kpi.iconColor }} /> : null}
                iconColor={kpi.iconColor}
              />
            );
          })}
        </div>
        <p className="text-xs text-[var(--muted-foreground)]">
          KPI source: {transactions.length} transaction{transactions.length !== 1 ? "s" : ""} from {sourceUploadCount} upload{sourceUploadCount !== 1 ? "s" : ""} in this date range.
        </p>
      </div>

      {/* Middle Section */}
      <div className="grid gap-5 lg:grid-cols-3">
        {/* Subscription Spend */}
        <ChartCard title="Subscription Spend" subtitle="Monthly recurring software costs" height="h-80">
          <div className="flex flex-col h-full">
            <div className="mb-3 shrink-0">
              <p className="text-2xl font-bold text-[var(--foreground)]">{formatCurrency(metrics.monthlySubscriptionSpend, 0, currency)}</p>
              <p className="text-xs text-[var(--muted-foreground)]">{subscriptions.filter((s) => s.status === "active").length} active tools</p>
            </div>
            <div className="flex-1 space-y-1.5">
              {subscriptions.filter((s) => s.status === "active").slice(0, 5).map((sub, i) => (
                <div key={sub.id} className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="h-2 w-2 rounded-full shrink-0" style={{ background: COLORS[i % COLORS.length] }} />
                    <span className="text-xs text-[var(--foreground)] truncate">{sub.name}</span>
                  </div>
                  <span className="text-xs font-medium text-[var(--muted-foreground)] shrink-0">{formatCurrency(sub.amount, 0, currency)}</span>
                </div>
              ))}
            </div>
            {/* Legend */}
            <div className="flex flex-wrap gap-x-3 gap-y-1 mt-3 pt-3 border-t border-[var(--border)] shrink-0">
              {subscriptions.filter((s) => s.status === "active").slice(0, 5).map((sub, i) => (
                <div key={`legend-${sub.id}`} className="flex items-center gap-1.5">
                  <div className="h-1.5 w-1.5 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
                  <span className="text-[10px] text-[var(--muted-foreground)]">{sub.name}</span>
                </div>
              ))}
            </div>
          </div>
        </ChartCard>

        {/* Top Expense Categories */}
        <ChartCard title="Top Expense Categories" subtitle="Where money goes" height="h-80">
          <div className="space-y-3">
            {expenseData
              .sort((a, b) => b.value - a.value)
              .map((item, i) => {
                const pct = totalExpenses > 0 ? Math.round((item.value / totalExpenses) * 100) : 0;
                return (
                  <div key={item.name}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="h-2 w-2 rounded-full shrink-0" style={{ background: COLORS[i % COLORS.length] }} />
                        <span className="text-xs font-medium text-[var(--foreground)] truncate">{item.name}</span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0 ml-2">
                        <span className="text-xs font-bold text-[var(--foreground)]">{formatCurrency(item.value, 0, currency)}</span>
                        <span className="text-[11px] text-[var(--muted-foreground)] w-8 text-right">{pct}%</span>
                      </div>
                    </div>
                    <div className="mt-1.5 h-1.5 rounded-full bg-[var(--border)] overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${pct}%`, background: COLORS[i % COLORS.length] }}
                      />
                    </div>
                  </div>
                );
              })}
          </div>
        </ChartCard>

        {/* AI Insight Feed */}
        <ChartCard title="AI Insight Feed" subtitle="Latest from FounderAgent" height="h-80">
          <div className="space-y-3">
            {alerts.slice(0, 5).map((alert) => (
              <div
                key={alert.id}
                className="rounded-lg border border-[var(--border)] bg-[var(--background)] p-3 transition-colors hover:border-[var(--highlight)]/20"
              >
                <div className="flex items-start gap-2">
                  <div
                    className={`mt-0.5 h-1.5 w-1.5 rounded-full shrink-0 ${
                      alert.severity === "critical" || alert.severity === "warning"
                        ? "bg-[var(--danger)]"
                        : "bg-[var(--sky-blue)]"
                    }`}
                  />
                  <div>
                    <p className="text-xs font-semibold text-[var(--foreground)] leading-snug">{alert.title}</p>
                    <p className="text-[11px] text-[var(--muted-foreground)] mt-0.5 line-clamp-2">{alert.description}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </ChartCard>
      </div>

      {/* Bottom Section */}
      <div className="grid gap-5 lg:grid-cols-2">
        {/* Cash Flow Chart */}
        <ChartCard title="Cash Flow" subtitle="Operating cash movement" height="h-72">
          <div className="w-full h-full min-h-0 min-w-0">
            <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 1, height: 1 }}>
              <AreaChart data={cashFlowData} margin={{ top: 10, right: 10, left: 10, bottom: 5 }}>
                <defs>
                  <linearGradient id="colorInflow" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#22C55E" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#22C55E" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorOutflow" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#F43F5E" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#F43F5E" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.08)" vertical={false} />
                <XAxis dataKey="month" tick={{ fill: "#94a3b8", fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "#94a3b8", fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => v ? formatCurrencyCompact(Number(v), currency) : ""} />
                <Tooltip
                  contentStyle={{
                    background: "#111827",
                    border: "1px solid rgba(148,163,184,0.16)",
                    borderRadius: "8px",
                    fontSize: "12px",
                    color: "#f1f5f9",
                  }}
                  formatter={(value) => value !== undefined ? formatCurrency(Number(value), 0, currency) : ""}
                />
                <Area type="monotone" dataKey="inflow" stroke="#22C55E" strokeWidth={2} fillOpacity={1} fill="url(#colorInflow)" />
                <Area type="monotone" dataKey="outflow" stroke="#F43F5E" strokeWidth={2} fillOpacity={1} fill="url(#colorOutflow)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        {/* Runway Analysis */}
        <ChartCard title="Runway Analysis" subtitle="Cash vs burn trajectory" height="h-72">
          <div className="w-full h-full min-h-0 min-w-0">
            <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 1, height: 1 }}>
              <BarChart data={monthlyMetrics.map((m) => ({ month: m.month.slice(5), profit: m.profit, expenses: m.expenses }))} margin={{ top: 10, right: 10, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.08)" vertical={false} />
                <XAxis dataKey="month" tick={{ fill: "#94a3b8", fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "#94a3b8", fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => v ? formatCurrencyCompact(Number(v), currency) : ""} />
                <Tooltip
                  contentStyle={{
                    background: "#111827",
                    border: "1px solid rgba(148,163,184,0.16)",
                    borderRadius: "8px",
                    fontSize: "12px",
                    color: "#f1f5f9",
                  }}
                  formatter={(value) => value !== undefined ? formatCurrency(Number(value), 0, currency) : ""}
                />
                <Bar dataKey="profit" fill="#14B8A6" radius={[4, 4, 0, 0]} />
                <Bar dataKey="expenses" fill="#F43F5E" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>
      </div>

      {/* Agent Banner */}
      <AgentBanner />

      {/* KPI Drilldown Drawer */}
      {selectedKPI && (
        <KPIDrilldownDrawer
          kpi={selectedKPI}
          metrics={metrics}
          monthlyMetrics={monthlyMetrics}
          transactions={transactions}
          dateRangeLabel={dateRangeLabel}
          onClose={() => setSelectedKPI(null)}
        />
      )}
    </div>
  );
}
