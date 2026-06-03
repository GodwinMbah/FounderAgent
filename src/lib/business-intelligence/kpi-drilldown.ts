import type { DashboardMetrics, MonthlyMetric, Transaction } from "@/lib/types";
import { KPI_CATALOG, formatKPIValue, getKPIChange } from "./kpi-eligibility";
import { calculateChangePercent } from "@/lib/reporting/kpis";
import { isIncome, isExpense } from "@/lib/reporting/filters";
import type { KPICardConfig } from "./types";

export interface KPIDrilldownData {
  kpiId: string;
  title: string;
  currentValue: string;
  formula: string;
  formulaExplanation: string;
  dataSource: string;
  breakdown: Array<{ label: string; value: string; note?: string }>;
  previousPeriod?: { value: string; changeText: string; changeType: "positive" | "negative" | "neutral" };
  trendData: Array<{ label: string; value: number }>;
  transactions?: Array<{ date: string; merchant: string; description: string; amount: number; type: string; category: string }>;
  qualityNotes: string[];
  suggestions: string[];
}

function fmtCurrency(n: number, currency = "GBP"): string {
  if (!Number.isFinite(n)) return "—";
  return new Intl.NumberFormat(currency === "GBP" ? "en-GB" : "en-US", { style: "currency", currency, maximumFractionDigits: 0 }).format(n);
}

function fmtPercent(n: number): string {
  if (!Number.isFinite(n)) return "—";
  return `${n.toFixed(1)}%`;
}

function fmtNumber(n: number, decimals = 1): string {
  if (!Number.isFinite(n)) return "∞";
  return n.toFixed(decimals);
}

function getSortedMonths(monthlyMetrics: MonthlyMetric[]): MonthlyMetric[] {
  return [...monthlyMetrics].sort((a, b) => a.month.localeCompare(b.month));
}

function getMonthAbbreviation(month: string): string {
  try {
    const d = new Date(month + "-01");
    return d.toLocaleDateString("en-US", { month: "short" });
  } catch {
    return month;
  }
}

function getTopTransactions(transactions: Transaction[], type: "income" | "expense", limit = 5) {
  const filterFn = type === "income" ? isIncome : isExpense;
  return transactions
    .filter((t) => filterFn(t))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, limit)
    .map((t) => ({
      date: typeof t.date === "string" ? t.date.split("T")[0] : t.date.toISOString().split("T")[0],
      merchant: t.merchant || "Unknown",
      description: t.description,
      amount: t.amount,
      type: t.type,
      category: t.category || "Uncategorized",
    }));
}

function getCategoryBreakdown(
  transactions: Transaction[],
  type: "income" | "expense"
): Array<{ label: string; value: string; note?: string }> {
  const filterFn = type === "income" ? isIncome : isExpense;
  const map = new Map<string, number>();
  transactions
    .filter((t) => filterFn(t))
    .forEach((t) => {
      const cat = t.category || "Other";
      map.set(cat, (map.get(cat) || 0) + t.amount);
    });
  const items = Array.from(map.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([label, value]) => ({ label, value: fmtCurrency(value) }));
  return items;
}

function buildPreviousPeriod(
  currentVal: number | undefined,
  previousVal: number | undefined,
  formatter: (n: number) => string,
  invert = false
): { value: string; changeText: string; changeType: "positive" | "negative" | "neutral" } | undefined {
  if (currentVal === undefined || previousVal === undefined || Number.isNaN(currentVal) || Number.isNaN(previousVal)) {
    return undefined;
  }
  const change = calculateChangePercent(currentVal, previousVal, invert);
  return {
    value: formatter(previousVal),
    changeText: change.text,
    changeType: change.type,
  };
}

type HandlerParams = {
  kpi: KPICardConfig;
  metrics: DashboardMetrics;
  monthlyMetrics: MonthlyMetric[];
  transactions: Transaction[];
  dateRangeLabel: string;
};

/* ────────────────────────────────────────────────────────────────────────── */

function handleCashBalance({ kpi, metrics, monthlyMetrics }: HandlerParams): KPIDrilldownData {
  const sorted = getSortedMonths(monthlyMetrics);
  return {
    kpiId: kpi.id,
    title: kpi.label,
    currentValue: formatKPIValue(kpi, metrics),
    formula: "Cash Balance = sum of all connected account balances",
    formulaExplanation: "Total liquid cash available across all connected bank and payment accounts.",
    dataSource: "From connected financial accounts — current snapshot",
    breakdown: [{ label: "Current Cash Balance", value: fmtCurrency(metrics.cashBalance) }],
    trendData: sorted.map((m) => ({
      label: getMonthAbbreviation(m.month),
      value: m.cashIn - m.cashOut,
    })),
    qualityNotes: [
      "Based on latest account sync",
      "Historical balance levels are not available from monthly summaries",
    ],
    suggestions: ["Connect all bank accounts for complete picture", "Review large cash outflows"],
  };
}

function handleMonthlyRevenue({ kpi, metrics, monthlyMetrics, transactions, dateRangeLabel }: HandlerParams): KPIDrilldownData {
  const sorted = getSortedMonths(monthlyMetrics);
  const current = sorted[sorted.length - 1];
  const previous = sorted[sorted.length - 2];
  const prevPeriod = buildPreviousPeriod(current?.revenue, previous?.revenue, fmtCurrency, false);
  const incomeTxns = getTopTransactions(transactions, "income");
  const breakdown = getCategoryBreakdown(transactions, "income");
  if (breakdown.length === 0) {
    breakdown.push({ label: "Total Revenue", value: fmtCurrency(metrics.monthlyRevenue) });
  }
  return {
    kpiId: kpi.id,
    title: kpi.label,
    currentValue: formatKPIValue(kpi, metrics),
    formula: "Monthly Revenue = Σ income transactions",
    formulaExplanation: "Total cash inflow from revenue-generating activities during the selected period.",
    dataSource: `From transactions table, filtered by date range (${dateRangeLabel}), type = income`,
    breakdown,
    previousPeriod: prevPeriod,
    trendData: sorted.map((m) => ({ label: getMonthAbbreviation(m.month), value: m.revenue })),
    transactions: incomeTxns.length > 0 ? incomeTxns : undefined,
    qualityNotes: [`Based on ${transactions.filter((t) => isIncome(t)).length} income transactions`],
    suggestions: ["Diversify revenue streams", "Follow up on overdue invoices"],
  };
}

function handleMonthlyExpenses({ kpi, metrics, monthlyMetrics, transactions, dateRangeLabel }: HandlerParams): KPIDrilldownData {
  const sorted = getSortedMonths(monthlyMetrics);
  const current = sorted[sorted.length - 1];
  const previous = sorted[sorted.length - 2];
  const prevPeriod = buildPreviousPeriod(current?.expenses, previous?.expenses, fmtCurrency, true);
  const expenseTxns = getTopTransactions(transactions, "expense");
  const breakdown = getCategoryBreakdown(transactions, "expense");
  if (breakdown.length === 0) {
    breakdown.push({ label: "Total Expenses", value: fmtCurrency(metrics.monthlyExpenses) });
  }
  return {
    kpiId: kpi.id,
    title: kpi.label,
    currentValue: formatKPIValue(kpi, metrics),
    formula: "Monthly Expenses = Σ expense transactions",
    formulaExplanation: "Total cash outflow from business operations during the selected period.",
    dataSource: `From transactions table, filtered by date range (${dateRangeLabel}), type = expense`,
    breakdown,
    previousPeriod: prevPeriod,
    trendData: sorted.map((m) => ({ label: getMonthAbbreviation(m.month), value: m.expenses })),
    transactions: expenseTxns.length > 0 ? expenseTxns : undefined,
    qualityNotes: [`Based on ${transactions.filter((t) => isExpense(t)).length} expense transactions`],
    suggestions: ["Review top expense categories for savings", "Cancel unused subscriptions"],
  };
}

function handleNetProfit({ kpi, metrics, monthlyMetrics }: HandlerParams): KPIDrilldownData {
  const sorted = getSortedMonths(monthlyMetrics);
  const current = sorted[sorted.length - 1];
  const previous = sorted[sorted.length - 2];
  const prevPeriod = buildPreviousPeriod(current?.profit, previous?.profit, fmtCurrency, false);
  return {
    kpiId: kpi.id,
    title: kpi.label,
    currentValue: formatKPIValue(kpi, metrics),
    formula: "Net Profit = Revenue − Expenses",
    formulaExplanation: "Bottom-line profit after all expenses are deducted from revenue.",
    dataSource: "Derived from revenue and expense transactions",
    breakdown: [
      { label: "Revenue", value: fmtCurrency(metrics.monthlyRevenue) },
      { label: "Expenses", value: fmtCurrency(metrics.monthlyExpenses) },
      { label: "Net Profit", value: fmtCurrency(metrics.netProfit) },
    ],
    previousPeriod: prevPeriod,
    trendData: sorted.map((m) => ({ label: getMonthAbbreviation(m.month), value: m.profit })),
    qualityNotes: [`Profit margin: ${fmtPercent(metrics.profitMargin)}`],
    suggestions: metrics.netProfit < 0
      ? ["Reduce operating expenses", "Increase revenue to reach profitability"]
      : ["Improve gross margin", "Reinvest profit in growth"],
  };
}

function handleMonthlyBurn({ kpi, metrics, monthlyMetrics }: HandlerParams): KPIDrilldownData {
  const sorted = getSortedMonths(monthlyMetrics);
  const current = sorted[sorted.length - 1];
  const previous = sorted[sorted.length - 2];
  const currentBurn = current ? Math.max(0, current.expenses - current.revenue) : undefined;
  const previousBurn = previous ? Math.max(0, previous.expenses - previous.revenue) : undefined;
  const prevPeriod = buildPreviousPeriod(currentBurn, previousBurn, fmtCurrency, true);
  return {
    kpiId: kpi.id,
    title: kpi.label,
    currentValue: formatKPIValue(kpi, metrics),
    formula: "Monthly Burn = max(0, Expenses − Revenue)",
    formulaExplanation: "Net cash consumed each month. Zero when revenue covers or exceeds expenses.",
    dataSource: "Derived from monthly revenue and expenses",
    breakdown: [
      { label: "Monthly Expenses", value: fmtCurrency(metrics.monthlyExpenses) },
      { label: "Monthly Revenue", value: fmtCurrency(metrics.monthlyRevenue) },
      { label: "Net Burn", value: fmtCurrency(metrics.monthlyBurn) },
    ],
    previousPeriod: prevPeriod,
    trendData: sorted.map((m) => ({
      label: getMonthAbbreviation(m.month),
      value: Math.max(0, m.expenses - m.revenue),
    })),
    qualityNotes: [
      metrics.monthlyBurn === 0
        ? "Revenue covers expenses — burn is zero"
        : `Burn rate: ${fmtCurrency(metrics.monthlyBurn)}/month`,
    ],
    suggestions:
      metrics.monthlyBurn > 0
        ? ["Reduce burn to extend runway", "Increase revenue to cover expenses"]
        : ["Maintain positive cash flow", "Invest surplus in growth"],
  };
}

function handleRunway({ kpi, metrics, monthlyMetrics }: HandlerParams): KPIDrilldownData {
  const sorted = getSortedMonths(monthlyMetrics);
  const isInfinite = !Number.isFinite(metrics.runwayMonths);
  return {
    kpiId: kpi.id,
    title: kpi.label,
    currentValue: formatKPIValue(kpi, metrics),
    formula: "Runway = Cash Balance / Monthly Burn",
    formulaExplanation:
      "Months until cash runs out at current burn rate. Infinite when burn is zero.",
    dataSource: "Derived from cash balance and monthly burn",
    breakdown: [
      { label: "Cash Balance", value: fmtCurrency(metrics.cashBalance) },
      { label: "Monthly Burn", value: fmtCurrency(metrics.monthlyBurn) },
      { label: "Runway", value: formatKPIValue(kpi, metrics) },
    ],
    trendData: sorted.map((m) => ({
      label: getMonthAbbreviation(m.month),
      value: Math.max(0, m.expenses - m.revenue),
    })),
    qualityNotes: [
      isInfinite
        ? "Burn is zero — runway is infinite"
        : `Based on current burn of ${fmtCurrency(metrics.monthlyBurn)}`,
      "Assumes constant burn rate and no new funding",
    ],
    suggestions: [
      !isInfinite && metrics.runwayMonths < 6
        ? "Prioritize fundraising or revenue growth"
        : "Maintain 12+ months runway",
      "Model scenarios with different burn rates",
    ].filter(Boolean) as string[],
  };
}

function handleMonthlySubSpend({ kpi, metrics }: HandlerParams): KPIDrilldownData {
  return {
    kpiId: kpi.id,
    title: kpi.label,
    currentValue: formatKPIValue(kpi, metrics),
    formula: "Monthly Sub Spend = Σ active subscription amounts",
    formulaExplanation: "Total recurring monthly spend on software and service subscriptions.",
    dataSource: "From subscriptions table, active subscriptions only",
    breakdown: [{ label: "Monthly Subscription Spend", value: fmtCurrency(metrics.monthlySubscriptionSpend) }],
    trendData: [],
    qualityNotes: [
      `${metrics.activeSubscriptions} active subscription${metrics.activeSubscriptions === 1 ? "" : "s"}`,
      "Per-month subscription trend requires subscription-level historical data",
    ],
    suggestions: ["Audit unused subscriptions", "Negotiate annual discounts"],
  };
}

function handleARR({ kpi, metrics, monthlyMetrics }: HandlerParams): KPIDrilldownData {
  const sorted = getSortedMonths(monthlyMetrics);
  const current = sorted[sorted.length - 1];
  const previous = sorted[sorted.length - 2];
  const currentARR = current ? current.revenue * 12 : undefined;
  const previousARR = previous ? previous.revenue * 12 : undefined;
  const prevPeriod = buildPreviousPeriod(currentARR, previousARR, fmtCurrency, false);
  return {
    kpiId: kpi.id,
    title: kpi.label,
    currentValue: formatKPIValue(kpi, metrics),
    formula: "ARR = Monthly Recurring Revenue × 12",
    formulaExplanation: "Annualized recurring revenue based on current monthly revenue.",
    dataSource: "Derived from monthly revenue or subscription data",
    breakdown: [
      { label: "Monthly Revenue", value: fmtCurrency(metrics.monthlyRevenue) },
      { label: "ARR (×12)", value: fmtCurrency(metrics.arr) },
    ],
    previousPeriod: prevPeriod,
    trendData: sorted.map((m) => ({
      label: getMonthAbbreviation(m.month),
      value: m.revenue * 12,
    })),
    qualityNotes:
      metrics.arr > 0
        ? [`Based on MRR of ${fmtCurrency(metrics.monthlyRevenue)}`]
        : ["Insufficient data for ARR calculation — no recurring revenue detected"],
    suggestions:
      metrics.arr > 0
        ? ["Track net new ARR monthly", "Reduce churn to grow ARR"]
        : ["Set up recurring billing", "Identify subscription opportunities"],
  };
}

function handleGrossMargin({ kpi, metrics }: HandlerParams): KPIDrilldownData {
  return {
    kpiId: kpi.id,
    title: kpi.label,
    currentValue: formatKPIValue(kpi, metrics),
    formula: "Gross Margin = (Revenue − COGS) / Revenue × 100",
    formulaExplanation: "Percentage of revenue retained after direct costs of goods sold.",
    dataSource: "Derived from revenue and cost of goods sold",
    breakdown: [
      { label: "Gross Margin", value: fmtPercent(metrics.grossMargin) },
      { label: "Revenue", value: fmtCurrency(metrics.monthlyRevenue) },
    ],
    trendData: [],
    qualityNotes: [
      metrics.grossMargin !== 0
        ? `Current gross margin: ${fmtPercent(metrics.grossMargin)}`
        : "Gross margin is zero — COGS may not be categorized",
      "Requires accurate COGS categorization",
    ],
    suggestions: ["Review COGS categorization", "Negotiate supplier rates", "Improve pricing strategy"],
  };
}

function handleBurnMultiple({ kpi, metrics }: HandlerParams): KPIDrilldownData {
  const hasData = Number.isFinite(metrics.burnMultiple) && metrics.burnMultiple > 0 && metrics.netNewARR !== 0;
  return {
    kpiId: kpi.id,
    title: kpi.label,
    currentValue: formatKPIValue(kpi, metrics),
    formula: "Burn Multiple = Net Burn / Net New ARR",
    formulaExplanation:
      "Capital efficiency metric. Lower is better. Measures how much cash is burned to generate each dollar of new ARR.",
    dataSource: "Derived from net burn and net new ARR",
    breakdown: [
      { label: "Net Burn", value: fmtCurrency(metrics.monthlyBurn) },
      { label: "Net New ARR", value: fmtCurrency(metrics.netNewARR) },
      { label: "Burn Multiple", value: formatKPIValue(kpi, metrics) },
    ],
    trendData: [],
    qualityNotes: [
      hasData
        ? `Burn multiple: ${fmtNumber(metrics.burnMultiple, 2)}`
        : "Insufficient data for burn multiple calculation",
      ...(hasData && metrics.burnMultiple > 3 ? ["High burn multiple — review capital efficiency"] : []),
    ],
    suggestions: ["Target burn multiple < 1.5", "Grow ARR faster than burn", "Reduce unnecessary spend"],
  };
}

function handleRuleOf40({ kpi, metrics, monthlyMetrics }: HandlerParams): KPIDrilldownData {
  const change = getKPIChange(kpi, monthlyMetrics, metrics);
  return {
    kpiId: kpi.id,
    title: kpi.label,
    currentValue: formatKPIValue(kpi, metrics),
    formula: "Rule of 40 = Growth Rate + Profit Margin",
    formulaExplanation:
      "Combined growth and profitability benchmark. SaaS companies aim for a combined score of ≥40%.",
    dataSource: "Derived from revenue growth rate and profit margin",
    breakdown: [
      { label: "Profit Margin", value: fmtPercent(metrics.profitMargin) },
      { label: "Rule of 40 Score", value: fmtNumber(metrics.ruleOf40, 1) },
    ],
    previousPeriod: change
      ? {
          value: "—",
          changeText: change.text,
          changeType: change.type,
        }
      : undefined,
    trendData: [],
    qualityNotes: [
      `Rule of 40: ${fmtNumber(metrics.ruleOf40, 1)}`,
      metrics.ruleOf40 >= 40 ? "On track (≥40)" : "Below 40 benchmark",
    ],
    suggestions:
      metrics.ruleOf40 < 40
        ? ["Improve revenue growth", "Increase profitability"]
        : ["Maintain balance of growth and profit"],
  };
}

function handleHealthScore({ kpi, metrics, monthlyMetrics }: HandlerParams): KPIDrilldownData {
  const change = getKPIChange(kpi, monthlyMetrics, metrics);
  return {
    kpiId: kpi.id,
    title: kpi.label,
    currentValue: formatKPIValue(kpi, metrics),
    formula: "Health Score = composite(cash, revenue, expense, subscription health)",
    formulaExplanation:
      "Overall financial health score from 0-100 based on cash runway, revenue growth, expense control, and subscription health.",
    dataSource: "Derived algorithmically from multiple financial signals",
    breakdown: [{ label: "Health Score", value: `${Math.round(metrics.healthScore)}/100` }],
    previousPeriod: change
      ? {
          value: "—",
          changeText: change.text,
          changeType: change.type,
        }
      : undefined,
    trendData: [],
    qualityNotes: [
      metrics.healthScore >= 80
        ? "Strong financial health"
        : metrics.healthScore >= 60
          ? "Good financial health"
          : "Financial health needs attention",
      `Score: ${Math.round(metrics.healthScore)}/100`,
    ],
    suggestions:
      metrics.healthScore < 80
        ? ["Review cash runway", "Optimize expense structure", "Monitor revenue trends"]
        : ["Continue current financial strategy"],
  };
}

/* ────────────────────────────────────────────────────────────────────────── */

const HANDLERS: Record<string, (params: HandlerParams) => KPIDrilldownData> = {
  cash_balance: handleCashBalance,
  monthly_revenue: handleMonthlyRevenue,
  monthly_expenses: handleMonthlyExpenses,
  net_profit: handleNetProfit,
  monthly_burn: handleMonthlyBurn,
  runway: handleRunway,
  monthly_sub_spend: handleMonthlySubSpend,
  arr: handleARR,
  gross_margin: handleGrossMargin,
  burn_multiple: handleBurnMultiple,
  rule_of_40: handleRuleOf40,
  health_score: handleHealthScore,
};

export function getKPIDrilldownData(
  kpiId: string,
  metrics: DashboardMetrics,
  monthlyMetrics: MonthlyMetric[],
  transactions: Transaction[],
  dateRangeLabel: string
): KPIDrilldownData | null {
  const kpi = KPI_CATALOG.find((k) => k.id === kpiId);
  if (!kpi) return null;
  const handler = HANDLERS[kpiId];
  if (!handler) return null;
  return handler({ kpi, metrics, monthlyMetrics, transactions, dateRangeLabel });
}
