"use client";

import { PageHeader } from "@/components/ui/PageHeader";
import { MetricCard } from "@/components/ui/MetricCard";
import { ChartCard } from "@/components/ui/ChartCard";
import { DataTable } from "@/components/ui/DataTable";
import { formatCurrency, formatCurrencyCompact, formatPercent, formatShortMonth } from "@/lib/utils/formatters";
import { useCompanyCurrency } from "@/lib/hooks/useCompanyCurrency";
import { calculateChangePercent, profitMargin } from "@/lib/reporting/kpis";
import { isIncome, isExpense } from "@/lib/reporting/filters";
import { getDateRange, type DateRangePreset } from "@/lib/date-range";
import {
  BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { TrendingUp, TrendingDown, Wallet, Percent } from "lucide-react";

const tooltipStyle = {
  background: "#111827",
  border: "1px solid rgba(148,163,184,0.16)",
  borderRadius: "8px",
  fontSize: "12px",
  color: "#f1f5f9",
};

const pieColors = [
  "#14B8A6", "#8B5CF6", "#22C55E", "#FBBF24", "#F43F5E", "#38BDF8", "#A78BFA", "#22D3EE", "#94A3B8",
];

interface MonthlyMetric {
  month: string;
  revenue: number;
  expenses: number;
  profit: number;
}

interface Transaction {
  category?: string;
  amount: number;
  type: string;
  tags?: string[];
}

interface Props {
  monthlyMetrics: MonthlyMetric[];
  transactions: Transaction[];
  initialPreset: string;
  initialFrom: string;
  initialTo: string;
}

export default function PLReportClient({
  monthlyMetrics,
  transactions,
  initialPreset,
  initialFrom,
  initialTo,
}: Props) {
  const { currency } = useCompanyCurrency();
  const totalRevenue = monthlyMetrics.reduce((sum, m) => sum + m.revenue, 0);
  const totalExpenses = monthlyMetrics.reduce((sum, m) => sum + m.expenses, 0);
  const netProfit = totalRevenue - totalExpenses;
  const avgMargin = monthlyMetrics.reduce((sum, m) => sum + profitMargin(m.revenue, m.expenses), 0) / monthlyMetrics.length;

  const chartData = monthlyMetrics.map((m) => ({
    month: formatShortMonth(m.month),
    revenue: m.revenue,
    expenses: m.expenses,
    profit: m.profit,
    margin: m.revenue > 0 ? (m.profit / m.revenue) * 100 : 0,
  }));

  const expenseMap = new Map<string, number>();
  const revenueMap = new Map<string, number>();
  for (const tx of transactions) {
    if (isExpense(tx)) {
      expenseMap.set(tx.category ?? "Other", (expenseMap.get(tx.category ?? "Other") ?? 0) + tx.amount);
    } else if (isIncome(tx)) {
      revenueMap.set(tx.category ?? "Other", (revenueMap.get(tx.category ?? "Other") ?? 0) + tx.amount);
    }
  }

  const expenseTotal = Array.from(expenseMap.values()).reduce((s, v) => s + v, 0);
  const revenueTotal = Array.from(revenueMap.values()).reduce((s, v) => s + v, 0);

  const expenseCategories = Array.from(expenseMap.entries()).map(([name, amount]) => ({
    name,
    amount,
    percentage: expenseTotal > 0 ? Math.round((amount / expenseTotal) * 1000) / 10 : 0,
  }));
  const revenueCategories = Array.from(revenueMap.entries()).map(([name, amount]) => ({
    name,
    amount,
    percentage: revenueTotal > 0 ? Math.round((amount / revenueTotal) * 1000) / 10 : 0,
  }));

  // Real MoM changes
  const sorted = [...monthlyMetrics].sort((a, b) => a.month.localeCompare(b.month));
  const currMonth = sorted[sorted.length - 1];
  const prevMonth = sorted[sorted.length - 2];
  const revChange = calculateChangePercent(currMonth?.revenue, prevMonth?.revenue);
  const expChange = calculateChangePercent(currMonth?.expenses, prevMonth?.expenses, true);
  const profitChange = calculateChangePercent(currMonth?.profit, prevMonth?.profit);
  const marginChange = calculateChangePercent(
    currMonth ? profitMargin(currMonth.revenue, currMonth.expenses) : 0,
    prevMonth ? profitMargin(prevMonth.revenue, prevMonth.expenses) : 0
  );

  return (
    <div className="space-y-8">
      <PageHeader title="Profit and Loss Report" subtitle="Monthly P and L breakdown, revenue composition, and expense intelligence." />

      {/* Date label */}
      <div className="flex items-center justify-end">
        <span className="text-xs text-[var(--muted-foreground)] hidden sm:inline">
          {getDateRange(initialPreset as DateRangePreset, initialFrom, initialTo).label}
        </span>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Total Revenue"
          value={formatCurrency(totalRevenue, 0, currency)}
          change={revChange.text}
          changeType={revChange.type}
          icon={<TrendingUp className="h-5 w-5" />}
          iconColor="#22C55E"
        />
        <MetricCard
          label="Total Expenses"
          value={formatCurrency(totalExpenses, 0, currency)}
          change={expChange.text}
          changeType={expChange.type}
          icon={<TrendingDown className="h-5 w-5" />}
          iconColor="#F43F5E"
        />
        <MetricCard
          label="Net Profit"
          value={formatCurrency(netProfit, 0, currency)}
          change={profitChange.text}
          changeType={profitChange.type}
          icon={<Wallet className="h-5 w-5" />}
          iconColor="#14B8A6"
        />
        <MetricCard
          label="Avg Margin"
          value={formatPercent(avgMargin)}
          change={marginChange.text}
          changeType={marginChange.type}
          icon={<Percent className="h-5 w-5" />}
          iconColor="#8B5CF6"
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <ChartCard title="Monthly Breakdown" subtitle="Revenue vs Expenses vs Profit">
          <div className="w-full h-full min-h-0 min-w-0">
            <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 1, height: 1 }}>
              <BarChart data={chartData} barGap={4}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.12)" />
                <XAxis dataKey="month" tick={{ fill: "#94A3B8", fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "#94A3B8", fontSize: 12 }} axisLine={false} tickLine={false} tickFormatter={(v) => v !== undefined ? formatCurrencyCompact(Number(v), currency) : ""} />
                <Tooltip contentStyle={tooltipStyle} formatter={(value) => value !== undefined ? formatCurrency(Number(value), 0, currency) : ""} />
                <Legend wrapperStyle={{ fontSize: "12px", color: "#94A3B8" }} />
                <Bar dataKey="revenue" fill="#22C55E" radius={[4, 4, 0, 0]} />
                <Bar dataKey="expenses" fill="#F43F5E" radius={[4, 4, 0, 0]} />
                <Bar dataKey="profit" fill="#14B8A6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        <ChartCard title="Expense Breakdown" subtitle="By category">
          <div className="w-full h-full min-h-0 min-w-0">
            <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 1, height: 1 }}>
              <PieChart>
                <Pie
                  data={expenseCategories}
                  dataKey="amount"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={90}
                  innerRadius={50}
                  paddingAngle={2}
                  stroke="none"
                >
                  {expenseCategories.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={pieColors[index % pieColors.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} formatter={(value) => value !== undefined ? formatCurrency(Number(value), 0, currency) : ""} />
                <Legend wrapperStyle={{ fontSize: "12px", color: "#94A3B8" }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        <ChartCard title="Revenue Composition" subtitle="By source">
          <div className="w-full h-full min-h-0 min-w-0">
            <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 1, height: 1 }}>
              <BarChart data={revenueCategories} layout="vertical" barSize={24}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.12)" horizontal={false} />
                <XAxis type="number" tick={{ fill: "#94A3B8", fontSize: 12 }} axisLine={false} tickLine={false} tickFormatter={(v) => v !== undefined ? formatCurrencyCompact(Number(v), currency) : ""} />
                <YAxis type="category" dataKey="name" tick={{ fill: "#94A3B8", fontSize: 12 }} axisLine={false} tickLine={false} width={120} />
                <Tooltip contentStyle={tooltipStyle} formatter={(value) => value !== undefined ? formatCurrency(Number(value), 0, currency) : ""} />
                <Bar dataKey="amount" fill="#8B5CF6" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        <ChartCard title="Monthly Breakdown Table" subtitle="Detailed view">
          <DataTable
            columns={[
              { key: "month", header: "Month" },
              { key: "revenue", header: "Revenue", align: "right", render: (row: { revenue: number }) => formatCurrency(row.revenue, 0, currency) },
              { key: "expenses", header: "Expenses", align: "right", render: (row: { expenses: number }) => formatCurrency(row.expenses, 0, currency) },
              { key: "profit", header: "Profit", align: "right", render: (row: { profit: number }) => formatCurrency(row.profit, 0, currency) },
              { key: "margin", header: "Margin", align: "right", render: (row: { margin: number }) => formatPercent(row.margin) },
            ]}
            data={chartData}
            keyExtractor={(row: { month: string }) => row.month}
          />
        </ChartCard>
      </div>
    </div>
  );
}
