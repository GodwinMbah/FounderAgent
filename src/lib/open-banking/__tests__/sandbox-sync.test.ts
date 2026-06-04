import { describe, expect, it } from "vitest";
import type { CanonicalTransaction } from "@/lib/providers/canonical-model";
import { applyConnectedAccountTreatment, buildOpenBankingTransactionInserts } from "../sandbox-sync";
import { getAccountKpiRouting } from "../kpi-routing";

function makeCanonical(overrides: Partial<CanonicalTransaction> = {}): CanonicalTransaction {
  return {
    transactionDate: "2026-05-24",
    externalTransactionId: "plaid-tx-stripe-001",
    merchantName: "Stripe Payments UK LTD",
    description: "STRIPE PAYMENTS UK LTD PAYOUT",
    amount: 491.76,
    currency: "GBP",
    accountName: "Plaid Sandbox Business Current",
    category: "Revenue",
    status: "categorised",
    confidenceScore: 95,
    sourceProvider: "plaid",
    rawRowHash: "hash-1",
    isTransfer: false,
    isFee: false,
    isPossibleDuplicate: false,
    rawData: {
      providerAccountId: "plaid-current-001",
      provider_transaction_id: "plaid-tx-stripe-001",
    },
    parseErrors: [],
    ...overrides,
  };
}

describe("Open Banking sandbox sync preparation", () => {
  it("builds transaction inserts with source lineage metadata", () => {
    const accountIds = new Map([["plaid-current-001", "bank-account-1"]]);
    const { inserts, duplicatesSkipped } = buildOpenBankingTransactionInserts({
      companyId: "company-1",
      canonical: [makeCanonical()],
      existingTransactions: [],
      accountIdsByProviderId: accountIds,
      institutionId: "institution-1",
      consentId: "consent-1",
      syncJobId: "sync-job-1",
    });

    expect(duplicatesSkipped).toBe(0);
    expect(inserts).toHaveLength(1);
    expect(inserts[0]).toMatchObject({
      companyId: "company-1",
      bankAccountId: "bank-account-1",
      sourceProvider: "plaid",
      sourceConnectionId: "consent-1",
      sourceInstitutionId: "institution-1",
      sourceSyncJobId: "sync-job-1",
      sourceAccountProviderId: "plaid-current-001",
      currency: "GBP",
      type: "income",
    });
    expect(inserts[0].metadata).toMatchObject({
      source_kind: "open_banking",
      source_connection_id: "consent-1",
      source_account_provider_id: "plaid-current-001",
      open_banking_sandbox_fixture: true,
    });
  });

  it("reapplies connected account treatment after generic categorisation", () => {
    const cardPurchase = makeCanonical({
      externalTransactionId: "plaid-tx-canva-card-001",
      merchantName: "Canva",
      description: "CANVA SUBSCRIPTION",
      amount: -10,
      category: "Software",
      rawData: { providerAccountId: "plaid-card-001" },
    });
    const cardRepayment = makeCanonical({
      externalTransactionId: "plaid-tx-card-repayment-001",
      merchantName: "Capital One",
      description: "PAYMENT RECEIVED THANK YOU",
      amount: 350,
      category: "Revenue",
      transactionType: "payment",
      rawData: { providerAccountId: "plaid-card-001" },
    });

    const account = {
      companyId: "company-1",
      provider: "plaid" as const,
      providerAccountId: "plaid-card-001",
      accountName: "Plaid Sandbox Business Credit Card",
      accountType: "business_credit_card" as const,
      currency: "GBP",
      status: "connected" as const,
      kpiRouting: getAccountKpiRouting("business_credit_card"),
    };

    applyConnectedAccountTreatment(cardPurchase, account);
    applyConnectedAccountTreatment(cardRepayment, account);

    expect(cardPurchase.reportingTreatment?.includedInOperatingExpenses).toBe(true);
    expect(cardPurchase.reportingTreatment?.includedInDebtTracking).toBe(false);
    expect(cardRepayment.reportingTreatment?.reportingTreatment).toBe("credit_card_repayment");
    expect(cardRepayment.reportingTreatment?.includedInOperatingRevenue).toBe(false);
    expect(cardRepayment.reportingTreatment?.includedInDebtTracking).toBe(true);
  });

  it("skips duplicates instead of inserting overlapping CSV/Open Banking rows", () => {
    const { inserts, duplicatesSkipped } = buildOpenBankingTransactionInserts({
      companyId: "company-1",
      canonical: [makeCanonical({ reference: "stripe-payout-1" })],
      existingTransactions: [
        {
          id: "csv-row-1",
          transactionDate: "2026-05-24",
          amount: 491.76,
          currency: "GBP",
          merchantName: "Stripe Payments UK LTD",
          reference: "stripe-payout-1",
          externalTransactionId: undefined,
          accountName: "Plaid Sandbox Business Current",
          sourceProvider: "revolut_business_csv",
          sourceFileId: "upload-1",
        },
      ],
      accountIdsByProviderId: new Map([["plaid-current-001", "bank-account-1"]]),
    });

    expect(inserts).toHaveLength(0);
    expect(duplicatesSkipped).toBe(1);
  });
});
