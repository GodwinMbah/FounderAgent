"use client";

import { PageHeader } from "@/components/ui/PageHeader";
import { MetricCard } from "@/components/ui/MetricCard";
import { ChartCard } from "@/components/ui/ChartCard";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { AgentInsightCard } from "@/components/ui/AgentInsightCard";
import { DataTable } from "@/components/ui/DataTable";
import { formatCurrency, formatCurrencyCompact } from "@/lib/utils/formatters";
import { useCompanyCurrency } from "@/lib/hooks/useCompanyCurrency";
import { calculateChangePercent } from "@/lib/reporting/kpis";
import { isCashMovementIn, isCashMovementOut } from "@/lib/reporting/filters";
import { getDateRange, type DateRangePreset } from "@/lib/date-range";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Wallet,
  CheckCircle,
  AlertTriangle,
  Lightbulb,
} from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";

const tooltipStyle = {
  background: "#111827",
  border: "1px solid rgba(148,163,184,0.16)",
  borderRadius: "8px",
  fontSize: "12px",
  color: "#f1f5f9",
};

interface MonthlyMetric {
  month: string;
  revenue: number;
  expenses: number;
  profit: number;
  cashIn: number;
  cashOut: number;
}

interface Transaction {
  uploadId?: string;
  category?: string;
  amount: number;
  type: string;
  tags?: string[];
  rowStatus?: string;
  row_status?: string;
  kpiExcluded?: boolean;
  kpi_excluded?: boolean;
  kpiExclusionReason?: string;
  kpi_exclusion_reason?: string;
  metadata?: Record<string, unknown> | null;
}

interface Props {
  monthlyMetrics: MonthlyMetric[];
  transactions: Transaction[];
  totalCashBalance: number;
  initialPreset: DateRangePreset;
  initialFrom: string;
  initialTo: string;
}

export default function CashFlowClient({
  monthlyMetrics,
  transactions,
  totalCashBalance,
  initialPreset,
  initialFrom,
  initialTo,
}: Props) {
  const { currency } = useCompanyCurrency();
  const latest = monthlyMetrics[monthlyMetrics.length - 1];
  const prev = monthlyMetrics[monthlyMetrics.length - 2];
  const cashIn = latest?.cashIn ?? 0;
  const cashOut = latest?.cashOut ?? 0;
  const netCashMovement = cashIn - cashOut;
  const closingBalance = totalCashBalance;

  const cashInChange = calculateChangePercent(latest?.cashIn, prev?.cashIn);
  const cashOutChange = calculateChangePercent(latest?.cashOut, prev?.cashOut, true);
  const netChange = calculateChangePercent(netCashMovement, prev ? prev.cashIn - prev.cashOut : undefined);
  const sourceUploadCount = new Set(transactions.map((t) => t.uploadId).filter(Boolean)).size;

  const monthly = monthlyMetrics.map((m) => ({
    month: m.month.slice(5),
    inflow: m.cashIn,
    outflow: m.cashOut,
    net: m.cashIn - m.cashOut,
  }));

  const inflowMap = new Map<string, number>();
  const outflowMap = new Map<string, number>();
  for (const tx of transactions) {
    if (isCashMovementIn(tx)) {
      inflowMap.set(tx.category ?? "Other", (inflowMap.get(tx.category ?? "Other") ?? 0) + tx.amount);
    } else if (isCashMovementOut(tx)) {
      outflowMap.set(tx.category ?? "Other", (outflowMap.get(tx.category ?? "Other") ?? 0) + tx.amount);
    }
  }

  const inflowBySource = Array.from(inflowMap.entries()).map(([name, amount]) => ({ name, amount }));
  const outflowByCategory = Array.from(outflowMap.entries()).map(([name, amount]) => ({ name, amount }));

  // Derive risks from actual transaction trends or show honest empty state
  const risks: Array<{ title: string; severity: "warning" | "info"; impact: string }> = [];
  if (outflowByCategory.length > 0 && inflowBySource.length > 0) {
    const topOutflow = outflowByCategory.sort((a, b) => b.amount - a.amount)[0];
    const totalOutflow = outflowByCategory.reduce((s, c) => s + c.amount, 0);
    if (topOutflow && totalOutflow > 0) {
      risks.push({
        title: `${topOutflow.name} is your largest outflow`,
        severity: "warning",
        impact: `${Math.round((topOutflow.amount / totalOutflow) * 100)}% of total cash out`,
      });
    }
    if (netCashMovement < 0) {
      risks.push({
        title: "Net cash movement is negative",
        severity: "warning",
        impact: "Review discretionary expenses to extend runway",
      });
    } else if (netCashMovement > 0) {
      risks.push({
        title: "Net cash movement is positive",
        severity: "info",
        impact: "Healthy operating buffer for growth investments",
      });
    }
  }

  return (
    <div className="space-y-8">
      <PageHeader title="Cash Flow" subtitle="Track cash movement, operating P&L context, and closing balance." />

      {/* Date Range Label */}
      <div className="flex items-center justify-end">
        <span className="text-xs text-[var(--muted-foreground)]">
          {getDateRange(initialPreset, initialFrom, initialTo).label} · Source: {transactions.length} transaction{transactions.length !== 1 ? "s" : ""} from {sourceUploadCount} upload{sourceUploadCount !== 1 ? "s" : ""}
        </span>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Cash In"
          value={formatCurrency(cashIn, 0, currency)}
          change={cashInChange.text}
          changeType={cashInChange.type}
          icon={<ArrowDownLeft className="h-4 w-4" style={{ color: "#22C55E" }} />}
          iconColor="#22C55E"
        />
        <MetricCard
          label="Cash Out"
          value={formatCurrency(cashOut, 0, currency)}
          change={cashOutChange.text}
          changeType={cashOutChange.type}
          icon={<ArrowUpRight className="h-4 w-4" style={{ color: "#F43F5E" }} />}
          iconColor="#F43F5E"
        />
        <MetricCard
          label="Net Cash Movement"
          value={formatCurrency(netCashMovement, 0, currency)}
          change={netChange.text}
          changeType={netChange.type}
          icon={<Wallet className="h-4 w-4" style={{ color: "#14B8A6" }} />}
          iconColor="#14B8A6"
        />
        <MetricCard
          label="Closing Balance"
          value={formatCurrency(closingBalance, 0, currency)}
          change={closingBalance > 0 ? "Positive" : "Negative"}
          changeType={closingBalance > 0 ? "positive" : "negative"}
          icon={<CheckCircle className="h-4 w-4" style={{ color: "#8B5CF6" }} />}
          iconColor="#8B5CF6"
        />
      </div>

      {/* Charts Row 1 */}
      <div className="grid gap-5 lg:grid-cols-2">
        <ChartCard title="Monthly Cash Movement" subtitle="Inflow vs outflow over time">
          <div className="w-full h-full min-h-0 min-w-0">
            <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 1, height: 1 }}>
              <AreaChart data={monthly} margin={{ top: 10, right: 10, left: 10, bottom: 5 }}>
                <defs>
                  <linearGradient id="inflowGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#22C55E" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#22C55E" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="outflowGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#F43F5E" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#F43F5E" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.08)" />
                <XAxis dataKey="month" tick={{ fill: "#94A3B8", fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "#94A3B8", fontSize: 12 }} axisLine={false} tickLine={false} tickFormatter={(v) => v ? formatCurrencyCompact(Number(v), currency) : ""} />
                <Tooltip contentStyle={tooltipStyle} formatter={(value) => value !== undefined ? formatCurrency(Number(value), 0, currency) : ""} />
                <Area type="monotone" dataKey="inflow" stroke="#22C55E" strokeWidth={2} fill="url(#inflowGrad)" />
                <Area type="monotone" dataKey="outflow" stroke="#F43F5E" strokeWidth={2} fill="url(#outflowGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        <ChartCard title="Cash Inflow by Source" subtitle="Where money comes from">
          <div className="w-full h-full min-h-0 min-w-0">
            <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 1, height: 1 }}>
              <BarChart data={inflowBySource} margin={{ top: 10, right: 10, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.08)" />
                <XAxis dataKey="name" tick={{ fill: "#94A3B8", fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "#94A3B8", fontSize: 12 }} axisLine={false} tickLine={false} tickFormatter={(v) => v ? formatCurrencyCompact(Number(v), currency) : ""} />
                <Tooltip contentStyle={tooltipStyle} formatter={(value) => value !== undefined ? formatCurrency(Number(value), 0, currency) : ""} />
                <Bar dataKey="amount" fill="#22C55E" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>
      </div>

      {/* Charts Row 2 + Risks */}
      <div className="grid gap-5 lg:grid-cols-2">
        <ChartCard title="Cash Outflow by Category" subtitle="Where money goes">
          <div className="w-full h-full min-h-0 min-w-0">
            <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 1, height: 1 }}>
              <BarChart data={outflowByCategory} margin={{ top: 10, right: 10, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.08)" />
                <XAxis dataKey="name" tick={{ fill: "#94A3B8", fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "#94A3B8", fontSize: 12 }} axisLine={false} tickLine={false} tickFormatter={(v) => v ? formatCurrencyCompact(Number(v), currency) : ""} />
                <Tooltip contentStyle={tooltipStyle} formatter={(value) => value !== undefined ? formatCurrency(Number(value), 0, currency) : ""} />
                <Bar dataKey="amount" fill="#F43F5E" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] overflow-hidden">
          <div className="px-5 py-4 border-b border-[var(--border)]">
            <h3 className="text-sm font-bold text-[var(--foreground)]">Cash Risks & Recommendations</h3>
            <p className="text-xs text-[var(--muted-foreground)] mt-0.5">Based on {transactions.length} source transactions</p>
          </div>
          <div className="p-5 space-y-3">
            {risks.length > 0 ? (
              risks.map((risk, i) => (
                <div key={i} className="flex items-start gap-3 rounded-lg border border-[var(--border)] bg-[var(--background)] p-3">
                  {risk.severity === "warning" ? (
                    <AlertTriangle className="h-4 w-4 text-[#FBBF24] shrink-0 mt-0.5" />
                  ) : (
                    <CheckCircle className="h-4 w-4 text-[#22C55E] shrink-0 mt-0.5" />
                  )}
                  <div>
                    <p className="text-sm font-medium text-[var(--foreground)]">{risk.title}</p>
                    <p className="text-xs text-[var(--muted-foreground)] mt-0.5">{risk.impact}</p>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-[var(--muted-foreground)] text-center py-6">
                FounderAgent will surface cash risks here once enough transaction history is available.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Agent Insight Card */}
      <AgentInsightCard title="FounderAgent Cash Analysis" orbSize={64}>
        <div className="flex items-start gap-2 text-sm text-[var(--muted-foreground)]">
          <Lightbulb className="h-4 w-4 text-[var(--accent)] shrink-0 mt-0.5" />
          <span>Your net cash movement of {formatCurrency(netCashMovement, 0, currency)} is {netChange.type === "positive" ? "healthy" : netChange.type === "negative" ? "negative" : "stable"} with a {netChange.text} trend.</span>
        </div>
        <div className="flex items-start gap-2 text-sm text-[var(--muted-foreground)]">
          <Lightbulb className="h-4 w-4 text-[var(--accent)] shrink-0 mt-0.5" />
          <span>Cash in covers {cashOut > 0 ? (cashIn / cashOut).toFixed(1) : "—"}x cash out, including non-operating movements for reconciliation.</span>
        </div>
        <div className="flex items-start gap-2 text-sm text-[var(--muted-foreground)]">
          <Lightbulb className="h-4 w-4 text-[var(--accent)] shrink-0 mt-0.5" />
          <span>
            {outflowByCategory.length > 0
              ? `Your largest outflow category is ${outflowByCategory.sort((a, b) => b.amount - a.amount)[0]?.name}.`
              : "FounderAgent monitors outflow categories for unusual growth patterns."}
          </span>
        </div>
      </AgentInsightCard>

      {/* Cash Movement Table */}
      <ChartCard title="Cash Movement Detail" subtitle="Monthly breakdown">
        <DataTable
          columns={[
            { key: "month", header: "Month" },
            { key: "inflow", header: "Inflow", align: "right", render: (row: { inflow: number }) => <span className="text-[#22C55E] font-medium">{formatCurrency(row.inflow, 0, currency)}</span> },
            { key: "outflow", header: "Outflow", align: "right", render: (row: { outflow: number }) => <span className="text-[#F43F5E] font-medium">{formatCurrency(row.outflow, 0, currency)}</span> },
            { key: "net", header: "Net", align: "right", render: (row: { net: number }) => <span className="font-bold text-[#F1F5F9]">{formatCurrency(row.net, 0, currency)}</span> },
            { key: "status", header: "Status", align: "center", render: (row: { net: number }) => <StatusBadge variant={row.net >= 0 ? "success" : "danger"}>{row.net >= 0 ? "Positive" : "Negative"}</StatusBadge> },
          ]}
          data={monthly}
          keyExtractor={(row: { month: string }) => row.month}
        />
      </ChartCard>
    </div>
  );
}
