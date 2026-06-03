"use client";

import { useState, useMemo } from "react";
import { X, TrendingUp, TrendingDown, Minus, Calculator, Database, AlertCircle, Lightbulb, ChevronRight } from "lucide-react";
import { formatCurrency, formatCurrencyCompact, formatDate } from "@/lib/utils/formatters";
import { useCompanyCurrency } from "@/lib/hooks/useCompanyCurrency";
import type { DashboardMetrics, MonthlyMetric, Transaction } from "@/lib/types";
import type { KPICardConfig } from "@/lib/business-intelligence/types";
import { formatKPIValue, getKPIChange } from "@/lib/business-intelligence/kpi-eligibility";
import { isIncome, isExpense, isKpiExcluded, isTransfer } from "@/lib/reporting/filters";
import { formatKpiExclusionReason } from "@/lib/kpi-treatment";
import { formatReportingTreatment, getReportingTreatment } from "@/lib/reporting/treatment-engine";
import type { ReportingTreatment } from "@/lib/reporting/treatment-engine";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface KPIDrilldownDrawerProps {
  kpi: KPICardConfig | null;
  metrics: DashboardMetrics;
  monthlyMetrics: MonthlyMetric[];
  transactions: Transaction[];
  dateRangeLabel: string;
  onClose: () => void;
}

const formatMonthLabel = (month: string) =>
  new Date(`${month}-01T00:00:00`).toLocaleDateString("en-GB", { month: "short", year: "2-digit" });

export default function KPIDrilldownDrawer({
  kpi,
  metrics,
  monthlyMetrics,
  transactions,
  dateRangeLabel,
  onClose,
}: KPIDrilldownDrawerProps) {
  const [activeTab, setActiveTab] = useState<"overview" | "transactions" | "trend">("overview");
  const { currency } = useCompanyCurrency();

  const drilldown = useMemo(() => {
    if (!kpi) return null;
    return buildDrilldown(kpi, metrics, monthlyMetrics, transactions, dateRangeLabel, currency);
  }, [kpi, metrics, monthlyMetrics, transactions, dateRangeLabel, currency]);

  if (!kpi || !drilldown) return null;

  const change = getKPIChange(kpi, monthlyMetrics, metrics);

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />
      {/* Drawer */}
      <div className="fixed inset-y-0 right-0 z-50 w-full sm:w-[540px] md:w-[600px] bg-[var(--background)] border-l border-[var(--border)] shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)]">
          <div>
            <h2 className="text-sm font-semibold text-[var(--foreground)]">{kpi.label}</h2>
            <p className="text-[11px] text-[var(--muted-foreground)] mt-0.5">{dateRangeLabel}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-[var(--border)] text-[var(--muted-foreground)] transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Value Hero */}
        <div className="px-5 py-6 border-b border-[var(--border)]">
          <div className="flex items-baseline gap-3">
            <span className="text-3xl font-bold text-[var(--foreground)] tracking-tight">
              {formatKPIValue(kpi, metrics, currency)}
            </span>
            {change && change.text !== "—" && (
              <span
                className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${
                  change.type === "positive"
                    ? "bg-emerald-500/10 text-emerald-400"
                    : change.type === "negative"
                    ? "bg-rose-500/10 text-rose-400"
                    : "bg-slate-500/10 text-slate-400"
                }`}
              >
                {change.type === "positive" ? <TrendingUp className="h-3 w-3" /> : change.type === "negative" ? <TrendingDown className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
                {change.text}
              </span>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-[var(--border)]">
          {(["overview", "trend", "transactions"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 px-4 py-2.5 text-xs font-medium transition-colors border-b-2 ${
                activeTab === tab
                  ? "border-[var(--accent)] text-[var(--foreground)]"
                  : "border-transparent text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
              }`}
            >
              {tab === "overview" && "Overview"}
              {tab === "trend" && "Trend"}
              {tab === "transactions" && "Transactions"}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {activeTab === "overview" && (
            <OverviewTab drilldown={drilldown} transactions={transactions} dateRangeLabel={dateRangeLabel} />
          )}
          {activeTab === "trend" && (
            <TrendTab monthlyMetrics={monthlyMetrics} kpi={kpi} />
          )}
          {activeTab === "transactions" && (
            <TransactionsTab transactions={drilldown.transactions} kpi={kpi} />
          )}
        </div>
      </div>
    </>
  );
}

function OverviewTab({
  drilldown,
  transactions,
  dateRangeLabel,
}: {
  drilldown: NonNullable<ReturnType<typeof buildDrilldown>>;
  transactions: Transaction[];
  dateRangeLabel: string;
}) {
  const { currency } = useCompanyCurrency();
  const includedTransactions = getIncludedTransactionsForKPI(drilldown.kpiId, transactions);
  const excludedTransactions = transactions.filter((t) => isTransfer(t) || isKpiExcluded(t));
  const sourceUploadCount = new Set(transactions.map((t) => t.uploadId).filter(Boolean)).size;
  const includedCategories = summariseCategories(includedTransactions);
  const excludedCategories = summariseCategories(excludedTransactions);
  const exclusionReasons = summariseExclusionReasons(excludedTransactions);
  const includedTreatments = summariseReportingTreatments(includedTransactions);

  return (
    <div className="space-y-6">
      {/* Formula */}
      <Section icon={<Calculator className="h-3.5 w-3.5" />} title="Formula">
        <p className="text-xs text-[var(--foreground)] font-mono bg-[var(--border)]/40 px-3 py-2 rounded-lg">
          {drilldown.formula}
        </p>
        <p className="text-[11px] text-[var(--muted-foreground)] mt-2">{drilldown.formulaExplanation}</p>
      </Section>

      {/* Data Source */}
      <Section icon={<Database className="h-3.5 w-3.5" />} title="Data Source">
        <p className="text-xs text-[var(--muted-foreground)]">{drilldown.dataSource}</p>
      </Section>

      <Section icon={<Database className="h-3.5 w-3.5" />} title="Source Trace">
        <div className="space-y-2 text-xs">
          <TraceRow label="KPI" value={drilldown.title} />
          <TraceRow label="Date range" value={dateRangeLabel} />
          <TraceRow label="Currency" value={currency} />
          <TraceRow label="Source transactions" value={String(includedTransactions.length)} />
          <TraceRow label="Source uploads" value={String(sourceUploadCount)} />
          <TraceRow label="Included categories" value={includedCategories || "None"} />
          <TraceRow label="Included treatments" value={includedTreatments || "None"} />
          <TraceRow label="Excluded categories" value={excludedCategories || "None"} />
          <TraceRow label="Excluded rows" value={String(excludedTransactions.length)} />
          <TraceRow label="Exclusion reasons" value={exclusionReasons || "None"} />
        </div>
      </Section>

      {/* Breakdown */}
      {drilldown.breakdown.length > 0 && (
        <Section icon={<ChevronRight className="h-3.5 w-3.5" />} title="Breakdown">
          <div className="space-y-2">
            {drilldown.breakdown.map((item, i) => (
              <div key={i} className="flex items-center justify-between text-xs">
                <span className="text-[var(--muted-foreground)]">{item.label}</span>
                <div className="flex items-center gap-2">
                  <span className="text-[var(--foreground)] font-medium">{item.value}</span>
                  {item.note && <span className="text-[10px] text-[var(--muted-foreground)]">{item.note}</span>}
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Previous Period */}
      {drilldown.previousPeriod && (
        <Section icon={<TrendingUp className="h-3.5 w-3.5" />} title="Previous Period">
          <div className="flex items-center justify-between text-xs">
            <span className="text-[var(--muted-foreground)]">Previous value</span>
            <span className="text-[var(--foreground)] font-medium">{drilldown.previousPeriod.value}</span>
          </div>
          <div className="flex items-center justify-between text-xs mt-1">
            <span className="text-[var(--muted-foreground)]">Change</span>
            <span
              className={`font-medium ${
                drilldown.previousPeriod.changeType === "positive"
                  ? "text-emerald-400"
                  : drilldown.previousPeriod.changeType === "negative"
                  ? "text-rose-400"
                  : "text-slate-400"
              }`}
            >
              {drilldown.previousPeriod.changeText}
            </span>
          </div>
        </Section>
      )}

      {/* Quality Notes */}
      {drilldown.qualityNotes.length > 0 && (
        <Section icon={<AlertCircle className="h-3.5 w-3.5" />} title="Data Quality">
          <ul className="space-y-1.5">
            {drilldown.qualityNotes.map((note, i) => (
              <li key={i} className="text-[11px] text-[var(--muted-foreground)] flex items-start gap-1.5">
                <span className="mt-1 h-1 w-1 rounded-full bg-[var(--warning)] shrink-0" />
                {note}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {/* Suggestions */}
      {drilldown.suggestions.length > 0 && (
        <Section icon={<Lightbulb className="h-3.5 w-3.5" />} title="Suggestions">
          <ul className="space-y-1.5">
            {drilldown.suggestions.map((suggestion, i) => (
              <li key={i} className="text-[11px] text-[var(--muted-foreground)] flex items-start gap-1.5">
                <span className="mt-1 h-1 w-1 rounded-full bg-[var(--accent)] shrink-0" />
                {suggestion}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {/* Traceability Footer */}
      <div className="rounded-lg border border-[var(--border)] px-3 py-2.5">
        <p className="text-[10px] text-[var(--muted-foreground)]">
          Based on {transactions.length} transaction{transactions.length !== 1 ? "s" : ""} from{" "}
          {new Set(transactions.map((t) => t.uploadId).filter(Boolean)).size} upload
          {new Set(transactions.map((t) => t.uploadId).filter(Boolean)).size !== 1 ? "s" : ""} within {dateRangeLabel}
        </p>
      </div>
    </div>
  );
}

function TrendTab({ monthlyMetrics, kpi }: { monthlyMetrics: MonthlyMetric[]; kpi: KPICardConfig }) {
  const { currency } = useCompanyCurrency();
  const sorted = [...monthlyMetrics].sort((a, b) => a.month.localeCompare(b.month));
  const data = sorted.map((m) => {
    let value = 0;
    if (kpi.changeDataKey) {
      value = (m as unknown as Record<string, number>)[kpi.changeDataKey] ?? 0;
    } else if (kpi.dataKey === "cashBalance") {
      value = m.cashIn - m.cashOut;
    } else {
      value = (m as unknown as Record<string, number>)[kpi.dataKey] ?? 0;
    }
    return { label: formatMonthLabel(m.month), value };
  });

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-40 text-xs text-[var(--muted-foreground)]">
        No trend data available for the selected period.
      </div>
    );
  }

  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 5 }}>
          <defs>
            <linearGradient id="trendGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={kpi.iconColor} stopOpacity={0.2} />
              <stop offset="95%" stopColor={kpi.iconColor} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.08)" vertical={false} />
          <XAxis dataKey="label" tick={{ fill: "#94a3b8", fontSize: 11 }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fill: "#94a3b8", fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => (v ? formatCurrencyCompact(Number(v), currency) : "")} />
          <Tooltip
            contentStyle={{
              background: "#111827",
              border: "1px solid rgba(148,163,184,0.16)",
              borderRadius: "8px",
              fontSize: "12px",
              color: "#f1f5f9",
            }}
            formatter={(value) => (value !== undefined ? formatCurrency(Number(value), 0, currency) : "")}
          />
          <Area type="monotone" dataKey="value" stroke={kpi.iconColor} strokeWidth={2} fillOpacity={1} fill="url(#trendGradient)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

type DrilldownTransaction = {
  date: string;
  merchant: string;
  description: string;
  amount: number;
  type: string;
  category: string;
  rowStatus?: string;
  kpiExcluded?: boolean;
  kpiExclusionReason?: string;
  reportingTreatment?: ReportingTreatment;
  metadata?: Record<string, unknown>;
};

function TransactionsTab({ transactions, kpi }: { transactions?: DrilldownTransaction[]; kpi: KPICardConfig }) {
  const { currency } = useCompanyCurrency();
  if (!transactions || transactions.length === 0) {
    return (
      <div className="flex items-center justify-center h-40 text-xs text-[var(--muted-foreground)]">
        No individual transactions available for this KPI.
      </div>
    );
  }

  const isIncomeKPI = kpi.id === "monthly_revenue" || kpi.id === "arr";
  const isExpenseKPI = kpi.id === "monthly_expenses" || kpi.id === "monthly_burn" || kpi.id === "monthly_sub_spend";
  const filtered = transactions.filter((t) => {
    if (isIncomeKPI) return isIncome(t);
    if (isExpenseKPI) return isExpense(t);
    return true;
  });

  return (
    <div className="space-y-2">
      <p className="text-[11px] text-[var(--muted-foreground)]">
        {filtered.length} source transaction{filtered.length !== 1 ? "s" : ""}
      </p>
      {filtered.map((t, i) => (
        <div
          key={i}
          className="flex items-center justify-between rounded-lg border border-[var(--border)] px-3 py-2.5"
        >
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-[var(--foreground)] truncate">{t.merchant || t.description}</p>
            <p className="text-[10px] text-[var(--muted-foreground)]">{formatDate(t.date)} · {t.category}</p>
            <p className="text-[10px] text-sky-300/80">{formatReportingTreatment(t)}</p>
          </div>
          <span className={`text-xs font-semibold shrink-0 ml-3 ${t.type === "income" ? "text-emerald-400" : "text-rose-400"}`}>
            {t.type === "income" ? "+" : "-"}{formatCurrency(Math.abs(t.amount), 0, currency)}
          </span>
        </div>
      ))}
    </div>
  );
}

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <span className="text-[var(--accent)]">{icon}</span>
        <h3 className="text-xs font-semibold text-[var(--foreground)]">{title}</h3>
      </div>
      {children}
    </div>
  );
}

function TraceRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="text-[var(--muted-foreground)]">{label}</span>
      <span className="max-w-[60%] text-right font-medium text-[var(--foreground)]">{value}</span>
    </div>
  );
}

function getIncludedTransactionsForKPI(kpiId: string, transactions: Transaction[]): Transaction[] {
  switch (kpiId) {
    case "monthly_revenue":
    case "arr":
      return transactions.filter((t) => isIncome(t));
    case "monthly_expenses":
    case "monthly_sub_spend":
      return transactions.filter((t) => isExpense(t));
    case "net_profit":
    case "monthly_burn":
    case "runway":
    case "gross_margin":
    case "burn_multiple":
    case "rule_of_40":
    case "health_score":
      return transactions.filter((t) => isIncome(t) || isExpense(t));
    case "cash_balance":
      return transactions.filter((t) => t.runningBalance !== undefined || t.metadata?.running_balance !== undefined);
    default:
      return transactions.filter((t) => isIncome(t) || isExpense(t));
  }
}

function summariseCategories(transactions: Transaction[]): string {
  const counts = new Map<string, number>();
  for (const tx of transactions) {
    const category = tx.category || "Uncategorised Review";
    counts.set(category, (counts.get(category) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([category, count]) => `${category} (${count})`)
    .join(", ");
}

function summariseExclusionReasons(transactions: Transaction[]): string {
  const counts = new Map<string, number>();
  for (const tx of transactions) {
    const treatment = getReportingTreatment(tx);
    const label = treatment.kpiExclusionReason
      ? formatKpiExclusionReason(treatment.kpiExclusionReason, tx.category)
      : treatment.label;
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([reason, count]) => `${reason} (${count})`)
    .join(", ");
}

function summariseReportingTreatments(transactions: Transaction[]): string {
  const counts = new Map<string, number>();
  for (const tx of transactions) {
    const label = getReportingTreatment(tx).label;
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([label, count]) => `${label} (${count})`)
    .join(", ");
}

// ─── Drilldown Data Builder ───────────────────────────────────────────

interface DrilldownResult {
  kpiId: string;
  title: string;
  currentValue: string;
  formula: string;
  formulaExplanation: string;
  dataSource: string;
  breakdown: Array<{ label: string; value: string; note?: string }>;
  previousPeriod?: { value: string; changeText: string; changeType: "positive" | "negative" | "neutral" };
  trendData: Array<{ label: string; value: number }>;
  transactions: DrilldownTransaction[];
  qualityNotes: string[];
  suggestions: string[];
}

function buildDrilldown(
  kpi: KPICardConfig,
  metrics: DashboardMetrics,
  monthlyMetrics: MonthlyMetric[],
  transactions: Transaction[],
  dateRangeLabel: string,
  currency: string
): DrilldownResult {
  const sorted = [...monthlyMetrics].sort((a, b) => a.month.localeCompare(b.month));
  const previous = sorted[sorted.length - 2];
  const sourceUploadCount = new Set(transactions.map((t) => t.uploadId).filter(Boolean)).size;
  const latestBalanceTransaction = [...transactions]
    .filter((t) => t.runningBalance !== undefined || t.metadata?.running_balance !== undefined)
    .sort((a, b) => +new Date(b.date) - +new Date(a.date))[0];

  const base = {
    kpiId: kpi.id,
    title: kpi.label,
    currentValue: formatKPIValue(kpi, metrics, currency),
    dataSource: `From ${transactions.length} transaction${transactions.length !== 1 ? "s" : ""} across ${sourceUploadCount} upload${sourceUploadCount !== 1 ? "s" : ""}, filtered by ${dateRangeLabel}. Calculated from company-scoped data.`,
    trendData: sorted.map((m) => ({ label: formatMonthLabel(m.month), value: 0 })),
    qualityNotes: [] as string[],
    suggestions: [] as string[],
    transactions: transactions.map((t) => ({
      date: typeof t.date === "string" ? t.date : t.date.toISOString(),
      merchant: t.merchant || "",
      description: t.description,
      amount: t.amount,
      type: t.type,
      category: t.category || "Uncategorised Review",
      rowStatus: t.rowStatus,
      kpiExcluded: t.kpiExcluded,
      kpiExclusionReason: t.kpiExclusionReason,
      reportingTreatment: t.reportingTreatment,
      metadata: t.metadata,
    })),
  };

  switch (kpi.id) {
    case "cash_balance":
      return {
        ...base,
        formula: "cashBalance",
        formulaExplanation: "Current cash balance as reported from the latest bank statement upload or accounting integration.",
        breakdown: [
          { label: "Current balance", value: formatCurrency(metrics.cashBalance, 0, currency) },
          ...(latestBalanceTransaction
            ? [{
                label: "Latest balance row",
                value: formatCurrency(
                  Number(latestBalanceTransaction.runningBalance ?? latestBalanceTransaction.metadata?.running_balance ?? 0),
                  0,
                  currency
                ),
                note: `Row ${latestBalanceTransaction.sourceRowNumber ?? "?"} · ${formatDate(latestBalanceTransaction.date)}`,
              }]
            : []),
        ],
        previousPeriod: previous
          ? {
              value: formatCurrency(previous.cashIn - previous.cashOut, 0, currency),
              changeText: "—",
              changeType: "neutral" as const,
            }
          : undefined,
        qualityNotes: metrics.cashBalance === 0 ? ["Cash balance is zero. Ensure bank accounts are connected."] : [],
        suggestions: metrics.cashBalance < 10000
          ? ["Cash reserves are low. Consider extending runway or reducing burn."]
          : [],
      };

    case "monthly_revenue":
      return {
        ...base,
        formula: "SUM(amount) WHERE type = 'income'",
        formulaExplanation: "Total of all income transactions in the selected date range, divided by the number of months.",
        breakdown: [
          { label: "Total income", value: formatCurrency(metrics.monthlyRevenue, 0, currency) },
          { label: "Revenue transactions", value: String(transactions.filter((t) => isIncome(t)).length) },
        ],
        previousPeriod: previous
          ? {
              value: formatCurrency(previous.revenue, 0, currency),
              changeText: previous.revenue > 0 ? `${(((metrics.monthlyRevenue - previous.revenue) / previous.revenue) * 100).toFixed(1)}%` : "—",
              changeType: metrics.monthlyRevenue >= previous.revenue ? "positive" : "negative",
            }
          : undefined,
        qualityNotes: metrics.monthlyRevenue === 0 ? ["No revenue detected. Check that income transactions are categorised correctly."] : [],
        suggestions: metrics.monthlyRevenue > 0
          ? ["Review top revenue sources to identify growth opportunities."]
          : ["Ensure payment processor exports are uploaded to capture revenue."],
      };

    case "monthly_expenses":
      return {
        ...base,
        formula: "SUM(amount) WHERE type = 'expense'",
        formulaExplanation: "Total of all expense transactions in the selected date range, divided by the number of months.",
        breakdown: [
          { label: "Total expenses", value: formatCurrency(metrics.monthlyExpenses, 0, currency) },
          { label: "Expense transactions", value: String(transactions.filter((t) => isExpense(t)).length) },
        ],
        previousPeriod: previous
          ? {
              value: formatCurrency(previous.expenses, 0, currency),
              changeText: previous.expenses > 0 ? `${(((metrics.monthlyExpenses - previous.expenses) / previous.expenses) * 100).toFixed(1)}%` : "—",
              changeType: metrics.monthlyExpenses <= previous.expenses ? "positive" : "negative",
            }
          : undefined,
        qualityNotes: metrics.monthlyExpenses === 0 ? ["No expenses detected. Upload bank statements to track spending."] : [],
        suggestions: ["Review top expense categories to find cost-saving opportunities."],
      };

    case "net_profit":
      return {
        ...base,
        formula: "monthlyRevenue - monthlyExpenses",
        formulaExplanation: "Net profit is revenue minus expenses. A positive value means the business is profitable.",
        breakdown: [
          { label: "Revenue", value: formatCurrency(metrics.monthlyRevenue, 0, currency) },
          { label: "Expenses", value: formatCurrency(metrics.monthlyExpenses, 0, currency) },
          { label: "Net profit", value: formatCurrency(metrics.netProfit, 0, currency) },
          { label: "Profit margin", value: `${metrics.profitMargin.toFixed(1)}%` },
        ],
        previousPeriod: previous
          ? {
              value: formatCurrency(previous.profit, 0, currency),
              changeText: previous.profit !== 0 ? `${(((metrics.netProfit - previous.profit) / Math.abs(previous.profit)) * 100).toFixed(1)}%` : "—",
              changeType: metrics.netProfit >= previous.profit ? "positive" : "negative",
            }
          : undefined,
        qualityNotes: metrics.netProfit < 0 ? ["Business is currently operating at a loss."] : [],
        suggestions: metrics.netProfit < 0
          ? ["Consider reducing non-essential expenses or increasing pricing."]
          : ["Reinvest profits into growth channels with highest ROI."],
      };

    case "monthly_burn":
      return {
        ...base,
        formula: "monthlyExpenses - monthlyRevenue (when negative)",
        formulaExplanation: "Monthly burn is the net cash spent each month. If revenue exceeds expenses, burn is zero.",
        breakdown: [
          { label: "Monthly expenses", value: formatCurrency(metrics.monthlyExpenses, 0, currency) },
          { label: "Monthly revenue", value: formatCurrency(metrics.monthlyRevenue, 0, currency) },
          { label: "Monthly burn", value: formatCurrency(metrics.monthlyBurn, 0, currency) },
        ],
        previousPeriod: undefined,
        qualityNotes: metrics.monthlyBurn === 0 ? ["Zero burn detected. Revenue covers all expenses."] : [],
        suggestions: metrics.monthlyBurn > 0
          ? ["Track burn by department to identify the biggest cost drivers."]
          : ["Business is cash-flow positive. Consider investing surplus into growth."],
      };

    case "runway":
      return {
        ...base,
        formula: "cashBalance / monthlyBurn",
        formulaExplanation: "Runway estimates how long the business can operate before running out of cash, assuming current burn continues.",
        breakdown: [
          { label: "Cash balance", value: formatCurrency(metrics.cashBalance, 0, currency) },
          { label: "Monthly burn", value: formatCurrency(metrics.monthlyBurn, 0, currency) },
          { label: "Runway", value: `${metrics.runwayMonths.toFixed(1)} months` },
        ],
        previousPeriod: undefined,
        qualityNotes: [
          metrics.monthlyBurn === 0 ? "Burn is zero. Runway is effectively infinite." : "",
          metrics.runwayMonths < 6 ? "Runway is less than 6 months. Consider fundraising or cost reduction." : "",
        ].filter(Boolean),
        suggestions: metrics.runwayMonths < 12
          ? ["Priorise extending runway through revenue growth or cost reduction."]
          : ["Healthy runway. Plan next funding round or profitability milestone."],
      };

    case "monthly_sub_spend":
      return {
        ...base,
        formula: "SUM(subscription.amount) WHERE status = 'active'",
        formulaExplanation: "Total monthly spend on active software subscriptions and recurring tools.",
        breakdown: [
          { label: "Active subscriptions", value: formatCurrency(metrics.monthlySubscriptionSpend, 0, currency) },
        ],
        previousPeriod: undefined,
        qualityNotes: [],
        suggestions: ["Review subscriptions quarterly to cancel unused tools."],
      };

    case "arr":
      return {
        ...base,
        formula: "monthlyRecurringRevenue × 12",
        formulaExplanation: "Annual Recurring Revenue (ARR) is the predictable annual revenue from subscriptions.",
        breakdown: [
          { label: "Monthly recurring revenue", value: formatCurrency(metrics.arr / 12, 0, currency) },
          { label: "ARR", value: formatCurrency(metrics.arr, 0, currency) },
        ],
        previousPeriod: undefined,
        qualityNotes: metrics.arr === 0 ? ["ARR is zero. Ensure subscription revenue is categorised as Revenue."] : [],
        suggestions: metrics.arr > 0
          ? ["Track net new ARR monthly to measure growth momentum."]
          : ["Set up subscription tracking to monitor recurring revenue."],
      };

    case "gross_margin":
      return {
        ...base,
        formula: "(revenue - COGS) / revenue × 100",
        formulaExplanation: "Gross margin shows what percentage of revenue remains after direct costs (COGS).",
        breakdown: [
          { label: "Revenue", value: formatCurrency(metrics.monthlyRevenue, 0, currency) },
          { label: "Gross margin", value: `${metrics.grossMargin.toFixed(1)}%` },
        ],
        previousPeriod: undefined,
        qualityNotes: metrics.grossMargin === 0 ? ["No COGS data available. Upload inventory or supplier transactions."] : [],
        suggestions: ["Benchmark gross margin against industry standards for your business model."],
      };

    case "burn_multiple":
      return {
        ...base,
        formula: "netBurn / netNewARR",
        formulaExplanation: "Burn multiple measures how much cash is burned for each dollar of new ARR. Lower is better.",
        breakdown: [
          { label: "Burn multiple", value: metrics.burnMultiple.toFixed(2) },
        ],
        previousPeriod: undefined,
        qualityNotes: metrics.burnMultiple === Infinity || metrics.burnMultiple === 0
          ? ["Insufficient data to calculate burn multiple. Requires both burn and new ARR."]
          : [],
        suggestions: metrics.burnMultiple > 2
          ? ["Burn multiple is high. Focus on improving sales efficiency."]
          : [],
      };

    case "rule_of_40":
      return {
        ...base,
        formula: "growthRate + profitMargin",
        formulaExplanation: "The Rule of 40 states that a healthy SaaS business has growth rate + profit margin ≥ 40%.",
        breakdown: [
          { label: "Profit margin", value: `${metrics.profitMargin.toFixed(1)}%` },
          { label: "Rule of 40 score", value: `${metrics.ruleOf40.toFixed(1)}` },
        ],
        previousPeriod: undefined,
        qualityNotes: metrics.ruleOf40 === 0 ? ["Insufficient historical data to calculate growth rate."] : [],
        suggestions: metrics.ruleOf40 < 40
          ? ["Rule of 40 is below 40. Focus on accelerating growth or improving margins."]
          : ["Business meets the Rule of 40. Maintain this balance while scaling."],
      };

    case "health_score":
      return {
        ...base,
        formula: "Composite score based on cash, runway, profit, and revenue trends",
        formulaExplanation: "Health score is a composite metric that reflects overall business financial health.",
        breakdown: [
          { label: "Health score", value: `${metrics.healthScore}/100` },
        ],
        previousPeriod: undefined,
        qualityNotes: metrics.healthScore < 60 ? ["Health score is below 60. Review cash flow and expense management."] : [],
        suggestions: metrics.healthScore < 80
          ? ["Improve health score by extending runway or increasing revenue."]
          : ["Strong financial health. Document what's working for investor conversations."],
      };

    default:
      return {
        ...base,
        formula: kpi.dataKey,
        formulaExplanation: `Value derived from ${kpi.label} data key in metrics.`,
        breakdown: [],
      };
  }
}
