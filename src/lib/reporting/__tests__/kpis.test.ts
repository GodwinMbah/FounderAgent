import { describe, it, expect } from "vitest";
import {
  calculateChangePercent,
  profitMargin,
  monthlyBurn,
  runwayMonths,
} from "@/lib/reporting/kpis";
import { toMonthly, normalizeSubscriptionSpend } from "@/lib/reporting/subscriptions";

describe("monthlyBurn", () => {
  it("returns 0 when revenue is greater than expenses (profitable)", () => {
    expect(monthlyBurn(10000, 5000)).toBe(0);
  });

  it("returns 0 when revenue equals expenses (break-even)", () => {
    expect(monthlyBurn(5000, 5000)).toBe(0);
  });

  it("returns positive burn when expenses exceed revenue", () => {
    expect(monthlyBurn(5000, 10000)).toBe(5000);
  });

  it("never returns negative", () => {
    expect(monthlyBurn(100000, 1000)).toBe(0);
  });
});

describe("runwayMonths", () => {
  it("returns cash balance divided by monthly burn", () => {
    expect(runwayMonths(120000, 10000)).toBe(12);
  });

  it("returns Infinity when burn is zero (profitable)", () => {
    expect(runwayMonths(50000, 0)).toBe(Infinity);
  });

  it("handles fractional months correctly", () => {
    expect(runwayMonths(50000, 15000)).toBeCloseTo(3.333, 3);
  });

  it("returns 0 when cash balance is 0", () => {
    expect(runwayMonths(0, 10000)).toBe(0);
  });
});

describe("profitMargin", () => {
  it("returns correct percentage for profitable scenario", () => {
    expect(profitMargin(10000, 6000)).toBe(40);
  });

  it("returns 0 when revenue is 0", () => {
    expect(profitMargin(0, 5000)).toBe(0);
  });

  it("returns negative percentage when expenses exceed revenue", () => {
    expect(profitMargin(10000, 12000)).toBe(-20);
  });

  it("returns 100 when expenses are 0", () => {
    expect(profitMargin(10000, 0)).toBe(100);
  });
});

describe("calculateChangePercent", () => {
  it("returns correct positive change", () => {
    const result = calculateChangePercent(110, 100);
    expect(result.text).toBe("+10.0%");
    expect(result.type).toBe("positive");
  });

  it("returns correct negative change", () => {
    const result = calculateChangePercent(90, 100);
    expect(result.text).toBe("-10.0%");
    expect(result.type).toBe("negative");
  });

  it("returns neutral when previous is 0", () => {
    const result = calculateChangePercent(100, 0);
    expect(result.text).toBe("—");
    expect(result.type).toBe("neutral");
  });

  it("returns neutral when current is undefined", () => {
    const result = calculateChangePercent(undefined, 100);
    expect(result.text).toBe("—");
    expect(result.type).toBe("neutral");
  });

  it("respects invert flag for expenses (decrease is positive)", () => {
    const result = calculateChangePercent(80, 100, true);
    expect(result.text).toBe("-20.0%");
    expect(result.type).toBe("positive");
  });
});

describe("toMonthly", () => {
  it("divides yearly amount by 12", () => {
    expect(toMonthly({ amount: 1200, billingCycle: "yearly" })).toBe(100);
  });

  it("divides annual amount by 12", () => {
    expect(toMonthly({ amount: 1200, billingCycle: "annual" })).toBe(100);
  });

  it("divides quarterly amount by 3", () => {
    expect(toMonthly({ amount: 300, billingCycle: "quarterly" })).toBe(100);
  });

  it("leaves monthly amount unchanged", () => {
    expect(toMonthly({ amount: 100, billingCycle: "monthly" })).toBe(100);
  });

  it("defaults to monthly when billing cycle is missing", () => {
    expect(toMonthly({ amount: 100 })).toBe(100);
  });

  it("is case-insensitive", () => {
    expect(toMonthly({ amount: 1200, billingCycle: "YEARLY" })).toBe(100);
    expect(toMonthly({ amount: 300, billingCycle: "Quarterly" })).toBe(100);
  });
});

describe("normalizeSubscriptionSpend", () => {
  it("sums mixed billing cycles correctly", () => {
    const subs = [
      { amount: 100, billingCycle: "monthly" },
      { amount: 300, billingCycle: "quarterly" },
      { amount: 1200, billingCycle: "yearly" },
    ];
    expect(normalizeSubscriptionSpend(subs)).toBe(300);
  });

  it("returns 0 for empty array", () => {
    expect(normalizeSubscriptionSpend([])).toBe(0);
  });

  it("handles single subscription", () => {
    expect(normalizeSubscriptionSpend([{ amount: 500, billingCycle: "monthly" }])).toBe(500);
  });
});
