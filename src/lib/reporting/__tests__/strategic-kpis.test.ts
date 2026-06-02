import { describe, it, expect } from "vitest";
import {
  calculateARR,
  calculateGrossMargin,
  calculateNetNewARR,
  calculateBurnMultiple,
  calculateYoYGrowth,
  calculateRuleOf40,
  sumCOGS,
} from "@/lib/reporting/strategic-kpis";
import { isCOGS } from "@/lib/reporting/filters";

describe("isCOGS", () => {
  it("detects COGS by category (case-insensitive)", () => {
    expect(isCOGS({ type: "expense", category: "Shipping and Fulfilment" })).toBe(true);
    expect(isCOGS({ type: "expense", category: "Materials" })).toBe(true);
    expect(isCOGS({ type: "expense", category: "COGS" })).toBe(
      true
    );
    expect(isCOGS({ type: "expense", category: "Direct Labor" })).toBe(true);
  });

  it("detects COGS by tags (case-insensitive)", () => {
    expect(isCOGS({ type: "expense", tags: ["Fulfillment"] })).toBe(true);
    expect(isCOGS({ type: "expense", tags: ["manufacturing"] })).toBe(true);
  });

  it("excludes transfers", () => {
    expect(
      isCOGS({ type: "expense", category: "Transfers", tags: ["Shipping"] })
    ).toBe(false);
    expect(
      isCOGS({ type: "expense", category: "Shipping and Fulfilment", tags: ["transfer"] })
    ).toBe(false);
  });

  it("returns false for non-COGS categories", () => {
    expect(isCOGS({ type: "expense", category: "Software" })).toBe(false);
    expect(isCOGS({ type: "income", category: "Revenue" })).toBe(false);
  });
});

describe("calculateARR", () => {
  it("returns 0 for empty array", () => {
    expect(calculateARR([])).toBe(0);
  });

  it("annualizes monthly subscriptions (×12)", () => {
    expect(calculateARR([{ amount: 100, billingCycle: "monthly" }])).toBe(
      1200
    );
  });

  it("annualizes quarterly subscriptions (×4)", () => {
    expect(calculateARR([{ amount: 300, billingCycle: "quarterly" }])).toBe(
      1200
    );
  });

  it("annualizes yearly subscriptions (×1)", () => {
    expect(calculateARR([{ amount: 5000, billingCycle: "yearly" }])).toBe(
      5000
    );
  });

  it("annualizes annual subscriptions (×1)", () => {
    expect(calculateARR([{ amount: 5000, billingCycle: "annual" }])).toBe(
      5000
    );
  });

  it("annualizes weekly subscriptions (×52)", () => {
    expect(calculateARR([{ amount: 10, billingCycle: "weekly" }])).toBe(520);
  });

  it("sums mixed billing cycles correctly", () => {
    const subs = [
      { amount: 100, billingCycle: "monthly" },
      { amount: 300, billingCycle: "quarterly" },
      { amount: 2000, billingCycle: "yearly" },
      { amount: 10, billingCycle: "weekly" },
    ];
    expect(calculateARR(subs)).toBeCloseTo(1200 + 1200 + 2000 + 520, 0);
  });

  it("defaults missing billing cycle to monthly", () => {
    expect(calculateARR([{ amount: 100, billingCycle: "" }])).toBe(1200);
    expect(calculateARR([{ amount: 100, billingCycle: "unknown" }])).toBe(
      1200
    );
  });

  it("is case-insensitive", () => {
    expect(calculateARR([{ amount: 100, billingCycle: "MONTHLY" }])).toBe(
      1200
    );
    expect(calculateARR([{ amount: 300, billingCycle: "Quarterly" }])).toBe(
      1200
    );
  });
});

describe("calculateGrossMargin", () => {
  it("returns 0 when revenue is 0", () => {
    expect(calculateGrossMargin(0, 5000)).toBe(0);
  });

  it("returns 100 when all revenue is COGS", () => {
    expect(calculateGrossMargin(10000, 10000)).toBe(0);
  });

  it("returns 100 when there is no COGS", () => {
    expect(calculateGrossMargin(10000, 0)).toBe(100);
  });

  it("returns correct gross margin for typical scenario", () => {
    expect(calculateGrossMargin(10000, 3000)).toBe(70);
  });

  it("returns negative gross margin when COGS exceed revenue", () => {
    expect(calculateGrossMargin(10000, 12000)).toBe(-20);
  });
});

describe("calculateNetNewARR", () => {
  it("returns positive growth when ARR increased", () => {
    expect(calculateNetNewARR(120000, 100000)).toBe(20000);
  });

  it("returns negative growth when ARR decreased", () => {
    expect(calculateNetNewARR(80000, 100000)).toBe(-20000);
  });

  it("returns 0 when ARR is flat", () => {
    expect(calculateNetNewARR(100000, 100000)).toBe(0);
  });

  it("returns 0 for first period (undefined previous)", () => {
    expect(calculateNetNewARR(100000, undefined)).toBe(0);
  });

  it("returns 0 for first period (null previous)", () => {
    expect(calculateNetNewARR(100000, null)).toBe(0);
  });
});

describe("calculateBurnMultiple", () => {
  it("returns 0 when monthly burn is 0 (profitable)", () => {
    expect(calculateBurnMultiple(0, 10000)).toBe(0);
  });

  it("returns Infinity when net new ARR is 0", () => {
    expect(calculateBurnMultiple(50000, 0)).toBe(Infinity);
  });

  it("returns Infinity when net new ARR is negative", () => {
    expect(calculateBurnMultiple(50000, -10000)).toBe(Infinity);
  });

  it("returns correct burn multiple for typical scenario", () => {
    expect(calculateBurnMultiple(50000, 25000)).toBe(2);
  });

  it("returns high burn multiple for high burn / low growth", () => {
    expect(calculateBurnMultiple(100000, 10000)).toBe(10);
  });

  it("returns a finite number when netNewARR is positive", () => {
    const result = calculateBurnMultiple(50000, 25000);
    expect(Number.isFinite(result)).toBe(true);
    expect(result).toBe(2);
  });

  it("returns Infinity when netNewARR is zero", () => {
    const result = calculateBurnMultiple(50000, 0);
    expect(result).toBe(Infinity);
  });
});

describe("calculateYoYGrowth", () => {
  it("returns 100 when revenue doubled", () => {
    expect(calculateYoYGrowth(200000, 100000)).toBe(100);
  });

  it("returns -50 when revenue halved", () => {
    expect(calculateYoYGrowth(50000, 100000)).toBe(-50);
  });

  it("returns 0 when revenue is flat", () => {
    expect(calculateYoYGrowth(100000, 100000)).toBe(0);
  });

  it("returns 0 for first period (undefined previous)", () => {
    expect(calculateYoYGrowth(100000, undefined)).toBe(0);
  });

  it("returns 0 when previous is 0", () => {
    expect(calculateYoYGrowth(100000, 0)).toBe(0);
  });
});

describe("calculateRuleOf40", () => {
  it("returns above 40 for healthy company", () => {
    expect(calculateRuleOf40(60, 20)).toBe(80);
  });

  it("returns below 40 for struggling company", () => {
    expect(calculateRuleOf40(10, 5)).toBe(15);
  });

  it("returns negative for negative growth + negative margin", () => {
    expect(calculateRuleOf40(-20, -10)).toBe(-30);
  });

  it("returns exactly 40", () => {
    expect(calculateRuleOf40(30, 10)).toBe(40);
    expect(calculateRuleOf40(50, -10)).toBe(40);
  });

  it("works with zero growth", () => {
    expect(calculateRuleOf40(0, 30)).toBe(30);
  });

  it("works with zero margin", () => {
    expect(calculateRuleOf40(40, 0)).toBe(40);
  });
});

describe("sumCOGS", () => {
  it("returns 0 for empty array", () => {
    expect(sumCOGS([])).toBe(0);
  });

  it("sums only COGS transactions", () => {
    const txs = [
      { type: "expense", category: "Shipping and Fulfilment", amount: 100 },
      { type: "expense", category: "Software", amount: 200 },
      { type: "expense", category: "Materials", amount: 300 },
    ] as const;
    expect(sumCOGS(txs as unknown as { type: string; category?: string; tags?: string[]; amount: number }[])).toBe(400);
  });

  it("excludes transfers even if tagged as COGS", () => {
    const txs = [
      { type: "expense", category: "Transfers", tags: ["Shipping"], amount: 100 },
      { type: "expense", category: "Shipping and Fulfilment", amount: 200 },
    ];
    expect(sumCOGS(txs)).toBe(200);
  });
});
