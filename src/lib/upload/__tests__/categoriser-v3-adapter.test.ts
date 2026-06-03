import { describe, it, expect, vi } from "vitest";
import {
  categoriseWithV3,
  categoriseWithV3AndV1Fallback,
} from "../categoriser-v3-adapter";
import { suggestTransactionCategory } from "@/lib/categorisation";
import type { NormalisedRow } from "@/lib/providers/canonical-adapter";
import type { CompanySettings } from "@/lib/db/company_settings";

vi.mock("@/lib/categorisation", () => ({
  suggestTransactionCategory: vi.fn((_tx) => ({
    transactionId: "temp-fallback",
    suggestedCategory: "V1 Fallback Category",
    confidenceScore: 80,
    reason: "v1 fallback reason",
    status: "AI Suggested",
    recommendedAction: "review",
  })),
}));

function makeRow(overrides?: Partial<NormalisedRow>): NormalisedRow {
  return {
    rowNumber: 1,
    date: "2024-01-15",
    merchant: "Test Merchant",
    description: "Test Description",
    amount: 100,
    type: "expense",
    status: "needs_review",
    confidenceScore: 0,
    rawData: {},
    parseErrors: [],
    ...overrides,
  };
}

function makeSettings(overrides?: Partial<CompanySettings>): CompanySettings {
  return {
    id: "settings-1",
    companyId: "company-1",
    businessModel: "saas",
    revenueModels: [],
    costStructure: [],
    categoryRules: [],
    topRevenueChannels: [],
    paymentTools: [],
    toolsUsed: [],
    agentFocus: [],
    weeklyDigestEnabled: false,
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

describe("categoriseWithV3", () => {
  it("uses business model context to boost relevant categories", () => {
    const rows = [
      makeRow({ description: "AWS monthly bill", amount: 250 }),
      makeRow({ description: "OpenAI API usage", amount: 120 }),
    ];
    const settings = makeSettings({ businessModel: "saas" });
    const results = categoriseWithV3(rows, settings);

    expect(results[0].category).toBe("Cloud Infrastructure");
    expect(results[0].confidenceScore).toBeGreaterThanOrEqual(95);
    expect(results[0].status).toBe("categorised");

    expect(results[1].category).toBe("AI Tools");
    expect(results[1].confidenceScore).toBeGreaterThanOrEqual(95);
    expect(results[1].status).toBe("categorised");
  });

  it("applies user rules from company settings", () => {
    const rows = [makeRow({ description: "random saas tool", amount: 50 })];
    const settings = makeSettings({
      businessModel: "saas",
      categoryRules: [
        {
          merchantPattern: "saas",
          category: "Custom SaaS",
          confidenceBoost: 20,
          createdAt: new Date().toISOString(),
        },
      ],
    });
    const results = categoriseWithV3(rows, settings);

    expect(results[0].category).toBe("Custom SaaS");
    expect(results[0].confidenceScore).toBe(95); // 80 + 15 (getUserRulesForCategoriser hardcodes 15)
    expect(results[0].categoryReason).toContain("user rule");
  });

  it("returns categorised status for high confidence rows", () => {
    const rows = [makeRow({ description: "Stripe payout", amount: 500, type: "income" })];
    const results = categoriseWithV3(rows, null);

    expect(results[0].category).toBe("Revenue");
    expect(results[0].confidenceScore).toBeGreaterThanOrEqual(90);
    expect(results[0].status).toBe("categorised");
  });

  it("returns ai_suggested status for medium confidence rows", () => {
    const rows = [makeRow({ description: "software subscription", amount: 50 })];
    const results = categoriseWithV3(rows, null);

    expect(results[0].confidenceScore).toBeGreaterThanOrEqual(75);
    expect(results[0].confidenceScore).toBeLessThan(90);
    expect(results[0].status).toBe("ai_suggested");
  });

  it("returns needs_review for unknown descriptions", () => {
    const rows = [makeRow({ description: "Some random cafe", amount: 5 })];
    const results = categoriseWithV3(rows, null);

    expect(results[0].category).toBe("Uncategorised Review");
    expect(results[0].confidenceScore).toBeLessThan(75);
    expect(results[0].status).toBe("needs_review");
  });

  it("passes reference field through to v3", () => {
    const rows = [
      makeRow({
        description: "Payment",
        reference: "REF-12345",
        amount: 200,
      }),
    ];
    const results = categoriseWithV3(rows, null);

    // Reference should be preserved in the output row
    expect(results[0].reference).toBe("REF-12345");
  });

  it("passes reference from metadata when top-level reference is absent", () => {
    const rows = [
      makeRow({
        description: "Payment",
        reference: undefined,
        metadata: { reference: "META-REF-67890" },
        amount: 200,
      }),
    ];
    const results = categoriseWithV3(rows, null);

    // The adapter should pull reference from metadata for v3 input
    // Row reference remains undefined but metadata is intact
    expect(results[0].reference).toBeUndefined();
    expect(results[0].metadata).toEqual({ reference: "META-REF-67890" });
  });

  it("returns explainable merchant and KPI fields", () => {
    const rows = [
      makeRow({
        merchant: "Klarna*Amazon",
        description: "Klarna Amazon marketplace",
        amount: 48.2,
        type: "expense",
      }),
    ];
    const results = categoriseWithV3(rows, null);

    expect(results[0].merchant).toBe("Amazon");
    expect(results[0].normalisedMerchant).toBe("Amazon");
    expect(results[0].category).toBe("Office Costs");
    expect(results[0].categoryReason).toContain("Office Costs");
    expect(results[0].categoryConfidence).toBeGreaterThan(0);
    expect(results[0].groupingConfidence).toBe(0);
    expect(results[0].kpiTreatment).toBe("included");
    expect(results[0].categoryEvidence.length).toBeGreaterThan(0);
  });
});

describe("categoriseWithV3AndV1Fallback", () => {
  it("does not call v1 fallback for high confidence rows", () => {
    const mock = vi.mocked(suggestTransactionCategory);
    mock.mockClear();

    const rows = [makeRow({ description: "Stripe payout", amount: 500, type: "income" })];
    const results = categoriseWithV3AndV1Fallback(rows, null);

    expect(results[0].category).toBe("Revenue");
    expect(results[0].confidenceScore).toBeGreaterThanOrEqual(75);
    expect(mock).not.toHaveBeenCalled();
  });

  it("calls v1 fallback for low confidence rows", () => {
    const mock = vi.mocked(suggestTransactionCategory);
    mock.mockClear();

    const rows = [makeRow({ description: "Some random cafe", amount: 5 })];
    const results = categoriseWithV3AndV1Fallback(rows, null);

    expect(mock).toHaveBeenCalledTimes(1);
    expect(results[0].category).toBe("V1 Fallback Category");
    expect(results[0].confidenceScore).toBe(80);
    expect(results[0].status).toBe("ai_suggested");
    expect(results[0].categoryReason).toBe("v1 fallback reason");
  });

  it("does not let v1 fallback erase a useful lower-confidence v3 category", () => {
    const mock = vi.mocked(suggestTransactionCategory);
    mock.mockClear();

    const rows = [makeRow({ merchant: "Ades Ltd Charlton", description: "Ades Ltd Charlton", amount: 40.47 })];
    const results = categoriseWithV3AndV1Fallback(rows, null);

    expect(mock).not.toHaveBeenCalled();
    expect(results[0].category).toBe("Food and Meals");
    expect(results[0].confidenceScore).toBeGreaterThanOrEqual(60);
  });

  it("falls back to needs_review when v1 also returns low confidence", () => {
    const mock = vi.mocked(suggestTransactionCategory);
    mock.mockReturnValueOnce({
      transactionId: "temp-fallback",
      suggestedCategory: "Uncategorised Review",
      confidenceScore: 0,
      reason: "No matching patterns found",
      status: "Needs Review",
      recommendedAction: "flag",
    });

    const rows = [makeRow({ description: "xyz abc unknown", amount: 1 })];
    const results = categoriseWithV3AndV1Fallback(rows, null);

    expect(results[0].category).toBe("Uncategorised Review");
    expect(results[0].confidenceScore).toBe(0);
    expect(results[0].status).toBe("needs_review");
  });
});
