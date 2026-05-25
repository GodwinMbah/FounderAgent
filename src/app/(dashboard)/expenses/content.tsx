"use client";

import { useState, useMemo } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { MetricCard } from "@/components/ui/MetricCard";
import { ChartCard } from "@/components/ui/ChartCard";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { AgentInsightCard } from "@/components/ui/AgentInsightCard";
import { formatCurrency } from "@/lib/utils/formatters";
import type { Transaction, MonthlyMetric } from "@/lib/types";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { TrendingDown, DollarSign, Search, AlertTriangle, Scissors } from "lucide-react";

const COLORS = ["#14B8A6", "#8B5CF6", "#38BDF8", "#FBBF24", "#F43F5E", "#22C55E"];

interface ExpensesContentProps {
  transactions: Transaction[];
  monthlyMetrics: MonthlyMetric[];
}

export default function ExpensesContent({ transactions, monthlyMetrics }: ExpensesContentProps) {
  const [search, setSearch] = useState("");

  const expenseTransactions = useMemo(() =>
    transactions.filter((t) => t.type === "expense"),
  [transactions]);

  const totalExpenses = useMemo(() =>
    expenseTransactions.reduce((s, t) => s + t.amount, 0),
  [expenseTransactions]);

  const largestExpense = useMemo(() =>
    expenseTransactions.reduce((max, t) => t.amount > max.amount ? t : max, expenseTransactions[0]),
  [expenseTransactions]);

  const categoryBreakdown = useMemo(() => {
    const map = new Map<string, number>();
    expenseTransactions.forEach((t) => {
      map.set(t.category || "Uncategorized", (map.get(t.category || "Uncategorized") || 0) + t.amount);
    });
    return Array.from(map.entries())
      .map(([name, amount]) => ({ name, amount, percentage: totalExpenses > 0 ? (amount / totalExpenses) * 100 : 0 }))
      .sort((a, b) => b.amount - a.amount);
  }, [expenseTransactions, totalExpenses]);

  const filteredTransactions = useMemo(() =>
    expenseTransactions.filter((t) =>
      (t.merchant?.toLowerCase() || "").includes(search.toLowerCase()) ||
      (t.description?.toLowerCase() || "").includes(search.toLowerCase()) ||
      (t.category?.toLowerCase() || "").includes(search.toLowerCase())
    ),
  [expenseTransactions, search]);

  const expenseTrend = monthlyMetrics.map((m) => ({
    month: m.month.slice(5),
    total: m.expenses,
  }));

  return (
    <div className="space-y-8">
      <PageHeader title="Expenses" subtitle="Track, analyse, and optimise your spending" />

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard label="Total Expenses" value={formatCurrency(totalExpenses)} changeType="negative" icon={<TrendingDown className="h-5 w-5" />} />
        <MetricCard label="Largest Category" value={categoryBreakdown[0]?.name || "N/A"} change={formatCurrency(categoryBreakdown[0]?.amount || 0)} changeType="neutral" icon={<DollarSign className="h-5 w-5" />} />
        <MetricCard label="Transactions" value={expenseTransactions.length.toString()} changeType="neutral" icon={<Search className="h-5 w-5" />} />
        <MetricCard label="Flagged" value={expenseTransactions.filter((t) => t.status === "unusual_spend").length.toString()} changeType="negative" icon={<AlertTriangle className="h-5 w-5" />} />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartCard title="Expense Trend" subtitle="Monthly spending pattern" height="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={expenseTrend}>
              <defs>
                <linearGradient id="expenseGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#F43F5E" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#F43F5E" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
              <XAxis dataKey="month" stroke="#64748b" fontSize={12} />
              <YAxis stroke="#64748b" fontSize={12} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(value) => formatCurrency(Number(value))} contentStyle={{ background: "#111827", border: "1px solid rgba(148,163,184,0.16)", borderRadius: "8px", fontSize: "12px", color: "#f1f5f9" }} />
              <Area type="monotone" dataKey="total" stroke="#F43F5E" fill="url(#expenseGrad)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Category Breakdown" subtitle="Where money goes" height="h-80">
          <div className="space-y-3">
            {categoryBreakdown.slice(0, 6).map((cat, i) => (
              <div key={cat.name}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="h-2 w-2 rounded-full shrink-0" style={{ background: COLORS[i % COLORS.length] }} />
                    <span className="text-xs font-medium text-[var(--foreground)] truncate">{cat.name}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 ml-2">
                    <span className="text-xs font-bold text-[var(--foreground)]">{formatCurrency(cat.amount)}</span>
                    <span className="text-[11px] text-[var(--muted-foreground)] w-8 text-right">{cat.percentage.toFixed(0)}%</span>
                  </div>
                </div>
                <div className="mt-1.5 h-1.5 rounded-full bg-[var(--border)] overflow-hidden">
                  <div className="h-full rounded-full transition-all" style={{ width: `${cat.percentage}%`, background: COLORS[i % COLORS.length] }} />
                </div>
              </div>
            ))}
          </div>
        </ChartCard>
      </div>

      {/* Transaction Table */}
      <div className="rounded-2xl border border-[var(--border)] bg-gradient-to-b from-[#111827] to-[#0c0c14] p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-[var(--foreground)]">Expense Transactions</h3>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--muted-foreground)]" />
            <input
              type="text"
              placeholder="Search transactions..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-64 rounded-lg border border-[var(--border)] bg-[#0a0a12] py-2 pl-9 pr-3 text-xs text-[var(--foreground)] placeholder:text-[var(--muted-foreground)]/50 focus:border-[var(--accent)] focus:outline-none"
            />
          </div>
        </div>
        <div className="space-y-2">
          {filteredTransactions.slice(0, 10).map((t) => (
            <div key={t.id} className="flex items-center justify-between rounded-lg border border-[var(--border)] bg-[#0a0a12] px-4 py-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="h-8 w-8 rounded-lg bg-[var(--danger)]/10 flex items-center justify-center text-[var(--danger)] shrink-0">
                  <TrendingDown className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-medium text-[var(--foreground)] truncate">{t.merchant || t.description}</p>
                  <p className="text-[11px] text-[var(--muted-foreground)]">{t.category} · {new Date(t.date).toLocaleDateString()}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span className="text-xs font-bold text-[var(--danger)]">-{formatCurrency(t.amount)}</span>
                <StatusBadge variant={t.status === "categorised" ? "success" : t.status === "ai_suggested" ? "highlight" : "warning"}>{t.status}</StatusBadge>
              </div>
            </div>
          ))}
        </div>
      </div>

      <AgentInsightCard title="Spending Intelligence">
        <div className="space-y-2 text-xs text-[var(--muted-foreground)]">
          <p>• Payroll is your largest expense at {formatCurrency(categoryBreakdown.find((c) => c.name === "Payroll")?.amount || 0)} ({((categoryBreakdown.find((c) => c.name === "Payroll")?.amount || 0) / totalExpenses * 100).toFixed(0)}% of total)</p>
          <p>• Cloud Infrastructure grew 12% month-over-month</p>
          <p>• 3 transactions flagged as unusual spend</p>
        </div>
      </AgentInsightCard>
    </div>
  );
}
