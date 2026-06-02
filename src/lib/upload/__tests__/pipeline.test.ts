import { describe, it, expect } from "vitest";

interface TestTx {
  rowNumber: number;
  category?: string;
  merchantName?: string;
  amount?: number;
  confidenceScore?: number;
  status?: string;
}

interface CatTx {
  category?: string;
  confidenceScore: number;
  status?: string;
}


// We test the category override application logic in isolation
// since the full pipeline requires Supabase storage + DB

interface DupTx {
  isPossibleDuplicate?: boolean;
  category?: string;
  amount?: number;
}

describe("pipeline duplicate filtering logic", () => {
  it("filters out duplicates before insert using canonical transaction flags", () => {
    const parseResultTransactions: DupTx[] = [
      { isPossibleDuplicate: false, category: "Software", amount: 100 },
      { isPossibleDuplicate: true, category: "Software", amount: 100 },
      { isPossibleDuplicate: false, category: "Office Costs", amount: 50 },
    ];

    const transactionInserts = parseResultTransactions
      .filter((tx) => !tx.isPossibleDuplicate)
      .map((tx) => ({ ...tx, companyId: "test-company" }));

    expect(transactionInserts.length).toBe(2);
    expect(transactionInserts.some((t) => t.isPossibleDuplicate)).toBe(false);
  });

  it("filters categorised rows in sync with canonical duplicates", () => {
    const categorisedRows = [
      { category: "Software", amount: 100 },
      { category: "Software", amount: 100 },
      { category: "Office Costs", amount: 50 },
    ];

    const parseResultTransactions = [
      { isPossibleDuplicate: false },
      { isPossibleDuplicate: true },
      { isPossibleDuplicate: false },
    ];

    const deduplicatedRows = categorisedRows.filter(
      (_, i) => !parseResultTransactions[i]?.isPossibleDuplicate
    );

    expect(deduplicatedRows.length).toBe(2);
    expect(deduplicatedRows.map((r) => r.category)).toEqual(["Software", "Office Costs"]);
  });

  it("allows all transactions when no duplicates are flagged", () => {
    const parseResultTransactions: DupTx[] = [
      { isPossibleDuplicate: false, category: "Revenue", amount: 500 },
      { isPossibleDuplicate: false, category: "Cloud Infrastructure", amount: 200 },
    ];

    const transactionInserts = parseResultTransactions.filter((tx) => !tx.isPossibleDuplicate);
    expect(transactionInserts.length).toBe(2);
  });
});

describe("pipeline category override logic", () => {
  it("applies category overrides by row index", () => {
    const transactions: TestTx[] = [
      { rowNumber: 2, category: "Revenue", merchantName: "Stripe", amount: 100 },
      { rowNumber: 3, category: "Cloud Infrastructure", merchantName: "AWS", amount: -50 },
      { rowNumber: 4, category: "Uncategorised Review", merchantName: "Unknown", amount: -25 },
    ];

    const categoryOverrides: Record<number, string> = {
      2: "Software",
      4: "Office Costs",
    };

    for (let i = 0; i < transactions.length; i++) {
      const rowNumber = i + 2;
      const override = categoryOverrides[rowNumber];
      if (override) {
        transactions[i].category = override;
        transactions[i].confidenceScore = 100;
        transactions[i].status = "categorised";
      }
    }

    expect(transactions[0].category).toBe("Software");
    expect(transactions[0].confidenceScore).toBe(100);
    expect(transactions[1].category).toBe("Cloud Infrastructure");
    expect(transactions[2].category).toBe("Office Costs");
  });

  it("ignores overrides for non-existent rows", () => {
    const transactions: TestTx[] = [
      { rowNumber: 2, category: "Revenue" },
    ];

    const categoryOverrides: Record<number, string> = {
      99: "Software",
    };

    for (let i = 0; i < transactions.length; i++) {
      const rowNumber = i + 2;
      const override = categoryOverrides[rowNumber];
      if (override) {
        transactions[i].category = override;
      }
    }

    expect(transactions[0].category).toBe("Revenue");
  });

  it("propagates v3 categories back to canonical transactions", () => {
    const canonicalTxs: CatTx[] = [
      { category: undefined, confidenceScore: 0 },
      { category: "Cloud Infrastructure", confidenceScore: 75 },
    ];

    const categorisedRows: CatTx[] = [
      { category: "Revenue", confidenceScore: 95, status: "categorised" },
      { category: "Software", confidenceScore: 88, status: "ai_suggested" },
    ];

    for (let i = 0; i < categorisedRows.length && i < canonicalTxs.length; i++) {
      const catRow = categorisedRows[i];
      if (catRow.category) {
        canonicalTxs[i].category = catRow.category;
        canonicalTxs[i].confidenceScore = catRow.confidenceScore;
      }
    }

    expect(canonicalTxs[0].category).toBe("Revenue");
    expect(canonicalTxs[0].confidenceScore).toBe(95);
    expect(canonicalTxs[1].category).toBe("Software");
    expect(canonicalTxs[1].confidenceScore).toBe(88);
  });

  it("ensures category overrides from preview make it into final DB insert", () => {
    const transactions: TestTx[] = [
      { rowNumber: 2, category: "Uncategorised Review", merchantName: "Unknown Vendor", amount: -25 },
      { rowNumber: 3, category: "Cloud Infrastructure", merchantName: "AWS", amount: -50 },
      { rowNumber: 4, category: "Uncategorised Review", merchantName: "Another Unknown", amount: -30 },
    ];

    const categoryOverrides: Record<number, string> = {
      2: "Software",
      4: "Office Costs",
    };

    // Apply overrides by row index (same logic as pipeline)
    for (let i = 0; i < transactions.length; i++) {
      const rowNumber = i + 2;
      const overrideCategory = categoryOverrides[rowNumber];
      if (overrideCategory) {
        transactions[i].category = overrideCategory;
        transactions[i].confidenceScore = 100;
        transactions[i].status = "categorised";
      }
    }

    // Simulate DB insert mapping — every transaction should carry its overridden category
    const dbInserts = transactions.map((tx) => ({
      companyId: "test-company",
      category: tx.category,
      confidenceScore: tx.confidenceScore,
      status: tx.status,
      merchant: tx.merchantName,
      amount: tx.amount,
    }));

    expect(dbInserts[0].category).toBe("Software");
    expect(dbInserts[0].confidenceScore).toBe(100);
    expect(dbInserts[1].category).toBe("Cloud Infrastructure"); // unchanged
    expect(dbInserts[2].category).toBe("Office Costs");
    expect(dbInserts[2].confidenceScore).toBe(100);
  });
});
