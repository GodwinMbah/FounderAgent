"use client";

import { PageHeader } from "@/components/ui/PageHeader";
import { MetricCard } from "@/components/ui/MetricCard";
import { ChartCard } from "@/components/ui/ChartCard";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { AgentInsightCard } from "@/components/ui/AgentInsightCard";
import { DataTable } from "@/components/ui/DataTable";
import { formatCurrency } from "@/lib/utils/formatters";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Wallet,
  CheckCircle,
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
  category?: string;
  amount: number;
  type: string;
}

interface Props {
  monthlyMetrics: MonthlyMetric[];
  transactions: Transaction[];
}

export default function CashFlowClient({ monthlyMetrics, transactions }: Props) {
  const latest = monthlyMetrics[monthlyMetrics.length - 1];
  const operatingCashIn = latest?.cashIn ?? 0;
  const operatingCashOut = latest?.cashOut ?? 0;
  const netCashFlow = latest?.profit ?? 0;
  const closingBalance = monthlyMetrics.reduce((sum, m) => sum + m.profit, 0);

  const monthly = monthlyMetrics.map((m) => ({
    month: m.month.slice(5),
    inflow: m.cashIn,
    outflow: m.cashOut,
    net: m.profit,
  }));

  const inflowMap = new Map<string, number>();
  const outflowMap = new Map<string, number>();
  for (const tx of transactions) {
    if (tx.type === "income") {
      inflowMap.set(tx.category ?? "Other", (inflowMap.get(tx.category ?? "Other") ?? 0) + tx.amount);
    } else {
      outflowMap.set(tx.category ?? "Other", (outflowMap.get(tx.category ?? "Other") ?? 0) + tx.amount);
    }
  }

  const inflowBySource = Array.from(inflowMap.entries()).map(([name, amount]) => ({ name, amount }));
  const outflowByCategory = Array.from(outflowMap.entries()).map(([name, amount]) => ({ name, amount }));

  const risks = [
    { title: "Ad spend increasing faster than revenue", severity: "warning" as const, impact: "Could compress margins if trend continues" },
    { title: "Strong cash inflow from enterprise clients", severity: "info" as const, impact: "Provides healthy operating buffer" },
  ];

  return (
    <div className="space-y-8">
      <PageHeader
        title="Cash Flow"
        subtitle="Track operating cash in, cash out, net cash flow, and closing balance."
      />

      {/* KPI Cards */}
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Operating Cash In"
          value={formatCurrency(operatingCashIn)}
          change="+12.5%"
          changeType="positive"
          icon={<ArrowDownLeft className="h-4 w-4" style={{ color: "#22C55E" }} />}
          iconColor="#22C55E"
        />
        <MetricCard
          label="Operating Cash Out"
          value={formatCurrency(operatingCashOut)}
          change="+3.2%"
          changeType="negative"
          icon={<ArrowUpRight className="h-4 w-4" style={{ color: "#F43F5E" }} />}
          iconColor="#F43F5E"
        />
        <MetricCard
          label="Net Cash Flow"
          value={formatCurrency(netCashFlow)}
          change="+18.1%"
          changeType="positive"
          icon={<Wallet className="h-4 w-4" style={{ color: "#14B8A6" }} />}
          iconColor="#14B8A6"
        />
        <MetricCard
          label="Closing Balance"
          value={formatCurrency(closingBalance)}
          change="Strong"
          changeType="positive"
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
              <YAxis tick={{ fill: "#94A3B8", fontSize: 12 }} axisLine={false} tickLine={false} tickFormatter={(v) => v ? `$${v / 1000}k` : ""} />
              <Tooltip contentStyle={tooltipStyle} formatter={(value) => value !== undefined ? formatCurrency(Number(value)) : ""} />
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
              <YAxis tick={{ fill: "#94A3B8", fontSize: 12 }} axisLine={false} tickLine={false} tickFormatter={(v) => v ? `$${v / 1000}k` : ""} />
              <Tooltip contentStyle={tooltipStyle} formatter={(value) => value !== undefined ? formatCurrency(Number(value)) : ""} />
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
              <YAxis tick={{ fill: "#94A3B8", fontSize: 12 }} axisLine={false} tickLine={false} tickFormatter={(v) => v ? `$${v / 1000}k` : ""} />
              <Tooltip contentStyle={tooltipStyle} formatter={(value) => value !== undefined ? formatCurrency(Number(value)) : ""} />
              <Bar dataKey="amount" fill="#F43F5E" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        </ChartCard>

        <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] overflow-hidden">
          <div className="px-5 py-4 border-b border-[var(--border)]">
            <h3 className="text-sm font-bold text-[var(--foreground)]">Cash Risks & Recommendations</h3>
            <p className="text-xs text-[var(--muted-foreground)] mt-0.5">FounderAgent analysis</p>
          </div>
          <div className="p-5 space-y-3">
            {risks.map((risk, i) => (
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
            ))}
          </div>
        </div>
      </div>

      {/* Agent Insight Card */}
      <AgentInsightCard title="FounderAgent Cash Analysis" orbSize={64}>
        <div className="flex items-start gap-2 text-sm text-[var(--muted-foreground)]">
          <Lightbulb className="h-4 w-4 text-[var(--accent)] shrink-0 mt-0.5" />
          <span>Your net cash flow of {formatCurrency(netCashFlow)} is healthy with an 18.1% improvement trend.</span>
        </div>
        <div className="flex items-start gap-2 text-sm text-[var(--muted-foreground)]">
          <Lightbulb className="h-4 w-4 text-[var(--accent)] shrink-0 mt-0.5" />
          <span>Operating cash in covers 2.2x cash out, providing a strong buffer for growth investments.</span>
        </div>
        <div className="flex items-start gap-2 text-sm text-[var(--muted-foreground)]">
          <Lightbulb className="h-4 w-4 text-[var(--accent)] shrink-0 mt-0.5" />
          <span>Monitor advertising spend closely — it is the fastest-growing outflow category.</span>
        </div>
      </AgentInsightCard>

      {/* Cash Movement Table */}
      <ChartCard title="Cash Movement Detail" subtitle="Monthly breakdown">
        <DataTable
          columns={[
            { key: "month", header: "Month" },
            { key: "inflow", header: "Inflow", align: "right", render: (row: { inflow: number }) => <span className="text-[#22C55E] font-medium">{formatCurrency(row.inflow)}</span> },
            { key: "outflow", header: "Outflow", align: "right", render: (row: { outflow: number }) => <span className="text-[#F43F5E] font-medium">{formatCurrency(row.outflow)}</span> },
            { key: "net", header: "Net", align: "right", render: (row: { net: number }) => <span className="font-bold text-[#F1F5F9]">{formatCurrency(row.net)}</span> },
            { key: "status", header: "Status", align: "center", render: (row: { net: number }) => <StatusBadge variant={row.net >= 0 ? "success" : "danger"}>{row.net >= 0 ? "Positive" : "Negative"}</StatusBadge> },
          ]}
          data={monthly}
          keyExtractor={(row: { month: string }) => row.month}
        />
      </ChartCard>
    </div>
  );
}
