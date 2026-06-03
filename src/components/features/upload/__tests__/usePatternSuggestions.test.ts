import { describe, expect, it } from "vitest";
import type { PreviewRow } from "@/lib/upload/wizard-types";
import { buildPatternSuggestions } from "../usePatternSuggestions";

function row(partial: Partial<PreviewRow>): PreviewRow {
  return {
    rowNumber: 1,
    date: "2026-01-01",
    merchant: "Unknown",
    description: "Payment",
    amount: 100,
    type: "income",
    currency: "GBP",
    category: "Revenue",
    confidenceScore: 90,
    status: "categorised",
    issues: [],
    rawData: {},
    categoryEvidence: [],
    ...partial,
  };
}

describe("upload preview pattern suggestions", () => {
  it("does not surface broad revenue suggestions for personal-name counterparties", () => {
    const rows = Array.from({ length: 6 }, (_, index) =>
      row({
        rowNumber: index + 1,
        merchant: "Catherine Bull",
        description: "Payment",
        reference: `PAY-${index + 1}`,
        amount: 100 + index,
        type: "income",
        category: "Revenue",
      })
    );

    const suggestions = buildPatternSuggestions(rows);
    const personalSuggestion = suggestions.find((suggestion) =>
      suggestion.matchType === "merchant" &&
      suggestion.matchValue === "Catherine Bull" &&
      suggestion.suggestedCategory === "Revenue"
    );

    expect(personalSuggestion).toBeUndefined();
  });

  it("still auto-applies high-confidence processor suggestions", () => {
    const rows = Array.from({ length: 6 }, (_, index) =>
      row({
        rowNumber: index + 1,
        merchant: "Stripe Payments UK LTD",
        description: "Money added from STRIPE PAYMENTS UK LTD",
        reference: "STRIPE",
        amount: 500 + index,
        type: "income",
        category: "Revenue",
      })
    );

    const suggestions = buildPatternSuggestions(rows);
    const stripeSuggestion = suggestions.find((suggestion) =>
      suggestion.suggestedCategory === "Revenue" &&
      suggestion.matchValue === "Stripe Payments UK LTD"
    );

    expect(stripeSuggestion).toBeDefined();
    expect(stripeSuggestion!.suggestedCategory).toBe("Revenue");
    expect(stripeSuggestion!.status).toBe("applied");
  });

  it("uses commission reference semantics instead of noisy revenue grouping", () => {
    const rows = Array.from({ length: 6 }, (_, index) =>
      row({
        rowNumber: index + 1,
        merchant: `Sales Person ${index + 1}`,
        description: "Payment",
        reference: "Sales Rep Commision Fee",
        amount: 50,
        type: "expense",
        category: "Revenue",
        rawData: { Reference: "Sales Rep Commision Fee" },
      })
    );

    const suggestions = buildPatternSuggestions(rows);
    const commissionSuggestion = suggestions.find((suggestion) =>
      suggestion.matchType === "reference" &&
      suggestion.matchValue === "SALES REP COMMISION FEE"
    );

    expect(commissionSuggestion).toBeDefined();
    expect(commissionSuggestion!.suggestedCategory).toBe("Sales Commission");
    expect(commissionSuggestion!.suggestedCategory).not.toBe("Revenue");
    expect(commissionSuggestion!.reason).toContain("Commission reference");
  });

  it("does not suggest Revenue for outgoing marketing commission references", () => {
    const rows = Array.from({ length: 4 }, (_, index) =>
      row({
        rowNumber: index + 1,
        merchant: `Partner ${index + 1}`,
        description: "Payment",
        reference: "Marketing Commission Payout",
        amount: 25,
        type: "expense",
        category: "Revenue",
        rawData: { Reference: "Marketing Commission Payout" },
      })
    );

    const suggestions = buildPatternSuggestions(rows);
    const marketingCommission = suggestions.find((suggestion) =>
      suggestion.matchType === "reference" &&
      suggestion.matchValue === "MARKETING COMMISSION PAYOUT"
    );

    expect(marketingCommission).toBeDefined();
    expect(marketingCommission!.suggestedCategory).toBe("Sales Commission");
    expect(marketingCommission!.suggestedCategory).not.toBe("Revenue");
  });

  it("treats Internal Transfer as a known transfer identity, not a personal name", () => {
    const rows = Array.from({ length: 6 }, (_, index) =>
      row({
        rowNumber: index + 1,
        merchant: "Internal Transfer",
        description: "From British Pound",
        reference: "",
        amount: 50,
        type: "income",
        category: "Internal Transfer",
        kpiTreatment: "excluded",
      })
    );

    const suggestions = buildPatternSuggestions(rows);
    const internalTransfer = suggestions.find((suggestion) =>
      suggestion.matchType === "merchant" &&
      suggestion.matchValue === "Internal Transfer"
    );

    expect(internalTransfer).toBeDefined();
    expect(internalTransfer!.suggestedCategory).toBe("Internal Transfer");
    expect(internalTransfer!.status).toBe("applied");
    expect(internalTransfer!.reason).not.toContain("personal-name");
  });
});
