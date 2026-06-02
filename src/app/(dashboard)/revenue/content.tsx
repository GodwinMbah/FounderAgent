"use client";

import { PageHeader } from "@/components/ui/PageHeader";
import { MetricCard } from "@/components/ui/MetricCard";
import { ChartCard } from "@/components/ui/ChartCard";
import { AgentInsightCard } from "@/components/ui/AgentInsightCard";
import { formatCurrency, formatCurrencyCompact } from "@/lib/utils/formatters";
import { useCompanyCurrency } from "@/lib/hooks/useCompanyCurrency";
import type { Transaction, MonthlyMetric, Subscription } from "@/lib/types";
import { calculateChangePercent } from "@/lib/reporting/kpis";
import { isIncome } from "@/lib/reporting/filters";
import { getDateRange, type DateRangePreset } from "@/lib/date-range";
import {
  TrendingUp,
  DollarSign,
  Repeat,
  Zap,
  Users,
  AlertTriangle,
  Lightbulb,
} from "lucide-react";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface RevenueContentProps {
  transactions: Transaction[];
  monthlyMetrics: MonthlyMetric[];
  subscriptions: Subscription[];
  initialPreset: string;
  initialFrom: string;
  initialTo: string;
}

const tooltipStyle = {
  background: "#111827",
  border: "1px solid rgba(148,163,184,0.16)",
  borderRadius: "8px",
  fontSize: "12px",
  color: "#f1f5f9",
};

export default function RevenueContent({
  transactions,
  monthlyMetrics,
  subscriptions,
  initialPreset,
  initialFrom,
  initialTo,
}: RevenueContentProps) {
  const { currency } = useCompanyCurrency();
  const incomeTransactions = transactions.filter((t) => isIncome(t));

  const totalRevenue = monthlyMetrics.reduce((s, m) => s + m.revenue, 0);
  const avgMonthlyRevenue = monthlyMetrics.length > 0 ? totalRevenue / monthlyMetrics.length : 0;

  const monthlySubSpend = subscriptions
    .filter((s) => s.status === "active")
    .reduce((sum, s) => {
      if (s.billingCycle === "monthly") return sum + s.amount;
      if (s.billingCycle === "quarterly") return sum + s.amount / 3;
      if (s.billingCycle === "yearly") return sum + s.amount / 12;
      return sum + s.amount;
    }, 0);

  // One-time revenue cannot be reliably derived from subscription spend.
  // We show it only when we can compute real recurring revenue from income transactions.
  const recurringRevenue = incomeTransactions.filter((t) => t.isRecurring).reduce((s, t) => s + t.amount, 0);
  const oneTime = recurringRevenue > 0 ? Math.max(0, avgMonthlyRevenue - recurringRevenue) : 0;

  // Real MoM growth from monthly metrics
  const sorted = [...monthlyMetrics].sort((a, b) => a.month.localeCompare(b.month));
  const currMonth = sorted[sorted.length - 1];
  const prevMonth = sorted[sorted.length - 2];
  const revGrowth = calculateChangePercent(currMonth?.revenue, prevMonth?.revenue);
  // Real MoM revenue growth (not fake MRR growth)
  const mrrGrowth = { text: "—", type: "neutral" as const };

  const sourceMap = new Map<string, number>();
  incomeTransactions.forEach((t) => {
    const key = t.category || "Other";
    sourceMap.set(key, (sourceMap.get(key) || 0) + t.amount);
  });
  const totalIncome = Array.from(sourceMap.values()).reduce((s, v) => s + v, 0);
  const revenueSourceData = Array.from(sourceMap.entries()).map(([name, amount]) => ({
    name,
    amount,
    percentage: totalIncome > 0 ? Math.round((amount / totalIncome) * 1000) / 10 : 0,
    growth: 0,
    customers: 0,
  }));

  const revenueTrendData = monthlyMetrics.map((m) => ({
    month: m.month.slice(5),
    total: m.revenue,
    recurring: recurringRevenue > 0 ? Math.min(m.revenue, recurringRevenue) : 0,
    onetime: recurringRevenue > 0 ? Math.max(0, m.revenue - recurringRevenue) : m.revenue,
  }));

  return (
    <div className="space-y-8">
      <PageHeader title="Revenue" subtitle="Monitor revenue streams, growth trends, and forecasting." />

      {/* Date range label */}
      <div className="flex items-center justify-end">
        <span className="text-xs text-[var(--muted-foreground)] hidden sm:inline">
          {getDateRange(initialPreset as DateRangePreset, initialFrom, initialTo).label}
        </span>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Total Revenue"
          value={formatCurrency(totalRevenue, 0, currency)}
          change={revGrowth.text}
          changeType={revGrowth.type}
          icon={<DollarSign className="h-4 w-4" style={{ color: "#22C55E" }} />}
          iconColor="#22C55E"
        />
        <MetricCard
          label="Monthly Sub Spend"
          value={monthlySubSpend > 0 ? formatCurrency(monthlySubSpend, 0, currency) : "—"}
          change={mrrGrowth.text}
          changeType={mrrGrowth.type}
          icon={<Repeat className="h-4 w-4" style={{ color: "#14B8A6" }} />}
          iconColor="#14B8A6"
        />
        <MetricCard
          label="One-Time Revenue"
          value={recurringRevenue > 0 ? formatCurrency(oneTime, 0, currency) : "—"}
          change="Variable"
          changeType="neutral"
          icon={<TrendingUp className="h-4 w-4" style={{ color: "#8B5CF6" }} />}
          iconColor="#8B5CF6"
        />
        <MetricCard
          label="Revenue Growth"
          value={revGrowth.text === "—" ? "—" : revGrowth.text}
          change={revGrowth.type === "positive" ? "Accelerating" : revGrowth.type === "negative" ? "Declining" : "Stable"}
          changeType={revGrowth.type}
          icon={<Zap className="h-4 w-4" style={{ color: "#FBBF24" }} />}
          iconColor="#FBBF24"
        />
      </div>

      {/* Charts */}
      <div className="grid gap-5 lg:grid-cols-2">
        <ChartCard title="Revenue Trend" subtitle="Total revenue over time">
          <div className="w-full h-full min-h-0 min-w-0">
            <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 1, height: 1 }}>
              <AreaChart data={monthlyMetrics.map((m) => ({ month: m.month.slice(5), revenue: m.revenue, profit: m.profit }))} margin={{ top: 10, right: 10, left: 10, bottom: 5 }}>
                <defs>
                  <linearGradient id="revTrendGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#22C55E" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#22C55E" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="profitGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#14B8A6" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#14B8A6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.08)" />
                <XAxis dataKey="month" tick={{ fill: "#94A3B8", fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "#94A3B8", fontSize: 12 }} axisLine={false} tickLine={false} tickFormatter={(v) => formatCurrencyCompact(Number(v), currency)} />
                <Tooltip contentStyle={tooltipStyle} formatter={(value) => value !== undefined ? formatCurrency(Number(value), 0, currency) : ""} />
                <Area type="monotone" dataKey="revenue" stroke="#22C55E" strokeWidth={2} fill="url(#revTrendGrad)" />
                <Area type="monotone" dataKey="profit" stroke="#14B8A6" strokeWidth={2} fill="url(#profitGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        <ChartCard title="Recurring vs One-Time" subtitle="Revenue composition">
          <div className="w-full h-full min-h-0 min-w-0">
            <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 1, height: 1 }}>
              <BarChart data={revenueTrendData} margin={{ top: 10, right: 10, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.08)" />
                <XAxis dataKey="month" tick={{ fill: "#94A3B8", fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "#94A3B8", fontSize: 12 }} axisLine={false} tickLine={false} tickFormatter={(v) => formatCurrencyCompact(Number(v), currency)} />
                <Tooltip contentStyle={tooltipStyle} formatter={(value) => value !== undefined ? formatCurrency(Number(value), 0, currency) : ""} />
                <Bar dataKey="recurring" stackId="a" fill="#14B8A6" radius={[0, 0, 0, 0]} />
                <Bar dataKey="onetime" stackId="a" fill="#8B5CF6" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>
      </div>

      {/* Revenue by Source + Intelligence */}
      <div className="grid gap-5 lg:grid-cols-2">
        <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] overflow-hidden">
          <div className="px-5 py-4 border-b border-[var(--border)]">
            <h3 className="text-sm font-bold text-[var(--foreground)]">Revenue by Source</h3>
            <p className="text-xs text-[var(--muted-foreground)] mt-0.5">Channel breakdown</p>
          </div>
          <div className="p-5 space-y-3">
            {revenueSourceData.map((source) => (
              <div key={source.name} className="flex items-center justify-between rounded-lg border border-[var(--border)] bg-[var(--background)] p-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#14B8A6]/10">
                    <Users className="h-4 w-4 text-[#14B8A6]" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-[var(--foreground)]">{source.name}</p>
                    <p className="text-xs text-[var(--muted-foreground)]">{source.customers > 0 ? `${source.customers} customers` : "Channel"}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-[var(--foreground)]">{formatCurrency(source.amount, 0, currency)}</p>
                  <p className="text-xs text-[var(--muted-foreground)]">{source.percentage}% of total</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] overflow-hidden">
          <div className="px-5 py-4 border-b border-[var(--border)]">
            <h3 className="text-sm font-bold text-[var(--foreground)]">Revenue Intelligence</h3>
            <p className="text-xs text-[var(--muted-foreground)] mt-0.5">FounderAgent analysis</p>
          </div>
          <div className="p-5 space-y-3">
            <div className="flex items-start gap-3 rounded-lg border border-[var(--border)] bg-[var(--background)] p-3">
              <AlertTriangle className="h-4 w-4 text-[#FBBF24] shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-[var(--foreground)]">Concentration Risk</p>
                <p className="text-xs text-[var(--muted-foreground)]">Monitor revenue concentration across channels to reduce dependency.</p>
              </div>
            </div>
            <div className="flex items-start gap-3 rounded-lg border border-[var(--border)] bg-[var(--background)] p-3">
              <TrendingUp className="h-4 w-4 text-[#22C55E] shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-[var(--foreground)]">Growth Momentum</p>
                <p className="text-xs text-[var(--muted-foreground)]">Track month-over-month trends to spot acceleration or deceleration.</p>
              </div>
            </div>
            <div className="flex items-start gap-3 rounded-lg border border-[var(--border)] bg-[var(--background)] p-3">
              <Zap className="h-4 w-4 text-[#14B8A6] shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-[var(--foreground)]">Forecast</p>
                <p className="text-xs text-[var(--muted-foreground)]">Projections based on current pipeline and recurring revenue base.</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Agent Insight Card */}
      <AgentInsightCard title="FounderAgent Revenue Analysis" orbSize={64}>
        <div className="flex items-start gap-2 text-sm text-[var(--muted-foreground)]">
          <Lightbulb className="h-4 w-4 text-[var(--accent)] shrink-0 mt-0.5" />
          <span>Revenue for the selected period is {formatCurrency(totalRevenue, 0, currency)} with {revGrowth.text} trend.</span>
        </div>
        <div className="flex items-start gap-2 text-sm text-[var(--muted-foreground)]">
          <Lightbulb className="h-4 w-4 text-[var(--accent)] shrink-0 mt-0.5" />
          <span>Monthly subscription spend is {monthlySubSpend > 0 ? formatCurrency(monthlySubSpend, 0, currency) : "—"} — understanding this helps with runway planning.</span>
        </div>
        <div className="flex items-start gap-2 text-sm text-[var(--muted-foreground)]">
          <Lightbulb className="h-4 w-4 text-[var(--accent)] shrink-0 mt-0.5" />
          <span>Monitor concentration risk across revenue channels for diversification.</span>
        </div>
      </AgentInsightCard>
    </div>
  );
}
