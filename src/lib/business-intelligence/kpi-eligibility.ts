import type { CompanyBusinessProfile, KPICardConfig } from "./types";
import type { DashboardMetrics, MonthlyMetric } from "@/lib/types";
import { calculateChangePercent } from "@/lib/reporting/kpis";

export function buildCompanyBusinessProfile(settings: {
  businessModel?: string;
  revenueModels?: string[];
  costStructure?: string[];
  primaryGoal?: string;
  agentFocus?: string[];
} | null): CompanyBusinessProfile {
  if (!settings) {
    return { businessModel: "other", revenueModels: [], costStructure: [] };
  }
  return {
    businessModel: (settings.businessModel as CompanyBusinessProfile["businessModel"]) || "other",
    revenueModels: (settings.revenueModels as CompanyBusinessProfile["revenueModels"]) || [],
    costStructure: (settings.costStructure as CompanyBusinessProfile["costStructure"]) || [],
    primaryGoal: settings.primaryGoal,
    agentFocus: settings.agentFocus,
  };
}

export const KPI_CATALOG: KPICardConfig[] = [
  { id: "cash_balance", label: "Cash Balance", category: "core", dataKey: "cashBalance", format: "currency", icon: "Wallet", iconColor: "#14B8A6", eligibility: () => true },
  { id: "monthly_revenue", label: "Monthly Revenue", category: "core", dataKey: "monthlyRevenue", format: "currency", icon: "TrendingUp", iconColor: "#22C55E", eligibility: () => true, changeDataKey: "revenue" },
  { id: "monthly_expenses", label: "Monthly Expenses", category: "core", dataKey: "monthlyExpenses", format: "currency", icon: "TrendingDown", iconColor: "#F43F5E", eligibility: () => true, changeDataKey: "expenses", invertChange: true },
  { id: "net_profit", label: "Net Profit", category: "core", dataKey: "netProfit", format: "currency", icon: "Zap", iconColor: "#14B8A6", eligibility: () => true, changeDataKey: "profit" },
  { id: "monthly_burn", label: "Monthly Burn", category: "core", dataKey: "monthlyBurn", format: "currency", icon: "Flame", iconColor: "#F43F5E", eligibility: () => true },
  { id: "runway", label: "Runway", category: "core", dataKey: "runwayMonths", format: "runway", icon: "Clock", iconColor: "#22D3EE", eligibility: () => true },
  { id: "monthly_sub_spend", label: "Monthly Sub Spend", category: "saas", dataKey: "monthlySubscriptionSpend", format: "currency", icon: "Repeat", iconColor: "#8B5CF6", eligibility: (profile) => profile.revenueModels.includes("subscription") || profile.businessModel === "saas" || profile.businessModel === "membership" },
  { id: "arr", label: "ARR", category: "saas", dataKey: "arr", format: "currency", icon: "DollarSign", iconColor: "#22C55E", eligibility: (profile, metrics) => (profile.revenueModels.includes("subscription") || profile.businessModel === "saas" || profile.businessModel === "membership") && (metrics?.arr ?? 0) > 0 },
  { id: "gross_margin", label: "Gross Margin", category: "efficiency", dataKey: "grossMargin", format: "percent", icon: "Percent", iconColor: "#14B8A6", eligibility: (profile, metrics) => profile.costStructure.includes("cogs") || (metrics?.grossMargin ?? 0) !== 0 },
  { id: "burn_multiple", label: "Burn Multiple", category: "efficiency", dataKey: "burnMultiple", format: "number", icon: "Flame", iconColor: "#F43F5E", eligibility: (profile, metrics) => (metrics?.burnMultiple ?? 0) !== Infinity && (metrics?.burnMultiple ?? 0) > 0 && (metrics?.netNewARR ?? 0) !== 0 },
  { id: "rule_of_40", label: "Rule of 40", category: "efficiency", dataKey: "ruleOf40", format: "number", icon: "Target", iconColor: "#8B5CF6", eligibility: (profile, metrics) => (metrics?.ruleOf40 ?? 0) !== 0 || (metrics?.profitMargin ?? 0) !== 0 },
  { id: "health_score", label: "Health Score", category: "core", dataKey: "healthScore", format: "number", icon: "Heart", iconColor: "#8B5CF6", eligibility: () => true },
];

const CATEGORY_ORDER: Record<string, number> = {
  core: 1,
  saas: 2,
  efficiency: 3,
  risk: 4,
  quality: 5,
};

export function getEligibleKPIs(profile: CompanyBusinessProfile, metrics: unknown): KPICardConfig[] {
  return KPI_CATALOG
    .filter((kpi) => kpi.eligibility(profile, metrics as Record<string, number>))
    .sort((a, b) => (CATEGORY_ORDER[a.category] ?? 99) - (CATEGORY_ORDER[b.category] ?? 99));
}

export function formatKPIValue(kpi: KPICardConfig, metrics: DashboardMetrics, currency = "USD"): string {
  const raw = (metrics as unknown as Record<string, unknown>)[kpi.dataKey];
  if (raw === undefined || raw === null) return "—";

  if (kpi.format === "currency") {
    if (typeof raw === "number") {
      return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 0 }).format(raw);
    }
    return String(raw);
  }
  if (kpi.format === "percent") {
    return `${Number(raw).toFixed(1)}%`;
  }
  if (kpi.format === "runway") {
    const val = Number(raw);
    if (!Number.isFinite(val)) return "Infinite";
    if (val < 1) return "< 1 mo";
    if (val < 12) return `${Math.round(val)} mo`;
    const years = val / 12;
    return `${years % 1 === 0 ? years.toFixed(0) : years.toFixed(1)} ${years === 1 ? "year" : "years"}`;
  }
  if (kpi.id === "burn_multiple" && raw === Infinity) return "∞";
  if (kpi.format === "number") {
    if (kpi.id === "burn_multiple") return Number(raw).toFixed(2);
    return Number(raw).toFixed(1);
  }
  return String(raw);
}

export function getKPIChange(
  kpi: KPICardConfig,
  monthlyMetrics: MonthlyMetric[],
  metrics?: DashboardMetrics
): { text: string; type: "positive" | "negative" | "neutral" } | null {
  if (kpi.id === "health_score" && metrics) {
    const score = metrics.healthScore;
    return {
      text: score >= 80 ? "Strong" : score >= 60 ? "Good" : "At Risk",
      type: score >= 60 ? "positive" : "negative",
    };
  }
  if (kpi.id === "rule_of_40" && metrics) {
    const val = metrics.ruleOf40;
    return {
      text: val >= 40 ? "✓ On track" : "Below 40",
      type: val >= 40 ? "positive" : "negative",
    };
  }

  if (!kpi.changeDataKey) return { text: "—", type: "neutral" };

  const sorted = [...monthlyMetrics].sort((a, b) => a.month.localeCompare(b.month));
  const current = sorted[sorted.length - 1];
  const previous = sorted[sorted.length - 2];

  if (!current || !previous) return { text: "—", type: "neutral" };

  const currentVal = (current as unknown as Record<string, number | undefined>)[kpi.changeDataKey];
  const previousVal = (previous as unknown as Record<string, number | undefined>)[kpi.changeDataKey];

  return calculateChangePercent(currentVal, previousVal, kpi.invertChange);
}
