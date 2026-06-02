import { describe, it, expect } from "vitest";
import { getKPIDrilldownData, type KPIDrilldownData } from "@/lib/business-intelligence/kpi-drilldown";
import type { DashboardMetrics, MonthlyMetric, Transaction } from "@/lib/types";

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
    activeSubscriptions: 5,
    flaggedSubscriptions: 0,
    potentialSavings: 500,
    totalTransactions: 120,
    uncategorizedTransactions: 3,
    ...overrides,
  } as DashboardMetrics;
}

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

function makeTransaction(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: "txn-1",
    date: "2024-02-15",
    merchant: "Acme Corp",
    description: "Monthly service",
    amount: 1000,
    type: "expense",
    status: "completed",
    category: "Software",
    ...overrides,
  } as Transaction;
}

function assertCommon(data: KPIDrilldownData | null) {
  expect(data).toBeTruthy();
  expect(data!.kpiId).toBeTruthy();
  expect(data!.title).toBeTruthy();
  expect(data!.currentValue).toBeTruthy();
  expect(data!.formula).toBeTruthy();
  expect(data!.formulaExplanation).toBeTruthy();
  expect(data!.dataSource).toBeTruthy();
  expect(Array.isArray(data!.breakdown)).toBe(true);
  expect(Array.isArray(data!.trendData)).toBe(true);
  expect(Array.isArray(data!.qualityNotes)).toBe(true);
  expect(Array.isArray(data!.suggestions)).toBe(true);
}

describe("getKPIDrilldownData", () => {
  it("returns null for unknown kpiId", () => {
    const result = getKPIDrilldownData("unknown_kpi", makeMetrics(), [], [], "Last 30 days");
    expect(result).toBeNull();
  });

  describe("cash_balance", () => {
    it("returns drilldown with net cash flow trend", () => {
      const data = getKPIDrilldownData(
        "cash_balance",
        makeMetrics(),
        [makeMonth("2024-01"), makeMonth("2024-02")],
        [],
        "Last 30 days"
      );
      assertCommon(data);
      expect(data!.kpiId).toBe("cash_balance");
      expect(data!.currentValue).toBe("$100,000");
      expect(data!.breakdown[0].label).toBe("Current Cash Balance");
      expect(data!.trendData.length).toBe(2);
      expect(data!.previousPeriod).toBeUndefined();
    });

    it("handles empty monthly metrics", () => {
      const data = getKPIDrilldownData("cash_balance", makeMetrics(), [], [], "Last 30 days");
      assertCommon(data);
      expect(data!.trendData).toEqual([]);
    });
  });

  describe("monthly_revenue", () => {
    it("returns drilldown with transactions and previous period", () => {
      const txns = [
        makeTransaction({ type: "income", amount: 5000, merchant: "Client A" }),
        makeTransaction({ type: "income", amount: 3000, merchant: "Client B" }),
        makeTransaction({ type: "expense", amount: 2000 }),
      ];
      const data = getKPIDrilldownData(
        "monthly_revenue",
        makeMetrics(),
        [makeMonth("2024-01", { revenue: 40000 }), makeMonth("2024-02", { revenue: 50000 })],
        txns,
        "Last 30 days"
      );
      assertCommon(data);
      expect(data!.kpiId).toBe("monthly_revenue");
      expect(data!.currentValue).toBe("$50,000");
      expect(data!.transactions).toHaveLength(2);
      expect(data!.transactions![0].amount).toBe(5000);
      expect(data!.previousPeriod).toBeTruthy();
      expect(data!.previousPeriod!.changeText).toBe("+25.0%");
      expect(data!.previousPeriod!.changeType).toBe("positive");
    });

    it("shows total revenue when no category breakdown exists", () => {
      const data = getKPIDrilldownData("monthly_revenue", makeMetrics(), [], [], "Last 30 days");
      assertCommon(data);
      expect(data!.breakdown[0].label).toBe("Total Revenue");
      expect(data!.transactions).toBeUndefined();
    });
  });

  describe("monthly_expenses", () => {
    it("returns drilldown with top expenses and inverted previous period", () => {
      const txns = [
        makeTransaction({ type: "expense", amount: 5000, category: "Software" }),
        makeTransaction({ type: "expense", amount: 3000, category: "Advertising" }),
        makeTransaction({ type: "income", amount: 10000 }),
      ];
      const data = getKPIDrilldownData(
        "monthly_expenses",
        makeMetrics(),
        [makeMonth("2024-01", { expenses: 40000 }), makeMonth("2024-02", { expenses: 30000 })],
        txns,
        "Last 30 days"
      );
      assertCommon(data);
      expect(data!.kpiId).toBe("monthly_expenses");
      expect(data!.currentValue).toBe("$30,000");
      expect(data!.transactions).toHaveLength(2);
      expect(data!.previousPeriod).toBeTruthy();
      expect(data!.previousPeriod!.changeText).toBe("-25.0%");
      expect(data!.previousPeriod!.changeType).toBe("positive"); // decrease in expenses is positive
    });

    it("groups expenses by category in breakdown", () => {
      const txns = [
        makeTransaction({ type: "expense", amount: 1000, category: "Software" }),
        makeTransaction({ type: "expense", amount: 500, category: "Software" }),
        makeTransaction({ type: "expense", amount: 800, category: "Advertising" }),
      ];
      const data = getKPIDrilldownData("monthly_expenses", makeMetrics(), [], txns, "Last 30 days");
      assertCommon(data);
      expect(data!.breakdown.some((b) => b.label === "Software" && b.value === "$1,500")).toBe(true);
      expect(data!.breakdown.some((b) => b.label === "Advertising" && b.value === "$800")).toBe(true);
    });
  });

  describe("net_profit", () => {
    it("returns breakdown of revenue minus expenses", () => {
      const data = getKPIDrilldownData(
        "net_profit",
        makeMetrics(),
        [makeMonth("2024-01", { profit: 15000 }), makeMonth("2024-02", { profit: 20000 })],
        [],
        "Last 30 days"
      );
      assertCommon(data);
      expect(data!.kpiId).toBe("net_profit");
      expect(data!.breakdown).toHaveLength(3);
      expect(data!.breakdown.some((b) => b.label === "Net Profit")).toBe(true);
      expect(data!.previousPeriod!.changeText).toBe("+33.3%");
    });

    it("suggests cost reduction when profit is negative", () => {
      const data = getKPIDrilldownData(
        "net_profit",
        makeMetrics({ netProfit: -5000, monthlyRevenue: 20000, monthlyExpenses: 25000 }),
        [],
        [],
        "Last 30 days"
      );
      assertCommon(data);
      expect(data!.suggestions).toContain("Reduce operating expenses");
      expect(data!.suggestions).toContain("Increase revenue to reach profitability");
    });
  });

  describe("monthly_burn", () => {
    it("returns zero burn when revenue exceeds expenses", () => {
      const data = getKPIDrilldownData(
        "monthly_burn",
        makeMetrics({ monthlyBurn: 0, monthlyRevenue: 50000, monthlyExpenses: 30000 }),
        [makeMonth("2024-01", { revenue: 60000, expenses: 30000 })],
        [],
        "Last 30 days"
      );
      assertCommon(data);
      expect(data!.currentValue).toBe("$0");
      expect(data!.qualityNotes[0]).toContain("burn is zero");
    });

    it("computes previous period burn comparison", () => {
      const data = getKPIDrilldownData(
        "monthly_burn",
        makeMetrics({ monthlyBurn: 10000, monthlyRevenue: 20000, monthlyExpenses: 30000 }),
        [
          makeMonth("2024-01", { revenue: 15000, expenses: 35000 }),
          makeMonth("2024-02", { revenue: 20000, expenses: 30000 }),
        ],
        [],
        "Last 30 days"
      );
      assertCommon(data);
      expect(data!.currentValue).toBe("$10,000");
      expect(data!.previousPeriod).toBeTruthy();
      // Jan burn = 20,000; Feb burn = 10,000; change = -50% which is positive (good)
      expect(data!.previousPeriod!.changeText).toBe("-50.0%");
      expect(data!.previousPeriod!.changeType).toBe("positive");
    });
  });

  describe("runway", () => {
    it("returns infinite runway when burn is zero", () => {
      const data = getKPIDrilldownData(
        "runway",
        makeMetrics({ runwayMonths: Infinity, monthlyBurn: 0 }),
        [],
        [],
        "Last 30 days"
      );
      assertCommon(data);
      expect(data!.currentValue).toBe("Infinite");
      expect(data!.qualityNotes[0]).toContain("infinite");
    });

    it("returns finite runway with suggestions when low", () => {
      const data = getKPIDrilldownData(
        "runway",
        makeMetrics({ runwayMonths: 3, monthlyBurn: 33333 }),
        [],
        [],
        "Last 30 days"
      );
      assertCommon(data);
      expect(data!.currentValue).toBe("3 mo");
      expect(data!.suggestions).toContain("Prioritize fundraising or revenue growth");
    });

    it("returns trend data as monthly burn driver", () => {
      const data = getKPIDrilldownData(
        "runway",
        makeMetrics(),
        [makeMonth("2024-01", { revenue: 40000, expenses: 50000 }), makeMonth("2024-02")],
        [],
        "Last 30 days"
      );
      assertCommon(data);
      expect(data!.trendData[0].value).toBe(10000);
    });
  });

  describe("monthly_sub_spend", () => {
    it("returns subscription spend drilldown", () => {
      const data = getKPIDrilldownData("monthly_sub_spend", makeMetrics(), [], [], "Last 30 days");
      assertCommon(data);
      expect(data!.kpiId).toBe("monthly_sub_spend");
      expect(data!.currentValue).toBe("$2,000");
      expect(data!.trendData).toEqual([]);
      expect(data!.qualityNotes[0]).toContain("5 active subscription");
    });
  });

  describe("arr", () => {
    it("returns ARR drilldown with monthly multiplier", () => {
      const data = getKPIDrilldownData(
        "arr",
        makeMetrics(),
        [makeMonth("2024-01", { revenue: 40000 }), makeMonth("2024-02", { revenue: 50000 })],
        [],
        "Last 30 days"
      );
      assertCommon(data);
      expect(data!.kpiId).toBe("arr");
      expect(data!.currentValue).toBe("$600,000");
      expect(data!.breakdown.some((b) => b.label === "ARR (×12)")).toBe(true);
      expect(data!.trendData[0].value).toBe(480000);
      expect(data!.trendData[1].value).toBe(600000);
    });

    it("warns when ARR is zero", () => {
      const data = getKPIDrilldownData(
        "arr",
        makeMetrics({ arr: 0, monthlyRevenue: 0 }),
        [],
        [],
        "Last 30 days"
      );
      assertCommon(data);
      expect(data!.qualityNotes[0]).toContain("Insufficient data");
      expect(data!.suggestions).toContain("Set up recurring billing");
    });
  });

  describe("gross_margin", () => {
    it("returns gross margin drilldown", () => {
      const data = getKPIDrilldownData("gross_margin", makeMetrics(), [], [], "Last 30 days");
      assertCommon(data);
      expect(data!.kpiId).toBe("gross_margin");
      expect(data!.currentValue).toBe("60.0%");
      expect(data!.trendData).toEqual([]);
    });

    it("notes zero gross margin", () => {
      const data = getKPIDrilldownData("gross_margin", makeMetrics({ grossMargin: 0 }), [], [], "Last 30 days");
      assertCommon(data);
      expect(data!.qualityNotes[0]).toContain("zero");
    });
  });

  describe("burn_multiple", () => {
    it("returns burn multiple drilldown", () => {
      const data = getKPIDrilldownData("burn_multiple", makeMetrics(), [], [], "Last 30 days");
      assertCommon(data);
      expect(data!.kpiId).toBe("burn_multiple");
      expect(data!.currentValue).toBe("1.50");
      expect(data!.breakdown.some((b) => b.label === "Net Burn")).toBe(true);
    });

    it("flags high burn multiple", () => {
      const data = getKPIDrilldownData(
        "burn_multiple",
        makeMetrics({ burnMultiple: 4.5 }),
        [],
        [],
        "Last 30 days"
      );
      assertCommon(data);
      expect(data!.qualityNotes.some((n) => n.includes("High burn multiple"))).toBe(true);
    });

    it("notes insufficient data when burnMultiple is invalid", () => {
      const data = getKPIDrilldownData(
        "burn_multiple",
        makeMetrics({ burnMultiple: 0, netNewARR: 0 }),
        [],
        [],
        "Last 30 days"
      );
      assertCommon(data);
      expect(data!.qualityNotes[0]).toContain("Insufficient data");
    });
  });

  describe("rule_of_40", () => {
    it("returns on-track when score >= 40", () => {
      const data = getKPIDrilldownData(
        "rule_of_40",
        makeMetrics({ ruleOf40: 45 }),
        [],
        [],
        "Last 30 days"
      );
      assertCommon(data);
      expect(data!.kpiId).toBe("rule_of_40");
      expect(data!.currentValue).toBe("45.0");
      expect(data!.previousPeriod!.changeText).toBe("✓ On track");
      expect(data!.previousPeriod!.changeType).toBe("positive");
    });

    it("returns below benchmark when score < 40", () => {
      const data = getKPIDrilldownData(
        "rule_of_40",
        makeMetrics({ ruleOf40: 30 }),
        [],
        [],
        "Last 30 days"
      );
      assertCommon(data);
      expect(data!.previousPeriod!.changeText).toBe("Below 40");
      expect(data!.previousPeriod!.changeType).toBe("negative");
      expect(data!.suggestions).toContain("Improve revenue growth");
    });
  });

  describe("health_score", () => {
    it("returns strong for high score", () => {
      const data = getKPIDrilldownData("health_score", makeMetrics({ healthScore: 85 }), [], [], "Last 30 days");
      assertCommon(data);
      expect(data!.kpiId).toBe("health_score");
      expect(data!.currentValue).toBe("85.0");
      expect(data!.previousPeriod!.changeText).toBe("Strong");
      expect(data!.previousPeriod!.changeType).toBe("positive");
    });

    it("returns at risk for low score", () => {
      const data = getKPIDrilldownData("health_score", makeMetrics({ healthScore: 40 }), [], [], "Last 30 days");
      assertCommon(data);
      expect(data!.previousPeriod!.changeText).toBe("At Risk");
      expect(data!.previousPeriod!.changeType).toBe("negative");
      expect(data!.suggestions).toContain("Review cash runway");
    });

    it("returns good for medium score", () => {
      const data = getKPIDrilldownData("health_score", makeMetrics({ healthScore: 65 }), [], [], "Last 30 days");
      assertCommon(data);
      expect(data!.previousPeriod!.changeText).toBe("Good");
      expect(data!.previousPeriod!.changeType).toBe("positive");
    });
  });

  describe("edge cases", () => {
    it("handles transactions with Date objects", () => {
      const txns = [
        makeTransaction({ type: "expense", date: new Date("2024-02-15T00:00:00Z") }),
      ];
      const data = getKPIDrilldownData("monthly_expenses", makeMetrics(), [], txns, "Last 30 days");
      assertCommon(data);
      expect(data!.transactions![0].date).toBe("2024-02-15");
    });

    it("handles missing merchant names", () => {
      const txns = [makeTransaction({ type: "income", merchant: undefined })];
      const data = getKPIDrilldownData("monthly_revenue", makeMetrics(), [], txns, "Last 30 days");
      assertCommon(data);
      expect(data!.transactions![0].merchant).toBe("Unknown");
    });

    it("limits transactions to top 5", () => {
      const txns = Array.from({ length: 10 }, (_, i) =>
        makeTransaction({ type: "expense", amount: 1000 - i })
      );
      const data = getKPIDrilldownData("monthly_expenses", makeMetrics(), [], txns, "Last 30 days");
      assertCommon(data);
      expect(data!.transactions).toHaveLength(5);
    });

    it("handles single month of monthlyMetrics gracefully", () => {
      const data = getKPIDrilldownData(
        "monthly_revenue",
        makeMetrics(),
        [makeMonth("2024-02")],
        [],
        "Last 30 days"
      );
      assertCommon(data);
      expect(data!.previousPeriod).toBeUndefined();
      expect(data!.trendData).toHaveLength(1);
    });

    it("handles empty transactions for revenue/expenses", () => {
      const data = getKPIDrilldownData("monthly_revenue", makeMetrics(), [], [], "Last 30 days");
      assertCommon(data);
      expect(data!.transactions).toBeUndefined();
      expect(data!.qualityNotes[0]).toContain("0 income");
    });
  });
});
