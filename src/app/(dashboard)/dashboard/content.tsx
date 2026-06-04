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
import { DataCoverageBanner } from "@/components/features/shared/DataCoverageBanner";
import { getSourceBreakdown, type FinancialDataSourceStatus } from "@/lib/db/data-source-shared";
import { isExpense, isIncome } from "@/lib/reporting/filters";
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
  dataSourceStatus: FinancialDataSourceStatus;
  subscriptions: Subscription[];
  alerts: Alert[];
  topExpenses: { name: string; amount: number }[];
  transactions: Transaction[];
  companyProfile: CompanyBusinessProfile;
  initialPreset: DateRangePreset;
  initialFrom: string;
  initialTo: string;
}

type InsightId =
  | "subscription_spend"
  | "top_expense_categories"
  | "cash_flow"
  | "runway_analysis"
  | "cash_balance"
  | "monthly_revenue"
  | "monthly_expenses"
  | "net_profit";

interface DashboardInsight {
  title: string;
  subtitle: string;
  metric: string;
  meaning: string;
  change: string;
  poweredBy: string;
  watch: string;
  action: string;
  rows: Transaction[];
}

const INSIGHT_KPI_IDS = new Set(["cash_balance", "monthly_revenue", "monthly_expenses", "net_profit"]);

function formatRunwayValue(months: number): string {
  if (!Number.isFinite(months)) return "Infinite";
  if (months < 1) return "< 1 mo";
  if (months < 12) return `${Math.round(months)} mo`;
  return `${(months / 12).toFixed(1)} yr`;
}

function sortTransactionsNewestFirst(rows: Transaction[]): Transaction[] {
  return [...rows].sort((a, b) => +new Date(b.date) - +new Date(a.date));
}

function InsightButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-amber-300/20 bg-amber-300/10 text-amber-300 transition-colors hover:border-amber-300/40 hover:bg-amber-300/15"
      title="View source-backed insight"
    >
      <Icons.Lightbulb className="h-4 w-4" />
    </button>
  );
}

function InsightDrawer({
  insight,
  currency,
  onClose,
}: {
  insight: DashboardInsight | null;
  currency: string;
  onClose: () => void;
}) {
  if (!insight) return null;

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <aside className="fixed inset-y-0 right-0 z-50 flex w-full max-w-[520px] flex-col border-l border-[var(--border)] bg-[var(--background)] shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-[var(--border)] px-5 py-4">
          <div>
            <div className="mb-2 inline-flex h-9 w-9 items-center justify-center rounded-lg border border-amber-300/20 bg-amber-300/10 text-amber-300">
              <Icons.Lightbulb className="h-4 w-4" />
            </div>
            <h2 className="text-sm font-bold text-[var(--foreground)]">{insight.title}</h2>
            <p className="mt-1 text-xs text-[var(--muted-foreground)]">{insight.subtitle}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-[var(--muted-foreground)] transition-colors hover:bg-[var(--border)] hover:text-[var(--foreground)]"
            title="Close"
          >
            <Icons.X className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5">
          {[
            ["Metric", insight.metric],
            ["Meaning", insight.meaning],
            ["Changed", insight.change],
            ["Powered by", insight.poweredBy],
            ["Watch", insight.watch],
            ["Useful action", insight.action],
          ].map(([label, body]) => (
            <div key={label} className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-3">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">{label}</p>
              <p className="mt-1 text-xs leading-relaxed text-[var(--foreground)]">{body}</p>
            </div>
          ))}

          <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">Source rows</p>
            {insight.rows.length > 0 ? (
              <div className="mt-2 space-y-2">
                {insight.rows.slice(0, 5).map((row) => (
                  <div key={row.id} className="flex items-start justify-between gap-3 rounded-md bg-[var(--background)] p-2">
                    <div className="min-w-0">
                      <p className="truncate text-xs font-medium text-[var(--foreground)]">
                        {row.merchant || row.description || "Transaction"}
                      </p>
                      <p className="mt-0.5 text-[11px] text-[var(--muted-foreground)]">
                        {new Date(row.date).toLocaleDateString("en-GB")} · Row {row.sourceRowNumber ?? "n/a"} · {row.category ?? "Uncategorised"}
                      </p>
                    </div>
                    <span className="shrink-0 text-xs font-semibold text-[var(--foreground)]">
                      {formatCurrency(Math.abs(row.amount), 0, row.currency ?? currency)}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-2 text-xs text-[var(--muted-foreground)]">No matching source transactions in the selected range.</p>
            )}
          </div>
        </div>
      </aside>
    </>
  );
}

export default function DashboardContent({
  metrics,
  monthlyMetrics,
  dataSourceStatus,
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
  const [selectedInsight, setSelectedInsight] = useState<DashboardInsight | null>(null);
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

  const formatMonthLabel = (month: string) =>
    new Date(`${month}-01T00:00:00`).toLocaleDateString("en-GB", { month: "short", year: "2-digit" });

  const cashFlowData = monthlyMetrics.map((m) => ({
    month: formatMonthLabel(m.month),
    inflow: m.cashIn,
    outflow: m.cashOut,
    net: m.profit,
  }));

  const expenseData = topExpenses.map((e) => ({ name: e.name, value: e.amount }));
  const totalExpenses = expenseData.reduce((sum, e) => sum + e.value, 0);

  const eligibleKPIs = getEligibleKPIs(companyProfile, metrics);
  const mainKPIs = eligibleKPIs.slice(0, 8);
  const advancedKPIs = eligibleKPIs.slice(8);
  const dateRangeLabel = getDateRange(initialPreset, initialFrom, initialTo).label;
  const dataSourceBreakdown = getSourceBreakdown(dataSourceStatus);
  const selectedSourceCount = dataSourceStatus.selectedTransactionCount ?? dataSourceStatus.activeTransactionCount ?? transactions.length;
  const incomeTransactions = transactions.filter((t) => isIncome(t));
  const expenseTransactions = transactions.filter((t) => isExpense(t));
  const activeSubscriptions = subscriptions.filter((s) => s.status === "active");
  const latestMetric = [...monthlyMetrics].sort((a, b) => a.month.localeCompare(b.month)).at(-1);
  const previousMetric = [...monthlyMetrics].sort((a, b) => a.month.localeCompare(b.month)).at(-2);

  const openInsight = (id: InsightId) => {
    const topExpenseCategory = [...expenseData].sort((a, b) => b.value - a.value)[0];
    const topExpenseRows = topExpenseCategory
      ? expenseTransactions.filter((t) => (t.category || "Uncategorised Review") === topExpenseCategory.name)
      : [];
    const subscriptionRows = transactions.filter((t) => t.subscriptionId || t.isRecurring);
    const monthChange =
      latestMetric && previousMetric
        ? `${formatMonthLabel(previousMetric.month)} to ${formatMonthLabel(latestMetric.month)}`
        : "No prior month is available for comparison in the selected data.";

    const insightMap: Record<InsightId, DashboardInsight> = {
      cash_balance: {
        title: "Cash Balance Insight",
        subtitle: dateRangeLabel,
        metric: formatCurrency(metrics.cashBalance, 0, currency),
        meaning: "Cash balance is the latest balance available from active financial source data in this company.",
        change: latestMetric && previousMetric ? `Latest period context is ${monthChange}.` : monthChange,
        poweredBy: `${selectedSourceCount} source transaction${selectedSourceCount !== 1 ? "s" : ""} across ${dataSourceBreakdown}.`,
        watch: "Watch for old source coverage dates because cash balance becomes stale when no newer rows are uploaded.",
        action: "Upload the latest statement when the coverage period no longer matches the period you want to manage.",
        rows: sortTransactionsNewestFirst(transactions),
      },
      monthly_revenue: {
        title: "Monthly Revenue Insight",
        subtitle: dateRangeLabel,
        metric: formatCurrency(metrics.monthlyRevenue, 0, currency),
        meaning: "Monthly revenue sums rows classified as income and included in KPI reporting for the selected period.",
        change: latestMetric && previousMetric ? `${monthChange}: revenue moved from ${formatCurrency(previousMetric.revenue, 0, currency)} to ${formatCurrency(latestMetric.revenue, 0, currency)}.` : monthChange,
        poweredBy: `${incomeTransactions.length} income transaction${incomeTransactions.length !== 1 ? "s" : ""} in the selected range.`,
        watch: "Watch any income rows marked for review or excluded from KPIs before relying on the revenue figure.",
        action: "Open the revenue drilldown if revenue looks wrong and check the source rows and categories.",
        rows: sortTransactionsNewestFirst(incomeTransactions),
      },
      monthly_expenses: {
        title: "Monthly Expenses Insight",
        subtitle: dateRangeLabel,
        metric: formatCurrency(metrics.monthlyExpenses, 0, currency),
        meaning: "Monthly expenses sum active rows classified as operating spend and included in KPI reporting.",
        change: latestMetric && previousMetric ? `${monthChange}: expenses moved from ${formatCurrency(previousMetric.expenses, 0, currency)} to ${formatCurrency(latestMetric.expenses, 0, currency)}.` : monthChange,
        poweredBy: `${expenseTransactions.length} expense transaction${expenseTransactions.length !== 1 ? "s" : ""} in the selected range.`,
        watch: topExpenseCategory ? `${topExpenseCategory.name} is the largest expense category at ${formatCurrency(topExpenseCategory.value, 0, currency)}.` : "No expense rows matched this period.",
        action: "Review high-spend categories and uncategorised rows before making spend decisions.",
        rows: sortTransactionsNewestFirst(expenseTransactions),
      },
      net_profit: {
        title: "Net Profit Insight",
        subtitle: dateRangeLabel,
        metric: formatCurrency(metrics.netProfit, 0, currency),
        meaning: "Net profit is revenue minus expenses after KPI exclusions are applied.",
        change: latestMetric && previousMetric ? `${monthChange}: profit moved from ${formatCurrency(previousMetric.profit, 0, currency)} to ${formatCurrency(latestMetric.profit, 0, currency)}.` : monthChange,
        poweredBy: `${incomeTransactions.length} income row${incomeTransactions.length !== 1 ? "s" : ""} and ${expenseTransactions.length} expense row${expenseTransactions.length !== 1 ? "s" : ""}.`,
        watch: "Watch transfer, refund, tax, and duplicate treatment because those rows can change profit attribution.",
        action: "Use the KPI drilldown to confirm which rows are included and excluded from profit.",
        rows: sortTransactionsNewestFirst([...incomeTransactions, ...expenseTransactions]),
      },
      subscription_spend: {
        title: "Subscription Spend Insight",
        subtitle: dateRangeLabel,
        metric: formatCurrency(metrics.monthlySubscriptionSpend, 0, currency),
        meaning: "Subscription spend is recurring software or service cost detected from active source data or manually retained subscriptions.",
        change: `${activeSubscriptions.length} active subscription${activeSubscriptions.length !== 1 ? "s" : ""} are visible for this company.`,
        poweredBy: `${subscriptionRows.length} recurring transaction${subscriptionRows.length !== 1 ? "s" : ""} linked to subscription evidence, plus active subscription records.`,
        watch: "Watch upload-generated subscriptions after deleting source files; they should disappear unless manually retained.",
        action: "Open Subscriptions to confirm whether each tool is upload-generated or manually maintained.",
        rows: sortTransactionsNewestFirst(subscriptionRows),
      },
      top_expense_categories: {
        title: "Top Expense Categories Insight",
        subtitle: dateRangeLabel,
        metric: topExpenseCategory ? `${topExpenseCategory.name}: ${formatCurrency(topExpenseCategory.value, 0, currency)}` : "No expense category data",
        meaning: "Top categories group active expense rows by their current category assignment.",
        change: topExpenseCategory ? `${topExpenseCategory.name} represents ${totalExpenses > 0 ? Math.round((topExpenseCategory.value / totalExpenses) * 100) : 0}% of selected expense spend.` : "No expense rows matched this range.",
        poweredBy: `${expenseTransactions.length} expense transaction${expenseTransactions.length !== 1 ? "s" : ""} in this date range.`,
        watch: "Watch uncategorised and low-confidence rows because they can distort the category leaderboard.",
        action: "Review large uncategorised vendors before using category totals for decisions.",
        rows: sortTransactionsNewestFirst(topExpenseRows.length > 0 ? topExpenseRows : expenseTransactions),
      },
      cash_flow: {
        title: "Cash Flow Insight",
        subtitle: dateRangeLabel,
        metric: `${formatCurrency(latestMetric?.cashIn ?? 0, 0, currency)} in / ${formatCurrency(latestMetric?.cashOut ?? 0, 0, currency)} out`,
        meaning: "Cash flow compares active cash movement in and out for the selected period.",
        change: latestMetric && previousMetric ? `${monthChange}: net movement moved from ${formatCurrency(previousMetric.cashIn - previousMetric.cashOut, 0, currency)} to ${formatCurrency(latestMetric.cashIn - latestMetric.cashOut, 0, currency)}.` : monthChange,
        poweredBy: `${transactions.length} transaction${transactions.length !== 1 ? "s" : ""} from active sources.`,
        watch: "Watch transfers and excluded KPI rows; they may affect cash movement without affecting P&L.",
        action: "Use Cash Flow to inspect movement by source and category before planning runway.",
        rows: sortTransactionsNewestFirst(transactions),
      },
      runway_analysis: {
        title: "Runway Analysis Insight",
        subtitle: dateRangeLabel,
        metric: formatRunwayValue(metrics.runwayMonths),
        meaning: "Runway divides current cash by monthly burn using the selected source-backed metrics.",
        change: `Cash balance is ${formatCurrency(metrics.cashBalance, 0, currency)} and monthly burn is ${formatCurrency(metrics.monthlyBurn, 0, currency)}.`,
        poweredBy: `${transactions.length} transaction${transactions.length !== 1 ? "s" : ""}, ${activeSubscriptions.length} active subscription${activeSubscriptions.length !== 1 ? "s" : ""}, and active upload coverage.`,
        watch: "Watch stale data coverage; runway is only as current as the latest uploaded transaction.",
        action: "Upload the newest bank data before treating runway as operational truth.",
        rows: sortTransactionsNewestFirst(expenseTransactions),
      },
    };

    setSelectedInsight(insightMap[id]);
  };

  return (
    <div className="space-y-8">
      <PageHeader
        title="Command Centre"
        subtitle="Your AI finance copilot is watching cash, runway, revenue, spend, and risk signals."
      />

      <DataCoverageBanner status={dataSourceStatus} selectedLabel={dateRangeLabel} />

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

        <div className={`grid gap-5 ${getKPIGridClass(mainKPIs.length)}`}>
          {mainKPIs.map((kpi) => {
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
                onDrillDown={() => setSelectedKPI(kpi)}
                onInsight={INSIGHT_KPI_IDS.has(kpi.id) ? () => openInsight(kpi.id as InsightId) : undefined}
              />
            );
          })}
        </div>
        <p className="text-xs text-[var(--muted-foreground)]">
          KPI source: {selectedSourceCount} source transaction{selectedSourceCount !== 1 ? "s" : ""} across {dataSourceBreakdown} in this date range.
        </p>
        {advancedKPIs.length > 0 && (
          <div className="rounded-xl border border-[var(--border)] bg-[var(--card)]/60 p-4">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-[var(--foreground)]">Advanced Metrics</h3>
                <p className="text-xs text-[var(--muted-foreground)]">Available for deeper SaaS and growth analysis.</p>
              </div>
            </div>
            <div className={`grid gap-4 ${getKPIGridClass(advancedKPIs.length)}`}>
              {advancedKPIs.map((kpi) => {
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
                    onDrillDown={() => setSelectedKPI(kpi)}
                  />
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Middle Section */}
      <div className="grid gap-5 lg:grid-cols-3">
        {/* Subscription Spend */}
        <ChartCard
          title="Subscription Spend"
          subtitle="Monthly recurring software costs"
          height="h-80"
          action={<InsightButton onClick={() => openInsight("subscription_spend")} />}
        >
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
        <ChartCard
          title="Top Expense Categories"
          subtitle="Where money goes"
          height="h-80"
          action={<InsightButton onClick={() => openInsight("top_expense_categories")} />}
        >
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
        <ChartCard
          title="Cash Flow"
          subtitle="Operating cash movement"
          height="h-72"
          action={<InsightButton onClick={() => openInsight("cash_flow")} />}
        >
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
        <ChartCard
          title="Runway Analysis"
          subtitle="Cash vs burn trajectory"
          height="h-72"
          action={<InsightButton onClick={() => openInsight("runway_analysis")} />}
        >
          <div className="w-full h-full min-h-0 min-w-0">
            <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 1, height: 1 }}>
              <BarChart data={monthlyMetrics.map((m) => ({ month: formatMonthLabel(m.month), profit: m.profit, expenses: m.expenses }))} margin={{ top: 10, right: 10, left: 10, bottom: 5 }}>
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

      <InsightDrawer insight={selectedInsight} currency={currency} onClose={() => setSelectedInsight(null)} />
    </div>
  );
}
