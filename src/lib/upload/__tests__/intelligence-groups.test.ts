import { describe, expect, it } from "vitest";
import { applyIntelligenceGroups, buildPreviewIntelligenceSummary } from "../intelligence-groups";
import type { CanonicalTransaction } from "@/lib/providers/canonical-model";
import type { PreviewRow } from "../wizard-types";
import { formatKpiExclusionReason } from "@/lib/kpi-treatment";

function tx(overrides: Partial<CanonicalTransaction>): CanonicalTransaction {
  return {
    transactionDate: "2026-01-01",
    merchantName: "Facebook",
    description: "Facebook ads",
    reference: "FACEBOOK ADS 123",
    amount: -100,
    currency: "GBP",
    category: "Advertising",
    status: "categorised",
    confidenceScore: 93,
    categoryConfidence: 93,
    sourceProvider: "open_banking",
    sourceRowNumber: 2,
    isTransfer: false,
    isFee: false,
    isPossibleDuplicate: false,
    rawData: {},
    parseErrors: [],
    ...overrides,
  };
}

describe("upload intelligence grouping", () => {
  it("groups similar transactions and lifts low-confidence rows with shared evidence", () => {
    const transactions = [
      tx({ sourceRowNumber: 2, reference: "FACEBOOK ADS 123", category: "Advertising", confidenceScore: 94, categoryConfidence: 94 }),
      tx({ sourceRowNumber: 3, reference: "FACEBOOK ADS 456", category: "Advertising", confidenceScore: 92, categoryConfidence: 92 }),
      tx({
        sourceRowNumber: 4,
        reference: "FACEBOOK ADS 789",
        category: "Uncategorised Review",
        status: "needs_review",
        confidenceScore: 0,
        categoryConfidence: 0,
      }),
    ];

    const groups = applyIntelligenceGroups(transactions);

    expect(groups).toHaveLength(1);
    expect(groups[0].category).toBe("Advertising");
    expect(groups[0].rowCount).toBe(3);
    expect(transactions[2].category).toBe("Advertising");
    expect(transactions[2].status).toBe("categorised");
    expect(transactions[2].categorySource).toBe("grouping");
    expect(transactions[2].intelligenceGroupReason).toContain("similar rows");
  });

  it("does not overwrite user-confirmed rows during group application", () => {
    const transactions = [
      tx({ sourceRowNumber: 2, category: "Advertising", confidenceScore: 94, categoryConfidence: 94 }),
      tx({
        sourceRowNumber: 3,
        category: "Professional Services",
        confidenceScore: 100,
        categoryConfidence: 100,
        status: "user_confirmed",
        categorySource: "user",
        userConfirmedCategory: true,
      }),
      tx({ sourceRowNumber: 4, category: "Advertising", confidenceScore: 91, categoryConfidence: 91 }),
    ];

    applyIntelligenceGroups(transactions);

    expect(transactions[1].category).toBe("Professional Services");
    expect(transactions[1].status).toBe("user_confirmed");
  });

  it("summarises preview KPI excluded and review rows", () => {
    const rows = [
      {
        rowNumber: 1,
        date: "2026-01-01",
        merchant: "From British Pound",
        description: "From British Pound",
        amount: 100,
        type: "income",
        currency: "GBP",
        category: "Internal Transfer",
        confidenceScore: 95,
        categoryConfidence: 95,
        kpiTreatment: "excluded",
        status: "transfer",
        issues: [],
        rawData: {},
      },
      {
        rowNumber: 2,
        date: "2026-01-02",
        merchant: "Unknown Person",
        description: "",
        amount: 20,
        type: "expense",
        currency: "GBP",
        category: "Uncategorised Review",
        confidenceScore: 0,
        categoryConfidence: 0,
        status: "needs_review",
        issues: [],
        rawData: {},
      },
    ] satisfies PreviewRow[];

    const summary = buildPreviewIntelligenceSummary(rows);

    expect(summary.kpiExcludedRows).toBe(2);
    expect(summary.transfersDetected).toBe(1);
    expect(summary.rowsNeedingReview).toBe(1);
    expect(formatKpiExclusionReason("internal_transfer")).toBe("Internal transfer");
  });
});
