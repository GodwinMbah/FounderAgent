import { describe, expect, it } from "vitest";
import { toDbTransaction, type CanonicalTransaction } from "../canonical-model";

function makeCanonical(overrides: Partial<CanonicalTransaction> = {}): CanonicalTransaction {
  return {
    transactionDate: "2026-05-24",
    postedDate: "2026-05-25",
    externalTransactionId: "revolut-tx-1",
    transactionType: "CARD_PAYMENT",
    merchantName: "Canva",
    description: "Canva subscription",
    reference: "INV-1",
    amount: -29,
    feeAmount: 0.2,
    originalAmount: 39,
    originalCurrency: "USD",
    feeCurrency: "GBP",
    runningBalance: 1024,
    currency: "GBP",
    category: "Software",
    subcategory: "Design Tool",
    categoryReason: "Merchant registry matched Canva.",
    categoryConfidence: 95,
    groupingConfidence: 98,
    categoryEvidence: [
      { category: "Software", confidence: 95, source: "merchant_registry", reason: "Canva alias" },
    ],
    businessMeaning: "Design software subscription.",
    kpiTreatment: "included",
    status: "categorised",
    confidenceScore: 95,
    sourceProvider: "revolut_business_csv",
    sourceFileId: "upload-1",
    sourceRowNumber: 12,
    rawRowHash: "fnv1a:test",
    rowStatus: "inserted",
    isTransfer: false,
    isFee: false,
    isPossibleDuplicate: false,
    rawData: { Description: "Canva subscription" },
    parseErrors: [],
    ...overrides,
  };
}

describe("toDbTransaction", () => {
  it("promotes lineage, fee, balance, and KPI treatment fields into the DB insert shape", () => {
    const mapped = toDbTransaction(makeCanonical(), "company-1", "upload-1", "bank-1");

    expect(mapped.uploadId).toBe("upload-1");
    expect(mapped.accountId).toBe("bank-1");
    expect(mapped.sourceRowNumber).toBe(12);
    expect(mapped.externalTransactionId).toBe("revolut-tx-1");
    expect(mapped.postedDate).toBe("2026-05-25");
    expect(mapped.currency).toBe("GBP");
    expect(mapped.sourceProvider).toBe("revolut_business_csv");
    expect(mapped.rawRowHash).toBe("fnv1a:test");
    expect(mapped.reference).toBe("INV-1");
    expect(mapped.feeAmount).toBe(0.2);
    expect(mapped.runningBalance).toBe(1024);
    expect(mapped.metadata?.original_amount).toBe(39);
    expect(mapped.metadata?.original_currency).toBe("USD");
    expect(mapped.metadata?.detected_subcategory).toBe("Design Tool");
    expect(mapped.metadata?.category_confidence).toBe(95);
    expect(mapped.metadata?.grouping_confidence).toBe(98);
    expect(mapped.metadata?.category_evidence).toEqual([
      { category: "Software", confidence: 95, source: "merchant_registry", reason: "Canva alias" },
    ]);
  });

  it("preserves explicit KPI exclusion for non-transfer rows", () => {
    const mapped = toDbTransaction(makeCanonical({
      category: "Ambiguous",
      kpiTreatment: "excluded",
      kpiExcluded: true,
      kpiExclusionReason: "needs_review",
      status: "needs_review",
    }), "company-1", "upload-1", "bank-1");

    expect(mapped.kpiExcluded).toBe(true);
    expect(mapped.kpiExclusionReason).toBe("needs_review");
    expect(mapped.metadata?.kpi_treatment).toBe("excluded");
    expect(mapped.metadata?.kpi_excluded).toBe(true);
  });
});
