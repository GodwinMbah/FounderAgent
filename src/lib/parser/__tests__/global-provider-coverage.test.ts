import { describe, expect, it } from "vitest";
import { getAllAdapters } from "@/lib/providers/adapter-registry";
import { parseUpload } from "../unified-parser";

describe("global provider coverage", () => {
  it("registers exact adapters and generic fallbacks for the target provider set", () => {
    const adapterIds = new Set(getAllAdapters().map((adapter) => adapter.id));
    const requiredExactAdapters = [
      "revolut_business_csv",
      "tide",
      "monzo",
      "starling",
      "wise",
      "barclays",
      "hsbc",
      "lloyds",
      "natwest",
      "chase",
      "stripe_csv",
      "paypal_csv",
      "shopify_payouts_csv",
      "generic_bank",
      "manual_csv",
    ];

    for (const id of requiredExactAdapters) {
      expect(adapterIds.has(id), `missing adapter ${id}`).toBe(true);
    }
  });

  it("uses the generic fallback for unknown global CSVs with split debit/credit columns", () => {
    const csv = [
      "Booking Date,Posted Date,Details,Counterparty,Payment Reference,Debit,Credit,Currency,Fee,Running Balance,Account,Transaction ID,Status",
      '24.05.2026,25.05.2026,Invoice payment,Acme Client,INV-2026-001,,"1.234,56",EUR,"0,00","12.345,67",EUR Operating,txn-1,completed',
      '26.05.2026,26.05.2026,Cloud hosting,AWS Europe,AWS-2026-05,"89,90",,EUR,"0,00","12.255,77",EUR Operating,txn-2,completed',
    ].join("\n");

    const result = parseUpload(csv, {
      companyId: "test-company",
      companyCurrency: "EUR",
      companyCountry: "DE",
    });

    expect(["manual_csv", "generic_bank"]).toContain(result.detectedProvider);
    expect(result.failedRows).toHaveLength(0);
    expect(result.transactions).toHaveLength(2);
    expect(result.transactions[0]).toMatchObject({
      transactionDate: "2026-05-24",
      postedDate: "2026-05-25",
      merchantName: "Acme Client",
      reference: "INV-2026-001",
      amount: 1234.56,
      currency: "EUR",
      feeAmount: 0,
      runningBalance: 12345.67,
      accountName: "EUR Operating",
      externalTransactionId: "txn-1",
      status: "completed",
    });
    expect(result.transactions[1]).toMatchObject({
      merchantName: "AWS Europe",
      amount: -89.9,
      currency: "EUR",
      runningBalance: 12255.77,
    });
  });

  it("handles unknown US credit card statement formats through generic CSV mapping", () => {
    const csv = [
      "Transaction Date,Posting Date,Description,Card,Category,Amount,Currency,Reference ID,Status",
      "05/10/2026,05/11/2026,AMEX PAYMENT THANK YOU,Corporate Platinum,Payment,-1500.00,USD,amex-payment-1,posted",
      "05/12/2026,05/13/2026,GOOGLE ADS 1234,Corporate Platinum,Advertising,250.12,USD,card-charge-1,posted",
    ].join("\n");

    const result = parseUpload(csv, {
      companyId: "test-company",
      companyCurrency: "USD",
      companyCountry: "US",
    });

    expect(["manual_csv", "generic_bank"]).toContain(result.detectedProvider);
    expect(result.failedRows).toHaveLength(0);
    expect(result.transactions).toHaveLength(2);
    expect(result.transactions[0].transactionDate).toBe("2026-05-10");
    expect(result.transactions[0].postedDate).toBe("2026-05-11");
    expect(result.transactions[0].externalTransactionId).toBe("amex-payment-1");
    expect(result.transactions[0].currency).toBe("USD");
    expect(result.transactions[1].merchantName).toBe("GOOGLE ADS 1234");
  });
});
