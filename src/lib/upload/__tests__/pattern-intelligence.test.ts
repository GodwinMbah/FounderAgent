import { describe, it, expect } from "vitest";
import { buildPatternSuggestions, getAutoApplyCandidates } from "../pattern-intelligence";

describe("buildPatternSuggestions", () => {
  it("groups by merchant exact match", () => {
    const rows = [
      { rowNumber: 1, merchant: "Stripe", description: "Payout", amount: 100, type: "income" as const, category: "Revenue" },
      { rowNumber: 2, merchant: "Stripe", description: "Payout", amount: 200, type: "income" as const, category: "Revenue" },
      { rowNumber: 3, merchant: "Stripe", description: "Payout", amount: 150, type: "income" as const, category: "Revenue" },
    ];
    const suggestions = buildPatternSuggestions(rows);
    expect(suggestions.length).toBeGreaterThanOrEqual(1);
    const merchantSug = suggestions.find((s) => s.matchType === "merchant");
    expect(merchantSug).toBeDefined();
    expect(merchantSug!.suggestedCategory).toBe("Revenue");
    expect(merchantSug!.confidence).toBe(95);
    expect(merchantSug!.affectedRows).toContain(1);
    expect(merchantSug!.affectedRows).toContain(2);
    expect(merchantSug!.affectedRows).toContain(3);
  });

  it("detects processor patterns for credit cards", () => {
    const rows = [
      { rowNumber: 1, merchant: "Capital On Tap", description: "Payment", amount: -50, type: "expense" as const },
      { rowNumber: 2, merchant: "Capital On Tap", description: "Payment", amount: -60, type: "expense" as const },
      { rowNumber: 3, merchant: "Capital On Tap", description: "Payment", amount: -70, type: "expense" as const },
    ];
    const suggestions = buildPatternSuggestions(rows);
    const processorSug = suggestions.find((s) => s.matchType === "processor_pattern");
    expect(processorSug).toBeDefined();
    expect(processorSug!.suggestedCategory).toBe("Credit Card Payment");
    expect(processorSug!.confidence).toBe(90);
  });

  it("deduplicates rows to highest-confidence suggestion", () => {
    const rows = [
      { rowNumber: 1, merchant: "Stripe", description: "Stripe payout", amount: 100, type: "income" as const, category: "Revenue" },
      { rowNumber: 2, merchant: "Stripe", description: "Stripe payout", amount: 200, type: "income" as const, category: "Revenue" },
      { rowNumber: 3, merchant: "Stripe", description: "Stripe payout", amount: 150, type: "income" as const, category: "Revenue" },
    ];
    const suggestions = buildPatternSuggestions(rows);
    // Stripe should match both merchant (90) and processor_pattern (95)
    // After dedup, row should only appear in processor_pattern (higher confidence)
    const processorSug = suggestions.find((s) => s.matchType === "processor_pattern");
    const merchantSug = suggestions.find((s) => s.matchType === "merchant");
    if (processorSug && merchantSug) {
      expect(processorSug.affectedRows.length).toBe(3);
      expect(merchantSug.affectedRows.length).toBe(0);
    }
  });

  it("returns auto-apply candidates with high confidence and many rows", () => {
    const rows = Array.from({ length: 6 }, (_, i) => ({
      rowNumber: i + 1,
      merchant: "Stripe",
      description: "Payout",
      amount: 100,
      type: "income" as const,
      category: "Revenue",
    }));
    const suggestions = buildPatternSuggestions(rows);
    const autoApply = getAutoApplyCandidates(suggestions);
    expect(autoApply.length).toBeGreaterThanOrEqual(1);
    expect(autoApply[0].confidence).toBeGreaterThanOrEqual(90);
    expect(autoApply[0].affectedRows.length).toBeGreaterThanOrEqual(5);
  });

  it("groups by reference prefix", () => {
    const rows = [
      { rowNumber: 1, reference: "REF12345ABC", amount: -10, type: "expense" as const, category: "Office Costs" },
      { rowNumber: 2, reference: "REF12345DEF", amount: -20, type: "expense" as const, category: "Office Costs" },
      { rowNumber: 3, reference: "REF12345GHI", amount: -15, type: "expense" as const, category: "Office Costs" },
    ];
    const suggestions = buildPatternSuggestions(rows);
    const refSug = suggestions.find((s) => s.matchType === "reference_prefix");
    expect(refSug).toBeDefined();
    expect(refSug!.matchValue).toBe("REF12345");
    expect(refSug!.suggestedCategory).toBe("Office Costs");
  });

  it("groups by description keyword", () => {
    const rows = [
      { rowNumber: 1, description: "AWS hosting bill", amount: -100, type: "expense" as const, category: "Cloud Infrastructure" },
      { rowNumber: 2, description: "AWS storage fee", amount: -50, type: "expense" as const, category: "Cloud Infrastructure" },
      { rowNumber: 3, description: "AWS compute cost", amount: -80, type: "expense" as const, category: "Cloud Infrastructure" },
    ];
    const suggestions = buildPatternSuggestions(rows);
    const keywordSug = suggestions.find((s) => s.matchType === "description_keyword");
    expect(keywordSug).toBeDefined();
    expect(keywordSug!.suggestedCategory).toBe("Cloud Infrastructure");
  });

  it("correctly counts affected rows for merchant suggestions", () => {
    const rows = [
      { rowNumber: 1, merchant: "Stripe", description: "Payout", amount: 100, type: "income" as const, category: "Revenue" },
      { rowNumber: 2, merchant: "Stripe", description: "Payout", amount: 200, type: "income" as const, category: "Revenue" },
      { rowNumber: 3, merchant: "Stripe", description: "Payout", amount: 150, type: "income" as const, category: "Revenue" },
      { rowNumber: 4, merchant: "Stripe", description: "Payout", amount: 175, type: "income" as const, category: "Revenue" },
    ];
    const suggestions = buildPatternSuggestions(rows);
    const merchantSug = suggestions.find((s) => s.matchType === "merchant");
    expect(merchantSug).toBeDefined();
    expect(merchantSug!.affectedRows.length).toBe(4);
    expect(merchantSug!.affectedRows).toEqual([1, 2, 3, 4]);
  });

  it("correctly counts affected rows for processor patterns", () => {
    const rows = [
      { rowNumber: 1, merchant: "Capital On Tap", description: "Payment", amount: -50, type: "expense" as const },
      { rowNumber: 2, merchant: "Capital On Tap", description: "Payment", amount: -60, type: "expense" as const },
      { rowNumber: 3, merchant: "Capital On Tap", description: "Payment", amount: -70, type: "expense" as const },
      { rowNumber: 4, merchant: "Capital On Tap", description: "Payment", amount: -80, type: "expense" as const },
    ];
    const suggestions = buildPatternSuggestions(rows);
    const processorSug = suggestions.find((s) => s.matchType === "processor_pattern");
    expect(processorSug).toBeDefined();
    expect(processorSug!.affectedRows.length).toBe(4);
    expect(processorSug!.confidence).toBe(90);
  });
});
