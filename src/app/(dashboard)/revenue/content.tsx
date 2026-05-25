"use client";

import { PageHeader } from "@/components/ui/PageHeader";
import { MetricCard } from "@/components/ui/MetricCard";
import { ChartCard } from "@/components/ui/ChartCard";
import { AgentInsightCard } from "@/components/ui/AgentInsightCard";
import { formatCurrency } from "@/lib/utils/formatters";
import type { Transaction, MonthlyMetric } from "@/lib/types";
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
}

const tooltipStyle = {
  background: "#111827",
  border: "1px solid rgba(148,163,184,0.16)",
  borderRadius: "8px",
  fontSize: "12px",
  color: "#f1f5f9",
};

export default function RevenueContent({ transactions, monthlyMetrics }: RevenueContentProps) {
  const incomeTransactions = transactions.filter((t) => t.type === "income");

  const totalRevenue = monthlyMetrics.reduce((s, m) => s + m.revenue, 0);
  const avgMonthlyRevenue = monthlyMetrics.length > 0 ? totalRevenue / monthlyMetrics.length : 0;
  const mrr = avgMonthlyRevenue * 0.65;
  const oneTime = avgMonthlyRevenue * 0.35;
  const growthRate =
    monthlyMetrics.length > 1
      ? ((monthlyMetrics[monthlyMetrics.length - 1].revenue - monthlyMetrics[0].revenue) /
          monthlyMetrics[0].revenue) *
        100
      : 0;

  // Revenue by source (grouped by category)
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
    recurring: m.revenue * 0.65,
    onetime: m.revenue * 0.35,
  }));

  return (
    <div className="space-y-8">
      <PageHeader
        title="Revenue"
        subtitle="Monitor revenue streams, growth trends, and forecasting."
      />

      {/* KPI Cards */}
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Total Revenue"
          value={formatCurrency(totalRevenue)}
          change="+50.8% YTD"
          changeType="positive"
          icon={<DollarSign className="h-4 w-4" style={{ color: "#22C55E" }} />}
          iconColor="#22C55E"
        />
        <MetricCard
          label="Monthly Recurring"
          value={formatCurrency(mrr)}
          change="+15% vs Jan"
          changeType="positive"
          icon={<Repeat className="h-4 w-4" style={{ color: "#14B8A6" }} />}
          iconColor="#14B8A6"
        />
        <MetricCard
          label="One-Time Revenue"
          value={formatCurrency(oneTime)}
          change="Variable"
          changeType="neutral"
          icon={<TrendingUp className="h-4 w-4" style={{ color: "#8B5CF6" }} />}
          iconColor="#8B5CF6"
        />
        <MetricCard
          label="Revenue Growth"
          value={`${growthRate.toFixed(1)}%`}
          change="Accelerating"
          changeType="positive"
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
              <YAxis tick={{ fill: "#94A3B8", fontSize: 12 }} axisLine={false} tickLine={false} tickFormatter={(v) => v ? `$${v / 1000}k` : ""} />
              <Tooltip contentStyle={tooltipStyle} formatter={(value) => value !== undefined ? formatCurrency(Number(value)) : ""} />
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
              <YAxis tick={{ fill: "#94A3B8", fontSize: 12 }} axisLine={false} tickLine={false} tickFormatter={(v) => v ? `$${v / 1000}k` : ""} />
              <Tooltip contentStyle={tooltipStyle} formatter={(value) => value !== undefined ? formatCurrency(Number(value)) : ""} />
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
                  <p className="text-sm font-bold text-[var(--foreground)]">{formatCurrency(source.amount)}</p>
                  <p className={`text-xs ${source.growth >= 0 ? "text-[#22C55E]" : "text-[#F43F5E]"}`}>
                    {source.growth >= 0 ? "+" : ""}{source.growth}% growth
                  </p>
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
                <p className="text-xs text-[var(--muted-foreground)]">38% of revenue from SaaS subscriptions. Diversify to reduce dependency.</p>
              </div>
            </div>
            <div className="flex items-start gap-3 rounded-lg border border-[var(--border)] bg-[var(--background)] p-3">
              <TrendingUp className="h-4 w-4 text-[#22C55E] shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-[var(--foreground)]">Enterprise Momentum</p>
                <p className="text-xs text-[var(--muted-foreground)]">Enterprise licenses growing 22% MoM. Consider dedicated sales motion.</p>
              </div>
            </div>
            <div className="flex items-start gap-3 rounded-lg border border-[var(--border)] bg-[var(--background)] p-3">
              <Zap className="h-4 w-4 text-[#14B8A6] shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-[var(--foreground)]">Forecast</p>
                <p className="text-xs text-[var(--muted-foreground)]">Projected $52K next month based on current pipeline and churn.</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Agent Insight Card */}
      <AgentInsightCard title="FounderAgent Revenue Analysis" orbSize={64}>
        <div className="flex items-start gap-2 text-sm text-[var(--muted-foreground)]">
          <Lightbulb className="h-4 w-4 text-[var(--accent)] shrink-0 mt-0.5" />
          <span>Revenue grew 50.8% YTD with accelerating momentum into Q2.</span>
        </div>
        <div className="flex items-start gap-2 text-sm text-[var(--muted-foreground)]">
          <Lightbulb className="h-4 w-4 text-[var(--accent)] shrink-0 mt-0.5" />
          <span>Recurring revenue is 65% of total — strong predictability for runway planning.</span>
        </div>
        <div className="flex items-start gap-2 text-sm text-[var(--muted-foreground)]">
          <Lightbulb className="h-4 w-4 text-[var(--accent)] shrink-0 mt-0.5" />
          <span>Enterprise segment is your highest-growth channel at 22% MoM.</span>
        </div>
      </AgentInsightCard>
    </div>
  );
}
