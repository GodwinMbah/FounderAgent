import { describe, expect, it } from "vitest";
import { buildCategoryRefreshUpdate, isUserCategoryProtected, normaliseCategoryRefreshStatus } from "../recategorisation";
import type { CanonicalTransaction } from "@/lib/providers/canonical-model";
import type { Transaction } from "@/lib/types";

function transaction(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: "tx-1",
    companyId: "company-1",
    uploadId: "upload-1",
    date: "2026-01-01",
    merchant: "From British Pound",
    description: "From British Pound",
    category: "Revenue",
    amount: 100,
    type: "income",
    status: "categorised",
    confidenceScore: 90,
    metadata: {},
    ...overrides,
  };
}

function canonical(overrides: Partial<CanonicalTransaction> = {}): CanonicalTransaction {
  return {
    transactionDate: "2026-01-01",
    merchantName: "From British Pound",
    description: "From British Pound",
    reference: "Internal movement",
    amount: 100,
    currency: "GBP",
    category: "Internal Transfer",
    status: "transfer",
    confidenceScore: 96,
    categoryConfidence: 96,
    categoryReason: "Internal account movement.",
    kpiTreatment: "excluded",
    kpiExcluded: true,
    kpiExclusionReason: "internal_transfer",
    sourceProvider: "revolut_business_csv",
    sourceRowNumber: 10,
    rawRowHash: "hash-1",
    isTransfer: true,
    isFee: false,
    isPossibleDuplicate: false,
    rawData: {},
    parseErrors: [],
    ...overrides,
  };
}

describe("category refresh recategorisation", () => {
  it("protects user-confirmed corrections", () => {
    expect(isUserCategoryProtected(transaction({ status: "user_confirmed" }))).toBe(true);
    expect(isUserCategoryProtected(transaction({ metadata: { category_source: "user" } }))).toBe(true);
    expect(isUserCategoryProtected(transaction({ metadata: { user_confirmed_category: true } }))).toBe(true);
    expect(isUserCategoryProtected(transaction())).toBe(false);
  });

  it("builds an update without changing lineage or creating a duplicate", () => {
    const update = buildCategoryRefreshUpdate(
      transaction({
        id: "tx-123",
        sourceRowNumber: 10,
        rawRowHash: "original-hash",
        externalTransactionId: "external-1",
      }),
      canonical(),
      "2026-06-03T10:00:00.000Z"
    );

    expect(update).toMatchObject({
      category: "Internal Transfer",
      status: "ai_suggested",
      kpi_excluded: true,
      kpi_exclusion_reason: "internal_transfer",
    });
    expect(update).not.toHaveProperty("id");
    expect(update).not.toHaveProperty("upload_id");
    expect(update).not.toHaveProperty("source_row_number");
    expect(update).not.toHaveProperty("raw_row_hash");
    expect(update?.metadata).toMatchObject({
      previous_category_before_refresh: "Revenue",
      category_refreshed_by: "system_intelligence",
      kpi_treatment: "excluded",
    });
  });

  it("does not build updates for protected user corrections", () => {
    const update = buildCategoryRefreshUpdate(
      transaction({ status: "user_confirmed", metadata: { category_source: "user" } }),
      canonical()
    );

    expect(update).toBeNull();
  });

  it("normalises transfer status to a valid database status", () => {
    expect(normaliseCategoryRefreshStatus("transfer")).toBe("ai_suggested");
    expect(normaliseCategoryRefreshStatus("user_confirmed")).toBe("user_confirmed");
  });
});
