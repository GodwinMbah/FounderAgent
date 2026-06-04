import { describe, expect, it } from "vitest";
import { detectDuplicate } from "@/lib/intelligence/duplicate-detector-v2";
import { PlaidSandboxFixtureConnector } from "../sandbox-provider";
import { choosePreferredSource } from "../source-priority";

describe("Plaid sandbox fixture connector", () => {
  it("syncs sandbox accounts, balances and canonical transactions", async () => {
    const connector = new PlaidSandboxFixtureConnector();
    const consent = await connector.exchangeConnectionToken({ companyId: "company-1", publicToken: "public-sandbox-token" });
    const accounts = await connector.syncAccounts(consent);
    const balances = await connector.syncBalances(consent, accounts);
    const synced = await connector.syncTransactions(consent, accounts);
    const accountByProviderId = new Map(accounts.map((account) => [account.providerAccountId, account]));
    const canonical = synced.transactions.map((transaction) => {
      const account = accountByProviderId.get(transaction.providerAccountId);
      if (!account) throw new Error(`Missing account ${transaction.providerAccountId}`);
      return connector.normaliseTransaction(transaction, account);
    });

    expect(accounts).toHaveLength(3);
    expect(balances).toHaveLength(3);
    expect(canonical).toHaveLength(6);
    expect(new Set(canonical.map((tx) => tx.currency))).toEqual(new Set(["GBP"]));
    expect(canonical.every((tx) => tx.sourceProvider === "plaid")).toBe(true);

    const stripe = canonical.find((tx) => tx.externalTransactionId === "plaid-tx-stripe-001");
    expect(stripe?.amount).toBe(491.76);
    expect(stripe?.reportingTreatment?.includedInOperatingRevenue).toBe(true);

    const savingsTransfer = canonical.find((tx) => tx.externalTransactionId === "plaid-tx-saving-transfer-001");
    expect(savingsTransfer?.reportingTreatment?.reportingTreatment).toBe("internal_transfer");
    expect(savingsTransfer?.reportingTreatment?.includedInOperatingRevenue).toBe(false);

    const cardRepayment = canonical.find((tx) => tx.externalTransactionId === "plaid-tx-card-repayment-001");
    expect(cardRepayment?.reportingTreatment?.reportingTreatment).toBe("credit_card_repayment");
    expect(cardRepayment?.reportingTreatment?.includedInDebtTracking).toBe(true);
  });

  it("detects CSV and Open Banking overlaps without preferring CSV over richer connected sources", () => {
    const duplicate = detectDuplicate(
      {
        transactionDate: "2026-05-24",
        amount: 491.76,
        currency: "GBP",
        merchantName: "Stripe Payments UK LTD",
        reference: "stripe-payout-1",
        sourceProvider: "plaid",
        accountName: "Plaid Sandbox Business Current",
      },
      [
        {
          id: "csv-row-1",
          transactionDate: "2026-05-24",
          amount: 491.76,
          currency: "GBP",
          merchantName: "Stripe Payments UK LTD",
          reference: "stripe-payout-1",
          sourceProvider: "revolut_business_csv",
          sourceFileId: "upload-1",
          accountName: "Plaid Sandbox Business Current",
        },
      ]
    );

    expect(duplicate.isDuplicate).toBe(true);
    expect(duplicate.reason).toMatch(/reference|fuzzy|hash/i);
    expect(
      choosePreferredSource(
        { sourceKind: "open_banking_bank", sourceProvider: "plaid" },
        { sourceKind: "csv_statement", sourceProvider: "revolut_business_csv" }
      )
    ).toBe("candidate");
  });
});

