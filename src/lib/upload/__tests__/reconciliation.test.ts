import { describe, expect, it } from "vitest";
import { getImportReconciliation } from "../reconciliation";

describe("getImportReconciliation", () => {
  it("reads expanded upload reconciliation counters and row outcomes", () => {
    const rec = getImportReconciliation({
      import_reconciliation: {
        rowsInFile: 694,
        rowsParsed: 694,
        rowsValid: 694,
        rowsInserted: 692,
        rowsSkippedDuplicate: 1,
        rowsMarkedTransfer: 110,
        rowsExcludedFromKpis: 120,
        rowsFailed: 1,
        rowsNeedingReview: 80,
        rowsUncategorised: 7,
        rowsAmbiguous: 2,
        rowsCategorised: 685,
        rowsHighConfidence: 520,
        rowsCategorisedByUserRule: 3,
        rowsCategorisedBySystemIntelligence: 682,
        rowsIncludedInRevenue: 87,
        rowsIncludedInExpenses: 487,
        rowsIncludedInCashFlow: 574,
        rowsLinkedToSubscriptions: 12,
        rowsWithFees: 91,
        rowsWithRefunds: 4,
        rowsWithCreditCardRepaymentTreatment: 2,
        reconciliationBalanced: true,
        explanation: "694 rows reconciled.",
        rowOutcomes: [
          {
            rowNumber: 2,
            status: "inserted",
            transactionId: "tx-1",
            sourceProvider: "revolut_business_csv",
            sourceFileName: "account.csv",
            externalTransactionId: "external-1",
            rawRowHash: "fnv1a:abc",
            category: "Revenue",
            categoryConfidence: 92,
            groupingConfidence: 98,
            kpiTreatment: "included",
            signalsUsed: ["merchant_registry"],
          },
        ],
      },
    });

    expect(rec?.rowsInFile).toBe(694);
    expect(rec?.rowsUncategorised).toBe(7);
    expect(rec?.rowsAmbiguous).toBe(2);
    expect(rec?.rowsIncludedInRevenue).toBe(87);
    expect(rec?.rowsWithFees).toBe(91);
    expect(rec?.rowsWithCreditCardRepaymentTreatment).toBe(2);
    expect(rec?.rowOutcomes).toHaveLength(1);
    expect(rec?.rowOutcomes[0].transactionId).toBe("tx-1");
    expect(rec?.rowOutcomes[0].signalsUsed).toEqual(["merchant_registry"]);
  });
});
