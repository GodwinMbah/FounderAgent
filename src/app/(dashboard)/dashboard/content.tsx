"use client";

import { useState, useEffect } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { MetricCard } from "@/components/ui/MetricCard";
import { ChartCard } from "@/components/ui/ChartCard";
import { AgentBanner } from "@/components/features/dashboard/AgentBanner";
import { formatCurrency } from "@/lib/utils/formatters";
import type { DashboardMetrics, MonthlyMetric, Subscription, Alert } from "@/lib/types";
import { Wallet, Flame, Clock, TrendingUp, TrendingDown, Zap, Heart, Repeat, Sun, Sunrise, Moon } from "lucide-react";
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
}

export default function DashboardContent({
  metrics,
  monthlyMetrics,
  subscriptions,
  alerts,
  topExpenses,
}: DashboardContentProps) {
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

  const formatValue = (val: number, fmt?: string) => {
    if (fmt === "currency") return formatCurrency(val);
    if (fmt === "runway") {
      if (!Number.isFinite(val)) return "Infinite";
      if (val < 1) return "< 1 mo";
      if (val < 12) return `${Math.round(val)} mo`;
      return `${(val / 12).toFixed(1)} yr`;
    }
    return `${val}`;
  };

  const kpis = [
    { label: "Cash Balance", value: formatValue(metrics.cashBalance, "currency"), change: "+12.4%", changeType: "positive" as const, icon: <Wallet className="h-4 w-4" style={{ color: "#14B8A6" }} />, iconColor: "#14B8A6" },
    { label: "Monthly Revenue", value: formatValue(metrics.monthlyRevenue, "currency"), change: "+12.5%", changeType: "positive" as const, icon: <TrendingUp className="h-4 w-4" style={{ color: "#22C55E" }} />, iconColor: "#22C55E" },
    { label: "Monthly Expenses", value: formatValue(metrics.monthlyExpenses, "currency"), change: "+3.2%", changeType: "negative" as const, icon: <TrendingDown className="h-4 w-4" style={{ color: "#F43F5E" }} />, iconColor: "#F43F5E" },
    { label: "Net Profit", value: formatValue(metrics.netProfit, "currency"), change: "+18.1%", changeType: "positive" as const, icon: <Zap className="h-4 w-4" style={{ color: "#14B8A6" }} />, iconColor: "#14B8A6" },
    { label: "Monthly Burn", value: formatValue(metrics.monthlyBurn, "currency"), change: "-8.7%", changeType: "positive" as const, icon: <Flame className="h-4 w-4" style={{ color: "#F43F5E" }} />, iconColor: "#F43F5E" },
    { label: "Runway", value: formatValue(metrics.runwayMonths, "runway"), change: "+1.2 mo", changeType: "positive" as const, icon: <Clock className="h-4 w-4" style={{ color: "#22D3EE" }} />, iconColor: "#22D3EE" },
    { label: "MRR", value: formatValue(metrics.monthlySubscriptionSpend, "currency"), change: "+7.3%", changeType: "positive" as const, icon: <Repeat className="h-4 w-4" style={{ color: "#8B5CF6" }} />, iconColor: "#8B5CF6" },
    { label: "Health Score", value: String(metrics.healthScore), change: "Strong", changeType: "positive" as const, icon: <Heart className="h-4 w-4" style={{ color: "#8B5CF6" }} />, iconColor: "#8B5CF6" },
  ];

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

      {/* KPI Grid */}
      <div className="grid gap-5 grid-cols-2 lg:grid-cols-4">
        {kpis.map((kpi, i) => (
          <MetricCard key={i} {...kpi} />
        ))}
      </div>

      {/* Middle Section */}
      <div className="grid gap-5 lg:grid-cols-3">
        {/* Subscription Spend */}
        <ChartCard title="Subscription Spend" subtitle="Monthly recurring software costs" height="h-80">
          <div className="flex flex-col h-full">
            <div className="mb-3 shrink-0">
              <p className="text-2xl font-bold text-[var(--foreground)]">{formatCurrency(metrics.monthlySubscriptionSpend)}</p>
              <p className="text-xs text-[var(--muted-foreground)]">{subscriptions.filter((s) => s.status === "active").length} active tools</p>
            </div>
            <div className="flex-1 space-y-1.5">
              {subscriptions.filter((s) => s.status === "active").slice(0, 5).map((sub, i) => (
                <div key={sub.id} className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="h-2 w-2 rounded-full shrink-0" style={{ background: COLORS[i % COLORS.length] }} />
                    <span className="text-xs text-[var(--foreground)] truncate">{sub.name}</span>
                  </div>
                  <span className="text-xs font-medium text-[var(--muted-foreground)] shrink-0">{formatCurrency(sub.amount)}</span>
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
                        <span className="text-xs font-bold text-[var(--foreground)]">{formatCurrency(item.value)}</span>
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
                        : alert.severity === "opportunity"
                        ? "bg-[var(--success)]"
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
                <YAxis tick={{ fill: "#94a3b8", fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => v ? `$${v / 1000}k` : ""} />
                <Tooltip
                  contentStyle={{
                    background: "#111827",
                    border: "1px solid rgba(148,163,184,0.16)",
                    borderRadius: "8px",
                    fontSize: "12px",
                    color: "#f1f5f9",
                  }}
                  formatter={(value) => value !== undefined ? formatCurrency(Number(value)) : ""}
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
                <YAxis tick={{ fill: "#94a3b8", fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => v ? `$${v / 1000}k` : ""} />
                <Tooltip
                  contentStyle={{
                    background: "#111827",
                    border: "1px solid rgba(148,163,184,0.16)",
                    borderRadius: "8px",
                    fontSize: "12px",
                    color: "#f1f5f9",
                  }}
                  formatter={(value) => value !== undefined ? formatCurrency(Number(value)) : ""}
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
    </div>
  );
}
