import { describe, expect, it } from "vitest";
import type { CategorisedRow } from "../categoriser";
import { detectRecurringGroups } from "../subscription-detector";

function row(
  rowNumber: number,
  date: string,
  merchant: string,
  category: string,
  amount: number,
  type: "income" | "expense" = "expense",
  description = merchant
): CategorisedRow {
  return {
    rowNumber,
    date,
    merchant,
    description,
    amount,
    type,
    currency: "GBP",
    category,
    status: "categorised",
    confidenceScore: 90,
    categoryReason: "test",
    rawData: {},
    parseErrors: [],
  };
}

describe("detectRecurringGroups", () => {
  it("classifies recurring software separately from generic subscriptions", () => {
    const groups = detectRecurringGroups([
      row(2, "2026-01-01", "Notion", "Software", 12),
      row(3, "2026-02-01", "Notion", "Software", 12),
      row(4, "2026-03-01", "Notion", "Software", 12),
    ]);

    expect(groups).toHaveLength(1);
    expect(groups[0]).toMatchObject({
      vendor: "Notion",
      recurrenceType: "software_subscription",
      billingCycle: "monthly",
      transactionCount: 3,
    });
  });

  it("does not treat recurring contractor payments as subscriptions", () => {
    const groups = detectRecurringGroups([
      row(2, "2026-01-05", "Jane Contractor", "Contractors", 900, "expense", "Monthly contractor payment"),
      row(3, "2026-02-05", "Jane Contractor", "Contractors", 900, "expense", "Monthly contractor payment"),
      row(4, "2026-03-05", "Jane Contractor", "Contractors", 900, "expense", "Monthly contractor payment"),
    ]);

    expect(groups[0]).toMatchObject({
      recurrenceType: "recurring_contractor",
      category: "Contractors",
      billingCycle: "monthly",
    });
  });

  it("separates recurring income from subscription spend", () => {
    const groups = detectRecurringGroups([
      row(2, "2026-01-10", "Acme Client", "Revenue", 2500, "income", "Monthly retainer"),
      row(3, "2026-02-10", "Acme Client", "Revenue", 2500, "income", "Monthly retainer"),
      row(4, "2026-03-10", "Acme Client", "Revenue", 2500, "income", "Monthly retainer"),
    ]);

    expect(groups[0]).toMatchObject({
      recurrenceType: "recurring_income",
      category: "Revenue",
      billingCycle: "monthly",
    });
  });

  it("keeps credit-card repayment recurrence excluded from subscription spend", () => {
    const groups = detectRecurringGroups([
      row(2, "2026-01-15", "Capital On Tap", "Credit Card Payment", 1500, "expense", "Capital On Tap payment"),
      row(3, "2026-02-15", "Capital On Tap", "Credit Card Payment", 1510, "expense", "Capital On Tap payment"),
      row(4, "2026-03-15", "Capital On Tap", "Credit Card Payment", 1490, "expense", "Capital On Tap payment"),
    ]);

    expect(groups[0]).toMatchObject({
      recurrenceType: "credit_card_repayment",
      category: "Credit Card Payment",
    });
  });
});
