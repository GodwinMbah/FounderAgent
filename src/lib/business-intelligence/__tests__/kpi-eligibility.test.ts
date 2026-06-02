import { describe, it, expect } from "vitest";
import {
  KPI_CATALOG,
  getEligibleKPIs,
  formatKPIValue,
  getKPIChange,
} from "@/lib/business-intelligence/kpi-eligibility";
import type { CompanyBusinessProfile, KPICardConfig } from "@/lib/business-intelligence/types";
import type { DashboardMetrics, MonthlyMetric } from "@/lib/types";

function makeProfile(overrides: Partial<CompanyBusinessProfile> = {}): CompanyBusinessProfile {
  return {
    businessModel: "saas",
    revenueModels: ["subscription"],
    costStructure: [],
    ...overrides,
  };
}

function makeMetrics(overrides: Partial<DashboardMetrics> = {}): DashboardMetrics {
  return {
    cashBalance: 100000,
    monthlyRevenue: 50000,
    monthlyExpenses: 30000,
    netProfit: 20000,
    monthlyBurn: 0,
    runwayMonths: 24,
    healthScore: 85,
    monthlySubscriptionSpend: 2000,
    arr: 600000,
    grossMargin: 60,
    netNewARR: 50000,
    burnMultiple: 1.5,
    ruleOf40: 45,
    profitMargin: 40,
    ...overrides,
  } as DashboardMetrics;
}

function findKPI(id: string): KPICardConfig {
  const kpi = KPI_CATALOG.find((k) => k.id === id);
  if (!kpi) throw new Error(`KPI ${id} not found in catalog`);
  return kpi;
}

describe("getEligibleKPIs", () => {
  it("SaaS business shows ARR and Monthly Sub Spend", () => {
    const profile = makeProfile({ businessModel: "saas", revenueModels: ["subscription"] });
    const metrics = makeMetrics();
    const eligible = getEligibleKPIs(profile, metrics);
    const ids = eligible.map((k) => k.id);
    expect(ids).toContain("arr");
    expect(ids).toContain("monthly_sub_spend");
  });

  it("Ecommerce business hides ARR", () => {
    const profile = makeProfile({ businessModel: "ecommerce", revenueModels: ["one_time"] });
    const metrics = makeMetrics();
    const eligible = getEligibleKPIs(profile, metrics);
    const ids = eligible.map((k) => k.id);
    expect(ids).not.toContain("arr");
    expect(ids).not.toContain("monthly_sub_spend");
  });

  it("Ecommerce business shows Gross Margin when COGS enabled", () => {
    const profile = makeProfile({
      businessModel: "ecommerce",
      revenueModels: ["one_time"],
      costStructure: ["cogs"],
    });
    const metrics = makeMetrics({ grossMargin: 30 });
    const eligible = getEligibleKPIs(profile, metrics);
    const ids = eligible.map((k) => k.id);
    expect(ids).toContain("gross_margin");
  });

  it("Agency business hides ARR and shows only core KPIs plus applicable ones", () => {
    const profile = makeProfile({ businessModel: "agency", revenueModels: ["retainer"] });
    const metrics = makeMetrics();
    const eligible = getEligibleKPIs(profile, metrics);
    const ids = eligible.map((k) => k.id);
    expect(ids).not.toContain("arr");
    expect(ids).toContain("cash_balance");
    expect(ids).toContain("monthly_revenue");
    expect(ids).toContain("monthly_expenses");
    expect(ids).toContain("net_profit");
    expect(ids).toContain("monthly_burn");
    expect(ids).toContain("runway");
    expect(ids).toContain("health_score");
  });

  it("Mixed business shows subscription KPIs + core", () => {
    const profile = makeProfile({
      businessModel: "mixed",
      revenueModels: ["subscription", "one_time"],
    });
    const metrics = makeMetrics();
    const eligible = getEligibleKPIs(profile, metrics);
    const ids = eligible.map((k) => k.id);
    expect(ids).toContain("arr");
    expect(ids).toContain("monthly_sub_spend");
    expect(ids).toContain("cash_balance");
    expect(ids).toContain("monthly_revenue");
  });

  it("ARR hidden when arr = 0", () => {
    const profile = makeProfile({ businessModel: "saas", revenueModels: ["subscription"] });
    const metrics = makeMetrics({ arr: 0 });
    const eligible = getEligibleKPIs(profile, metrics);
    const ids = eligible.map((k) => k.id);
    expect(ids).not.toContain("arr");
  });

  it("Gross Margin hidden when no COGS and grossMargin = 0", () => {
    const profile = makeProfile({
      businessModel: "saas",
      revenueModels: ["subscription"],
      costStructure: [],
    });
    const metrics = makeMetrics({ grossMargin: 0 });
    const eligible = getEligibleKPIs(profile, metrics);
    const ids = eligible.map((k) => k.id);
    expect(ids).not.toContain("gross_margin");
  });

  it("Burn Multiple hidden when netNewARR = 0", () => {
    const profile = makeProfile({ businessModel: "saas" });
    const metrics = makeMetrics({ netNewARR: 0, burnMultiple: 0 });
    const eligible = getEligibleKPIs(profile, metrics);
    const ids = eligible.map((k) => k.id);
    expect(ids).not.toContain("burn_multiple");
  });

  it("Rule of 40 hidden when no data (ruleOf40 = 0 and profitMargin = 0)", () => {
    const profile = makeProfile({ businessModel: "saas" });
    const metrics = makeMetrics({ ruleOf40: 0, profitMargin: 0 });
    const eligible = getEligibleKPIs(profile, metrics);
    const ids = eligible.map((k) => k.id);
    expect(ids).not.toContain("rule_of_40");
  });
});

describe("formatKPIValue", () => {
  it("formats currency KPIs", () => {
    const kpi = findKPI("cash_balance");
    expect(formatKPIValue(kpi, makeMetrics())).toBe("$100,000");
  });

  it("formats percent KPIs", () => {
    const kpi = findKPI("gross_margin");
    expect(formatKPIValue(kpi, makeMetrics())).toBe("60.0%");
  });

  it("formats number KPIs with 1 decimal by default", () => {
    const kpi = findKPI("rule_of_40");
    expect(formatKPIValue(kpi, makeMetrics())).toBe("45.0");
  });

  it("formats burn multiple with 2 decimals", () => {
    const kpi = findKPI("burn_multiple");
    expect(formatKPIValue(kpi, makeMetrics())).toBe("1.50");
  });

  it("formats runway KPIs", () => {
    const kpi = findKPI("runway");
    expect(formatKPIValue(kpi, makeMetrics())).toBe("2 years");
  });

  it("formats text KPIs as pass-through", () => {
    const kpi: KPICardConfig = {
      id: "test_text",
      label: "Test",
      category: "core",
      dataKey: "customValue",
      format: "text",
      icon: "Wallet",
      iconColor: "#000",
      eligibility: () => true,
    };
    expect(formatKPIValue(kpi, { customValue: 42 } as unknown as DashboardMetrics)).toBe("42");
  });
});

function makeMonth(month: string, overrides: Partial<MonthlyMetric> = {}): MonthlyMetric {
  return {
    month,
    revenue: 50000,
    expenses: 30000,
    profit: 20000,
    cashIn: 50000,
    cashOut: 30000,
    ...overrides,
  };
}

describe("getKPIChange", () => {
  it("returns neutral when no changeDataKey", () => {
    const kpi = findKPI("cash_balance");
    const months = [makeMonth("2024-01"), makeMonth("2024-02")];
    const change = getKPIChange(kpi, months);
    expect(change!.text).toBe("—");
    expect(change!.type).toBe("neutral");
  });

  it("returns neutral with fewer than 2 months", () => {
    const kpi = findKPI("monthly_revenue");
    const change = getKPIChange(kpi, [makeMonth("2024-01")]);
    expect(change!.text).toBe("—");
    expect(change!.type).toBe("neutral");
  });

  it("computes MoM revenue change", () => {
    const kpi = findKPI("monthly_revenue");
    const prev = makeMonth("2024-01", { revenue: 40000 });
    const curr = makeMonth("2024-02", { revenue: 50000 });
    const change = getKPIChange(kpi, [prev, curr]);
    expect(change!.text).toBe("+25.0%");
    expect(change!.type).toBe("positive");
  });

  it("inverts change for expenses (decrease is positive)", () => {
    const kpi = findKPI("monthly_expenses");
    const prev = makeMonth("2024-01", { expenses: 40000 });
    const curr = makeMonth("2024-02", { expenses: 30000 });
    const change = getKPIChange(kpi, [prev, curr]);
    expect(change!.text).toBe("-25.0%");
    expect(change!.type).toBe("positive");
  });

  it("computes net profit change", () => {
    const kpi = findKPI("net_profit");
    const prev = makeMonth("2024-01", { profit: 15000 });
    const curr = makeMonth("2024-02", { profit: 20000 });
    const change = getKPIChange(kpi, [prev, curr]);
    expect(change!.text).toBe("+33.3%");
    expect(change!.type).toBe("positive");
  });

  it("returns strong for high health score", () => {
    const kpi = findKPI("health_score");
    const metrics = makeMetrics({ healthScore: 85 });
    const change = getKPIChange(kpi, [], metrics);
    expect(change!.text).toBe("Strong");
    expect(change!.type).toBe("positive");
  });

  it("returns at risk for low health score", () => {
    const kpi = findKPI("health_score");
    const metrics = makeMetrics({ healthScore: 40 });
    const change = getKPIChange(kpi, [], metrics);
    expect(change!.text).toBe("At Risk");
    expect(change!.type).toBe("negative");
  });

  it("returns on track for rule of 40 >= 40", () => {
    const kpi = findKPI("rule_of_40");
    const metrics = makeMetrics({ ruleOf40: 45 });
    const change = getKPIChange(kpi, [], metrics);
    expect(change!.text).toBe("✓ On track");
    expect(change!.type).toBe("positive");
  });

  it("returns below 40 for rule of 40 < 40", () => {
    const kpi = findKPI("rule_of_40");
    const metrics = makeMetrics({ ruleOf40: 30 });
    const change = getKPIChange(kpi, [], metrics);
    expect(change!.text).toBe("Below 40");
    expect(change!.type).toBe("negative");
  });
});
