import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  buildMerchantPattern,
  buildRuleSignals,
  applyCategoryCorrection,
  recordCategoryCorrection,
  getUserRulesForCategoriser,
  type CorrectionInput,
} from "../user-corrections";
import type { CompanySettings } from "@/lib/db/company_settings";

const mockGetCompanySettings = vi.fn();
const mockUpdateCompanySettings = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
});

vi.mock("@/lib/db/company_settings", async () => {
  const actual = await vi.importActual<typeof import("@/lib/db/company_settings")>(
    "@/lib/db/company_settings"
  );
  return {
    ...actual,
    getCompanySettings: (...args: Parameters<typeof mockGetCompanySettings>) =>
      mockGetCompanySettings(...args),
    updateCompanySettings: (...args: Parameters<typeof mockUpdateCompanySettings>) =>
      mockUpdateCompanySettings(...args),
  };
});

function makeSettings(
  overrides?: Partial<CompanySettings>
): CompanySettings {
  return {
    id: "settings-1",
    companyId: "company-1",
    topRevenueChannels: [],
    paymentTools: [],
    toolsUsed: [],
    agentFocus: [],
    weeklyDigestEnabled: true,
    createdAt: new Date().toISOString(),
    categoryRules: [],
    ...overrides,
  };
}

describe("buildMerchantPattern", () => {
  it("uses merchant when available", () => {
    const result = buildMerchantPattern({
      description: "Some random cafe",
      merchant: "Starbucks",
      reference: null,
    });
    expect(result).toBe("starbucks");
  });

  it("falls back to reference when merchant is missing", () => {
    const result = buildMerchantPattern({
      description: "Some random cafe",
      merchant: null,
      reference: "REF-12345",
    });
    expect(result).toBe("ref-12345");
  });

  it("falls back to description when merchant and reference are missing", () => {
    const result = buildMerchantPattern({
      description: "Coffee Shop London",
      merchant: null,
      reference: null,
    });
    expect(result).toBe("coffee shop");
  });

  it("extracts first 2 alphanumeric words from description", () => {
    const result = buildMerchantPattern({
      description: "AWS  monthly --- BILL!!!",
      merchant: "",
      reference: undefined,
    });
    expect(result).toBe("aws monthly");
  });
});

describe("applyCategoryCorrection", () => {
  it("appends a new rule to existing rules", () => {
    const settings = makeSettings({
      categoryRules: [
        { merchantPattern: "stripe", category: "Revenue", confidenceBoost: 15, createdAt: "2024-01-01" },
      ],
    });

    const correction: CorrectionInput = {
      description: "Coffee Shop London",
      merchant: "Starbucks",
      previousCategory: "Unknown",
      newCategory: "Food & Drink",
    };

    const result = applyCategoryCorrection(settings, correction);
    expect(result.categoryRules).toHaveLength(2);
    expect(result.categoryRules[1].merchantPattern).toBe("starbucks");
    expect(result.categoryRules[1].category).toBe("Food & Drink");
    expect(result.categoryRules[1].confidenceBoost).toBe(15);
  });

  it("updates existing rule with same pattern to new category", () => {
    const settings = makeSettings({
      categoryRules: [
        { merchantPattern: "starbucks", category: "Unknown", confidenceBoost: 10, createdAt: "2024-01-01" },
      ],
    });

    const correction: CorrectionInput = {
      description: "Coffee Shop London",
      merchant: "Starbucks",
      previousCategory: "Unknown",
      newCategory: "Food & Drink",
    };

    const result = applyCategoryCorrection(settings, correction);
    expect(result.categoryRules).toHaveLength(1);
    expect(result.categoryRules[0].category).toBe("Food & Drink");
    expect(result.categoryRules[0].confidenceBoost).toBe(15);
  });
});

describe("recordCategoryCorrection", () => {
  it("appends to existing rules and returns updated settings", async () => {
    const existingSettings = makeSettings({
      categoryRules: [
        { merchantPattern: "stripe", category: "Revenue", confidenceBoost: 15, createdAt: "2024-01-01" },
      ],
    });
    const updatedSettings = makeSettings({
      categoryRules: [
        { merchantPattern: "stripe", category: "Revenue", confidenceBoost: 15, createdAt: "2024-01-01" },
        { merchantPattern: "starbucks", category: "Food & Drink", confidenceBoost: 15, createdAt: expect.any(String) as unknown as string },
      ],
    });

    mockGetCompanySettings.mockResolvedValue(existingSettings);
    mockUpdateCompanySettings.mockResolvedValue(updatedSettings);

    const correction: CorrectionInput = {
      description: "Coffee Shop London",
      merchant: "Starbucks",
      previousCategory: "Unknown",
      newCategory: "Food & Drink",
    };

    const result = await recordCategoryCorrection("company-1", correction);

    expect(mockGetCompanySettings).toHaveBeenCalledWith("company-1");
    expect(mockUpdateCompanySettings).toHaveBeenCalledWith(
      "company-1",
      expect.objectContaining({
        categoryRules: expect.arrayContaining([
          expect.objectContaining({
            merchantPattern: "stripe",
            category: "Revenue",
            confidenceBoost: 15,
            createdAt: "2024-01-01",
          }),
          expect.objectContaining({
            merchantPattern: "starbucks",
            category: "Food & Drink",
            confidenceBoost: 15,
            createdAt: expect.any(String),
            id: expect.any(String),
          }),
        ]),
      })
    );
    expect(result).toEqual(updatedSettings);
  });

  it("returns null when settings are not found", async () => {
    mockGetCompanySettings.mockResolvedValue(null);

    const correction: CorrectionInput = {
      description: "Coffee Shop London",
      merchant: "Starbucks",
      previousCategory: "Unknown",
      newCategory: "Food & Drink",
    };

    const result = await recordCategoryCorrection("company-1", correction);
    expect(result).toBeNull();
    expect(mockUpdateCompanySettings).not.toHaveBeenCalled();
  });
});

describe("buildRuleSignals", () => {
  it("extracts merchant pattern when merchant is present", () => {
    const result = buildRuleSignals({
      description: "Some random cafe",
      merchant: "Starbucks",
      reference: null,
    });
    expect(result.merchantPattern).toBe("starbucks");
    expect(result.descriptionPattern).toBeUndefined();
  });

  it("extracts reference pattern when reference is specific and merchant missing", () => {
    const result = buildRuleSignals({
      description: "Some random cafe",
      merchant: null,
      reference: "REF-12345",
    });
    expect(result.referencePattern).toBe("ref-12345");
    expect(result.merchantPattern).toBeUndefined();
  });

  it("falls back to description when merchant and reference are generic", () => {
    const result = buildRuleSignals({
      description: "Coffee Shop London",
      merchant: null,
      reference: "123",
    });
    expect(result.descriptionPattern).toBe("coffee shop");
    expect(result.referencePattern).toBeUndefined();
  });

  it("stores direction when type is provided", () => {
    const result = buildRuleSignals({
      description: "Payment",
      type: "income",
    });
    expect(result.direction).toBe("income");
  });

  it("stores provider when provided", () => {
    const result = buildRuleSignals({
      description: "Payment",
      provider: "Stripe",
    });
    expect(result.provider).toBe("stripe");
  });
});

describe("applyCategoryCorrection with enhanced rules", () => {
  it("stores multiple signals in a new rule", () => {
    const settings = makeSettings({ categoryRules: [] });
    const correction: CorrectionInput = {
      description: "Coffee Shop London",
      merchant: "Starbucks",
      reference: "SBUX-99",
      previousCategory: "Unknown",
      newCategory: "Food & Drink",
      type: "expense",
    };

    const result = applyCategoryCorrection(settings, correction);
    expect(result.categoryRules).toHaveLength(1);
    expect(result.categoryRules[0].merchantPattern).toBe("starbucks");
    expect(result.categoryRules[0].referencePattern).toBe("sbux-99");
    expect(result.categoryRules[0].direction).toBe("expense");
    expect(result.categoryRules[0].category).toBe("Food & Drink");
  });

  it("matches existing rule on reference pattern", () => {
    const settings = makeSettings({
      categoryRules: [
        {
          id: "rule-1",
          referencePattern: "sbux-99",
          category: "Unknown",
          confidenceBoost: 10,
          createdAt: "2024-01-01",
        },
      ],
    });

    const correction: CorrectionInput = {
      description: "Coffee Shop London",
      merchant: null,
      reference: "SBUX-99",
      previousCategory: "Unknown",
      newCategory: "Food & Drink",
    };

    const result = applyCategoryCorrection(settings, correction);
    expect(result.categoryRules).toHaveLength(1);
    expect(result.categoryRules[0].category).toBe("Food & Drink");
  });
});

describe("getUserRulesForCategoriser", () => {
  it("maps categoryRules with confidenceBoost 15", () => {
    const settings = makeSettings({
      categoryRules: [
        { merchantPattern: "stripe", category: "Revenue", confidenceBoost: 10, createdAt: "2024-01-01" },
        { merchantPattern: "aws", category: "Cloud", confidenceBoost: 5, createdAt: "2024-01-02" },
      ],
    });

    const result = getUserRulesForCategoriser(settings);
    expect(result).toEqual([
      { merchantPattern: "stripe", category: "Revenue", confidenceBoost: 15 },
      { merchantPattern: "aws", category: "Cloud", confidenceBoost: 15 },
    ]);
  });

  it("returns empty array for null settings", () => {
    expect(getUserRulesForCategoriser(null)).toEqual([]);
  });

  it("returns empty array when categoryRules is undefined", () => {
    const settings = makeSettings({ categoryRules: undefined });
    expect(getUserRulesForCategoriser(settings)).toEqual([]);
  });

  it("returns all signals including direction and provider", () => {
    const settings = makeSettings({
      categoryRules: [
        {
          merchantPattern: "stripe",
          descriptionPattern: "stripe payout",
          referencePattern: "str-123",
          provider: "stripe",
          direction: "income",
          category: "Revenue",
          confidenceBoost: 10,
          createdAt: "2024-01-01",
        },
      ],
    });

    const result = getUserRulesForCategoriser(settings);
    expect(result[0]).toMatchObject({
      merchantPattern: "stripe",
      descriptionPattern: "stripe payout",
      referencePattern: "str-123",
      provider: "stripe",
      direction: "income",
      category: "Revenue",
      confidenceBoost: 15,
    });
  });
});
