"use client";

import { PageHeader } from "@/components/ui/PageHeader";
import { MetricCard } from "@/components/ui/MetricCard";
import { ChartCard } from "@/components/ui/ChartCard";
import { AgentInsightCard } from "@/components/ui/AgentInsightCard";
import { formatCurrency, formatCurrencyCompact } from "@/lib/utils/formatters";
import { useCompanyCurrency } from "@/lib/hooks/useCompanyCurrency";
import { getDateRange, type DateRangePreset } from "@/lib/date-range";
import { calculateChangePercent, monthlyBurn, runwayMonths } from "@/lib/reporting/kpis";
import {
  Clock,
  Shield,
  Flame,
  TrendingUp,
  TrendingDown,
  ChevronRight,
} from "lucide-react";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from "recharts";

const tooltipStyle = {
  background: "#111827",
  border: "1px solid rgba(148,163,184,0.16)",
  borderRadius: "8px",
  fontSize: "12px",
  color: "#f1f5f9",
};

const scenarioColors = ["#F43F5E", "#FBBF24", "#22C55E", "#8B5CF6"];

interface RunwayMetrics {
  cashBalance: number;
  monthlyBurn: number;
  runwayMonths: number;
  monthlyRevenue: number;
  monthlyExpenses: number;
  monthlySubscriptionSpend: number;
}

interface MonthlyMetric {
  month: string;
  expenses: number;
}

interface Props {
  metrics: RunwayMetrics;
  monthlyMetrics: MonthlyMetric[];
  initialPreset: DateRangePreset;
  initialFrom: string;
  initialTo: string;
}

function formatRunway(months: number): string {
  if (!Number.isFinite(months)) return "Infinite";
  if (months < 1) return "< 1 mo";
  if (months < 12) return `${Math.round(months)} mo`;
  return `${(months / 12).toFixed(1)} yr`;
}

function cashStatus(runway: number): { text: string; type: "positive" | "negative" | "neutral" } {
  if (!Number.isFinite(runway)) return { text: "Strong", type: "positive" };
  if (runway >= 12) return { text: "Healthy", type: "positive" };
  if (runway >= 6) return { text: "Adequate", type: "neutral" };
  if (runway >= 3) return { text: "At Risk", type: "negative" };
  return { text: "Critical", type: "negative" };
}

export default function RunwayClient({
  metrics,
  monthlyMetrics,
  initialPreset,
  initialFrom,
  initialTo,
}: Props) {
  const { currency } = useCompanyCurrency();
  const {
    cashBalance,
    monthlyBurn: currentMonthlyBurn,
    runwayMonths: currentRunwayMonths,
    monthlyRevenue,
    monthlyExpenses,
    monthlySubscriptionSpend,
  } = metrics;

  // Real scenario modeling
  const baseCase = { months: currentRunwayMonths, scenario: "Current trajectory" };
  const bestCase = {
    months: runwayMonths(cashBalance, monthlyBurn(monthlyRevenue * 1.20, monthlyExpenses * 0.95)),
    scenario: "20% revenue growth, 5% expense reduction",
  };
  const worstCase = {
    months: runwayMonths(cashBalance, monthlyBurn(monthlyRevenue * 0.85, monthlyExpenses * 1.10)),
    scenario: "15% revenue drop, 10% expense increase",
  };

  const burnTrend = monthlyMetrics.map((m) => ({ month: m.month.slice(5), burn: m.expenses }));

  // Real burn change
  const sorted = [...monthlyMetrics].sort((a, b) => a.month.localeCompare(b.month));
  const currMonth = sorted[sorted.length - 1];
  const prevMonth = sorted[sorted.length - 2];
  const burnChange = calculateChangePercent(currMonth?.expenses, prevMonth?.expenses, true);

  // Scenario list with real math
  const scenarios = [
    {
      name: "Revenue Drop 20%",
      runway: runwayMonths(cashBalance, monthlyBurn(monthlyRevenue * 0.80, monthlyExpenses)),
      impact: `-${formatCurrency(monthlyRevenue * 0.20, 0, currency)}/mo revenue`,
      probability: "Low",
    },
    {
      name: "Expense Increase 15%",
      runway: runwayMonths(cashBalance, monthlyBurn(monthlyRevenue, monthlyExpenses * 1.15)),
      impact: `+${formatCurrency(monthlyExpenses * 0.15, 0, currency)}/mo burn`,
      probability: "Medium",
    },
    {
      name: "Software Reduction 30%",
      runway: runwayMonths(cashBalance, monthlyBurn(monthlyRevenue, monthlyExpenses - monthlySubscriptionSpend * 0.30)),
      impact: `-${formatCurrency(monthlySubscriptionSpend * 0.30, 0, currency)}/mo`,
      probability: "High",
    },
    {
      name: "Expense Reduction 10%",
      runway: runwayMonths(cashBalance, monthlyBurn(monthlyRevenue, monthlyExpenses * 0.90)),
      impact: `-${formatCurrency(monthlyExpenses * 0.10, 0, currency)}/mo burn`,
      probability: "Planned",
    },
  ];

  const scenarioChartData = scenarios.map((s) => ({ name: s.name, runway: s.runway }));

  const status = cashStatus(currentRunwayMonths);

  const recommendations = [
    `Current runway is ${currentRunwayMonths >= 12 ? "healthy" : currentRunwayMonths >= 6 ? "adequate" : "concerning"} at ${formatRunway(currentRunwayMonths)}`,
    `Consider building a 6-month emergency fund (${formatCurrency(currentMonthlyBurn * 6, 0, currency)})`,
    monthlySubscriptionSpend > 0
      ? `Software reduction could save ${formatCurrency(monthlySubscriptionSpend * 0.30, 0, currency)}/month and extend runway by ${Math.max(0, Math.round(runwayMonths(cashBalance, monthlyBurn(monthlyRevenue, monthlyExpenses - monthlySubscriptionSpend * 0.30)) - currentRunwayMonths))} months`
      : "Review discretionary expenses to extend runway",
    currentRunwayMonths < 12
      ? `Priority: reach 12+ month runway through revenue growth or cost optimisation`
      : `Hiring plan can proceed while maintaining 12+ month runway`,
  ];

  return (
    <div className="space-y-8">
      <PageHeader title="Runway" subtitle="Model scenarios and forecast how long your business can operate." />

      {/* Date range label */}
      <div className="flex items-center justify-end">
        <span className="text-xs text-[var(--muted-foreground)] hidden sm:inline">
          {getDateRange(initialPreset, initialFrom, initialTo).label}
        </span>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Base Case Runway"
          value={formatRunway(baseCase.months)}
          change={baseCase.scenario}
          changeType="positive"
          icon={<Clock className="h-4 w-4" style={{ color: "#14B8A6" }} />}
          iconColor="#14B8A6"
        />
        <MetricCard
          label="Cash Balance"
          value={formatCurrency(cashBalance, 0, currency)}
          change={status.text}
          changeType={status.type}
          icon={<Shield className="h-4 w-4" style={{ color: "#22C55E" }} />}
          iconColor="#22C55E"
        />
        <MetricCard
          label="Monthly Burn"
          value={formatCurrency(currentMonthlyBurn, 0, currency)}
          change={burnChange.text}
          changeType={burnChange.type}
          icon={<Flame className="h-4 w-4" style={{ color: "#F43F5E" }} />}
          iconColor="#F43F5E"
        />
        <MetricCard
          label="Best Case"
          value={formatRunway(bestCase.months)}
          change={bestCase.scenario}
          changeType="positive"
          icon={<TrendingUp className="h-4 w-4" style={{ color: "#8B5CF6" }} />}
          iconColor="#8B5CF6"
        />
      </div>

      {/* Worst-case banner */}
      <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <TrendingDown className="h-5 w-5 text-[#F43F5E]" />
          <div>
            <p className="text-sm font-semibold text-[var(--foreground)]">Worst Case Runway</p>
            <p className="text-xs text-[var(--muted-foreground)]">{worstCase.scenario}</p>
          </div>
        </div>
        <p className="text-lg font-bold text-[var(--foreground)]">{formatRunway(worstCase.months)}</p>
      </div>

      {/* Charts Row */}
      <div className="grid gap-5 lg:grid-cols-2">
        <ChartCard title="Burn Trend" subtitle="Monthly expense burn over time">
          <div className="w-full h-full min-h-0 min-w-0">
            <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 1, height: 1 }}>
              <LineChart data={burnTrend} margin={{ top: 10, right: 10, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.08)" />
                <XAxis dataKey="month" tick={{ fill: "#94A3B8", fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "#94A3B8", fontSize: 12 }} axisLine={false} tickLine={false} tickFormatter={(v) => formatCurrencyCompact(Number(v), currency)} />
                <Tooltip contentStyle={tooltipStyle} formatter={(value) => value !== undefined ? formatCurrency(Number(value), 0, currency) : ""} />
                <Line type="monotone" dataKey="burn" stroke="#F43F5E" strokeWidth={2} dot={{ r: 3, fill: "#F43F5E" }} activeDot={{ r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        <ChartCard title="Scenario Comparison" subtitle="Runway under different conditions">
          <div className="w-full h-full min-h-0 min-w-0">
            <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 1, height: 1 }}>
              <BarChart data={scenarioChartData} margin={{ top: 10, right: 10, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.08)" />
                <XAxis dataKey="name" tick={{ fill: "#94A3B8", fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "#94A3B8", fontSize: 12 }} axisLine={false} tickLine={false} label={{ value: "Months", angle: -90, position: "insideLeft", fill: "#94A3B8", fontSize: 11 }} />
                <Tooltip contentStyle={tooltipStyle} formatter={(value) => value !== undefined ? `${value} months` : ""} />
                <Bar dataKey="runway" radius={[6, 6, 0, 0]}>
                  {scenarioChartData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={scenarioColors[index % scenarioColors.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>
      </div>

      {/* Scenario Analysis List */}
      <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] overflow-hidden">
        <div className="px-5 py-4 border-b border-[var(--border)]">
          <h3 className="text-sm font-bold text-[var(--foreground)]">Scenario Analysis</h3>
          <p className="text-xs text-[var(--muted-foreground)] mt-0.5">How different situations affect runway</p>
        </div>
        <div className="p-5 space-y-3">
          {scenarios.map((scenario, i) => (
            <div key={i} className="flex items-center justify-between rounded-lg border border-[var(--border)] bg-[var(--background)] p-3">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: `${scenarioColors[i]}15` }}>
                  {scenario.impact.startsWith("-") ? (
                    <TrendingUp className="h-4 w-4" style={{ color: scenarioColors[i] }} />
                  ) : (
                    <TrendingDown className="h-4 w-4" style={{ color: scenarioColors[i] }} />
                  )}
                </div>
                <div>
                  <p className="text-sm font-medium text-[var(--foreground)]">{scenario.name}</p>
                  <p className="text-xs text-[var(--muted-foreground)]">{scenario.impact} · {scenario.probability} probability</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold text-[var(--foreground)]">{formatRunway(scenario.runway)}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Agent Recommendations Card */}
      <AgentInsightCard title="FounderAgent Runway Analysis" orbSize={64}>
        {recommendations.map((rec, i) => (
          <div key={i} className="flex items-start gap-2 text-sm text-[var(--muted-foreground)]">
            <ChevronRight className="h-4 w-4 text-[var(--accent)] shrink-0 mt-0.5" />
            <span>{rec}</span>
          </div>
        ))}
      </AgentInsightCard>
    </div>
  );
}
