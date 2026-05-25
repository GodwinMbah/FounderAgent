"use client";

import { PageHeader } from "@/components/ui/PageHeader";
import { MetricCard } from "@/components/ui/MetricCard";
import { ChartCard } from "@/components/ui/ChartCard";
import { AgentInsightCard } from "@/components/ui/AgentInsightCard";
import { formatCurrency } from "@/lib/utils/formatters";
import {
  Clock,
  Shield,
  Flame,
  TrendingUp,
  TrendingDown,
  ChevronRight,
} from "lucide-react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

const tooltipStyle = {
  background: "#111827",
  border: "1px solid rgba(148,163,184,0.16)",
  borderRadius: "8px",
  fontSize: "12px",
  color: "#f1f5f9",
};

const scenarioColors = ["#F43F5E", "#FBBF24", "#22C55E", "#8B5CF6"];

interface DashboardMetrics {
  cashBalance: number;
  monthlyBurn: number;
  runwayMonths: number;
}

interface MonthlyMetric {
  month: string;
  expenses: number;
}

interface Props {
  metrics: DashboardMetrics;
  monthlyMetrics: MonthlyMetric[];
}

export default function RunwayClient({ metrics, monthlyMetrics }: Props) {
  const baseCase = { months: metrics.runwayMonths, scenario: "Current trajectory" };
  const cashBalance = metrics.cashBalance;
  const monthlyBurn = metrics.monthlyBurn;
  const bestCase = { months: Math.floor(metrics.runwayMonths * 1.5), scenario: "20% revenue growth, 5% expense reduction" };

  const burnTrend = monthlyMetrics.map((m) => ({ month: m.month.slice(5), burn: m.expenses }));

  const scenarios = [
    { name: "Revenue Drop 20%", runway: Math.max(0, metrics.runwayMonths - 6), impact: "-$9,650/mo", probability: "Low" },
    { name: "Expense Increase 15%", runway: Math.max(0, metrics.runwayMonths - 5), impact: `+$${(metrics.monthlyBurn * 0.15).toFixed(0)}/mo`, probability: "Medium" },
    { name: "Software Reduction 30%", runway: metrics.runwayMonths + 4, impact: "-$836/mo", probability: "High" },
    { name: "Hire 3 Engineers", runway: Math.max(0, metrics.runwayMonths - 8), impact: "+$25,000/mo", probability: "Planned" },
  ];

  const scenarioChartData = scenarios.map((s) => ({
    name: s.name,
    runway: s.runway,
  }));

  const recommendations = [
    `Current runway is healthy at ${metrics.runwayMonths} months with positive cash flow`,
    `Consider building a 6-month emergency fund (${formatCurrency(metrics.monthlyBurn * 6)})`,
    `Software reduction could extend runway by 4 months`,
    `Hiring plan should be phased to maintain 18+ month runway`,
  ];

  return (
    <div className="space-y-8">
      <PageHeader
        title="Runway"
        subtitle="Model scenarios and forecast how long your business can operate."
      />

      {/* KPI Cards */}
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Base Case Runway"
          value={`${baseCase.months} months`}
          change={baseCase.scenario}
          changeType="positive"
          icon={<Clock className="h-4 w-4" style={{ color: "#14B8A6" }} />}
          iconColor="#14B8A6"
        />
        <MetricCard
          label="Cash Balance"
          value={formatCurrency(cashBalance)}
          change="Healthy"
          changeType="positive"
          icon={<Shield className="h-4 w-4" style={{ color: "#22C55E" }} />}
          iconColor="#22C55E"
        />
        <MetricCard
          label="Monthly Burn"
          value={formatCurrency(monthlyBurn)}
          change="+3.2% vs last month"
          changeType="negative"
          icon={<Flame className="h-4 w-4" style={{ color: "#F43F5E" }} />}
          iconColor="#F43F5E"
        />
        <MetricCard
          label="Best Case"
          value={`${bestCase.months} months`}
          change={bestCase.scenario}
          changeType="positive"
          icon={<TrendingUp className="h-4 w-4" style={{ color: "#8B5CF6" }} />}
          iconColor="#8B5CF6"
        />
      </div>

      {/* Charts Row */}
      <div className="grid gap-5 lg:grid-cols-2">
        <ChartCard title="Burn Trend" subtitle="Monthly expense burn over time">
          <div className="w-full h-full min-h-0 min-w-0">
            <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 1, height: 1 }}>
              <LineChart data={burnTrend} margin={{ top: 10, right: 10, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.08)" />
              <XAxis dataKey="month" tick={{ fill: "#94A3B8", fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "#94A3B8", fontSize: 12 }} axisLine={false} tickLine={false} tickFormatter={(v) => v ? `$${v / 1000}k` : ""} />
              <Tooltip contentStyle={tooltipStyle} formatter={(value) => value !== undefined ? formatCurrency(Number(value)) : ""} />
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
                <div
                  className="flex h-8 w-8 items-center justify-center rounded-lg"
                  style={{
                    background: `${scenarioColors[i]}15`,
                  }}
                >
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
                <p className="text-sm font-bold text-[var(--foreground)]">{scenario.runway} mo</p>
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
