import { describe, it, expect } from "vitest";
import { parseUpload } from "../unified-parser";
import { canonicalListToNormalised } from "@/lib/providers/canonical-adapter";
import { categoriseWithV3AndV1Fallback } from "@/lib/upload/categoriser-v3-adapter";

const REVOLUT_HEADERS =
  "Date started (UTC),Date completed (UTC),ID,Type,State,Description,Reference,Payer,Card number,Card label,Card state,Orig currency,Orig amount,Payment currency,Amount,Total amount,Exchange rate,Fee,Fee currency,Balance,Account,Beneficiary account number,Beneficiary sort code or routing number,Beneficiary IBAN,Beneficiary BIC,MCC,Related transaction id,Spend program";

describe("Revolut — TOPUP merchant extraction", () => {
  it("extracts Stripe from 'Money added from STRIPE PAYMENTS UK LTD'", () => {
    const csv = [
      REVOLUT_HEADERS,
      "2026-05-22,2026-05-22,tx-001,TOPUP,COMPLETED,Money added from STRIPE PAYMENTS UK LTD,STRIPE,,,,,GBP,491.76,GBP,491.76,491.76,,0.00,GBP,10320.62,GBP Main,,,,,,,",
    ].join("\n");

    const result = parseUpload(csv, { companyId: "test-company" });
    expect(result.transactions).toHaveLength(1);
    expect(result.transactions[0].merchantName).toBe("Stripe Payments Uk Ltd");
    expect(result.transactions[0].counterpartyName).toBe("Stripe Payments Uk Ltd");
    expect(result.transactions[0].transactionType).toBe("TOPUP");
  });

  it("extracts PayPal from 'Money added from PAYPAL'", () => {
    const csv = [
      REVOLUT_HEADERS,
      "2026-05-22,2026-05-22,tx-002,TOPUP,COMPLETED,Money added from PAYPAL,PAYPAL,,,,,GBP,100.00,GBP,100.00,100.00,,0.00,GBP,10420.62,GBP Main,,,,,,,",
    ].join("\n");

    const result = parseUpload(csv, { companyId: "test-company" });
    expect(result.transactions).toHaveLength(1);
    expect(result.transactions[0].merchantName).toBe("Paypal");
    expect(result.transactions[0].counterpartyName).toBe("Paypal");
  });
});

describe("Revolut — TRANSFER counterparty extraction", () => {
  it("extracts 'Catherine Bull' from 'To Catherine Bull' and uses reference as description", () => {
    const csv = [
      REVOLUT_HEADERS,
      "2026-05-23,2026-05-23,tx-003,TRANSFER,COMPLETED,To Catherine Bull,Marketing Commission Payout,Godwin Mbah Mbah,,,,GBP,35.00,GBP,-35.00,-35.00,,0.00,GBP,10288.09,GBP Main,,,,,,,",
    ].join("\n");

    const result = parseUpload(csv, { companyId: "test-company" });
    expect(result.transactions).toHaveLength(1);
    expect(result.transactions[0].merchantName).toBe("Catherine Bull");
    expect(result.transactions[0].counterpartyName).toBe("Catherine Bull");
    expect(result.transactions[0].description).toBe("Marketing Commission Payout");
    expect(result.transactions[0].isTransfer).toBe(false);
    expect(result.transactions[0].category).not.toBe("Transfers");
  });

  it("extracts 'OLUWATOSIN AKINWOLEOLA' from 'To OLUWATOSIN AKINWOLEOLA'", () => {
    const csv = [
      REVOLUT_HEADERS,
      "2026-05-23,2026-05-23,tx-004,TRANSFER,COMPLETED,To OLUWATOSIN AKINWOLEOLA,Sales Rep Commision Fee,Godwin Mbah Mbah,,,,GBP,50.00,GBP,-50.00,-50.00,,0.00,GBP,10288.09,GBP Main,,,,,,,",
    ].join("\n");

    const result = parseUpload(csv, { companyId: "test-company" });
    expect(result.transactions).toHaveLength(1);
    expect(result.transactions[0].merchantName).toBe("OLUWATOSIN AKINWOLEOLA");
    expect(result.transactions[0].counterpartyName).toBe("OLUWATOSIN AKINWOLEOLA");
    expect(result.transactions[0].description).toBe("Sales Rep Commision Fee");
    expect(result.transactions[0].isTransfer).toBe(false);
  });

  it("marks 'From British Pound' as internal transfer", () => {
    const csv = [
      REVOLUT_HEADERS,
      "2026-05-23,2026-05-23,tx-005,TRANSFER,COMPLETED,From British Pound,,Godwin Mbah Mbah,,,,GBP,29.50,GBP,29.50,29.50,,0.00,GBP,10288.09,GBP Main,,,,,,,",
    ].join("\n");

    const result = parseUpload(csv, { companyId: "test-company" });
    expect(result.transactions).toHaveLength(1);
    expect(result.transactions[0].merchantName).toBe("Internal Transfer");
    expect(result.transactions[0].counterpartyName).toBe("British Pound");
    expect(result.transactions[0].isTransfer).toBe(true);
    expect(result.transactions[0].category).toBe("Transfers");
  });
});

describe("Revolut — CARD_PAYMENT merchant cleaning", () => {
  it("cleans 'Uber   * Eats Pending' to 'Uber Eats'", () => {
    const csv = [
      REVOLUT_HEADERS,
      "2026-05-23,2026-05-23,tx-006,CARD_PAYMENT,COMPLETED,Uber   * Eats Pending,,Godwin Mbah Mbah,516760******7513,Standard,ACTIVE,USD,15.00,GBP,-11.18,-11.29,1.342198,-0.11,GBP,10273.03,GBP Main,,,,,5817,,",
    ].join("\n");

    const result = parseUpload(csv, { companyId: "test-company" });
    expect(result.transactions).toHaveLength(1);
    expect(result.transactions[0].merchantName).toBe("Uber Eats");
  });

  it("strips Klarna prefix from 'Klarna*amazon' to get 'Amazon'", () => {
    const csv = [
      REVOLUT_HEADERS,
      "2026-05-23,2026-05-23,tx-007,CARD_PAYMENT,COMPLETED,Klarna*amazon,,Godwin Mbah Mbah,516760******7513,Standard,ACTIVE,USD,25.00,GBP,-18.64,-18.82,1.342198,-0.18,GBP,10273.03,GBP Main,,,,,5999,,",
    ].join("\n");

    const result = parseUpload(csv, { companyId: "test-company" });
    expect(result.transactions).toHaveLength(1);
    expect(result.transactions[0].merchantName).toBe("Amazon");
  });

  it("strips .com from 'Apple.com' to get 'Apple'", () => {
    const csv = [
      REVOLUT_HEADERS,
      "2026-05-23,2026-05-23,tx-008,CARD_PAYMENT,COMPLETED,Apple.com,,Godwin Mbah Mbah,516760******7513,Standard,ACTIVE,USD,5.99,GBP,-4.46,-4.51,1.342198,-0.05,GBP,10273.03,GBP Main,,,,,5818,,",
    ].join("\n");

    const result = parseUpload(csv, { companyId: "test-company" });
    expect(result.transactions).toHaveLength(1);
    expect(result.transactions[0].merchantName).toBe("Apple");
  });

  it("title-cases 'Highlevel Inc.' to 'HighLevel Inc.'", () => {
    const csv = [
      REVOLUT_HEADERS,
      "2026-05-23,2026-05-23,tx-009,CARD_PAYMENT,COMPLETED,Highlevel Inc.,,Godwin Mbah Mbah,516760******7513,Standard,ACTIVE,USD,10.00,GBP,-7.46,-7.53,1.342198,-0.07,GBP,10313.09,GBP Main,,,,,5734,,",
    ].join("\n");

    const result = parseUpload(csv, { companyId: "test-company" });
    expect(result.transactions).toHaveLength(1);
    expect(result.transactions[0].merchantName).toBe("HighLevel Inc.");
  });

  it("title-cases 'Openai' to 'OpenAI'", () => {
    const csv = [
      REVOLUT_HEADERS,
      "2026-05-23,2026-05-23,tx-010,CARD_PAYMENT,COMPLETED,Openai,,Godwin Mbah Mbah,516760******7513,Standard,ACTIVE,USD,20.00,GBP,-14.91,-15.06,1.342198,-0.15,GBP,10273.03,GBP Main,,,,,5734,,",
    ].join("\n");

    const result = parseUpload(csv, { companyId: "test-company" });
    expect(result.transactions).toHaveLength(1);
    expect(result.transactions[0].merchantName).toBe("OpenAI");
  });
});

describe("Revolut — MCC category mapping", () => {
  it("maps MCC 5734 to Software", () => {
    const csv = [
      REVOLUT_HEADERS,
      "2026-05-23,2026-05-23,tx-011,CARD_PAYMENT,COMPLETED,Base44,,Godwin Mbah Mbah,516760******7513,Standard,ACTIVE,USD,10.00,GBP,-7.46,-7.53,1.342198,-0.07,GBP,10313.09,GBP Main,,,,,5734,,",
    ].join("\n");

    const result = parseUpload(csv, { companyId: "test-company" });
    expect(result.transactions).toHaveLength(1);
    expect(result.transactions[0].merchantCategoryCode).toBe("5734");
    expect(result.transactions[0].category).toBe("Software");
  });

  it("maps MCC 5812 to Food and Meals", () => {
    const csv = [
      REVOLUT_HEADERS,
      "2026-05-23,2026-05-23,tx-012,CARD_PAYMENT,COMPLETED,Efes,,Godwin Mbah Mbah,516760******7513,Standard,ACTIVE,USD,15.00,GBP,-11.18,-11.29,1.342198,-0.11,GBP,10273.03,GBP Main,,,,,5812,,",
    ].join("\n");

    const result = parseUpload(csv, { companyId: "test-company" });
    expect(result.transactions).toHaveLength(1);
    expect(result.transactions[0].category).toBe("Food and Meals");
  });

  it("maps MCC 5411 to Food and Meals", () => {
    const csv = [
      REVOLUT_HEADERS,
      "2026-05-23,2026-05-23,tx-013,CARD_PAYMENT,COMPLETED,Asda Stores,,Godwin Mbah Mbah,516760******7513,Standard,ACTIVE,USD,50.00,GBP,-37.27,-37.63,1.342198,-0.36,GBP,10273.03,GBP Main,,,,,5411,,",
    ].join("\n");

    const result = parseUpload(csv, { companyId: "test-company" });
    expect(result.transactions).toHaveLength(1);
    expect(result.transactions[0].category).toBe("Food and Meals");
  });
});

describe("Revolut — Fee preservation", () => {
  it("preserves fee amount and fee currency from separate columns", () => {
    const csv = [
      REVOLUT_HEADERS,
      "2026-05-23,2026-05-23,tx-014,CARD_PAYMENT,COMPLETED,Eventsconnecter,,Godwin Mbah Mbah,516760******7513,Standard,ACTIVE,USD,20.00,GBP,-14.91,-15.06,1.342198,-0.15,GBP,10273.03,GBP Main,,,,,5817,,",
    ].join("\n");

    const result = parseUpload(csv, { companyId: "test-company" });
    expect(result.transactions).toHaveLength(1);
    expect(result.transactions[0].feeAmount).toBe(0.15);
    expect(result.transactions[0].feeCurrency).toBe("GBP");
  });

  it("preserves original currency, original amount and exchange rate", () => {
    const csv = [
      REVOLUT_HEADERS,
      "2026-05-23,2026-05-23,tx-015,CARD_PAYMENT,COMPLETED,Eventsconnecter,,Godwin Mbah Mbah,516760******7513,Standard,ACTIVE,USD,20.00,GBP,-14.91,-15.06,1.342198,-0.15,GBP,10273.03,GBP Main,,,,,5817,,",
    ].join("\n");

    const result = parseUpload(csv, { companyId: "test-company" });
    expect(result.transactions).toHaveLength(1);
    expect(result.transactions[0].originalCurrency).toBe("USD");
    expect(result.transactions[0].originalAmount).toBe(20);
    expect(result.transactions[0].exchangeRate).toBe(1.342198);
  });

  it("marks Revolut Business Fee with merchant 'Revolut' and category 'Bank Fees'", () => {
    const csv = [
      REVOLUT_HEADERS,
      "2026-05-23,2026-05-23,tx-016,FEE,COMPLETED,Revolut Business Fee,Grow plan fee,,,,,GBP,-35.00,GBP,-35.00,-35.00,,0.00,GBP,10273.03,GBP Main,,,,,,,",
    ].join("\n");

    const result = parseUpload(csv, { companyId: "test-company" });
    expect(result.transactions).toHaveLength(1);
    expect(result.transactions[0].merchantName).toBe("Revolut");
    expect(result.transactions[0].category).toBe("Bank Fees");
    expect(result.transactions[0].isFee).toBe(true);
  });
});

describe("Revolut — Internal transfer detection", () => {
  it("detects 'From British Pound' as internal transfer with correct flags", () => {
    const csv = [
      REVOLUT_HEADERS,
      "2026-05-23,2026-05-23,tx-017,TRANSFER,COMPLETED,From British Pound,,Godwin Mbah Mbah,,,,GBP,29.50,GBP,29.50,29.50,,0.00,GBP,10288.09,GBP Main,,,,,,,",
    ].join("\n");

    const result = parseUpload(csv, { companyId: "test-company" });
    expect(result.transactions).toHaveLength(1);
    expect(result.transactions[0].transactionType).toBe("TRANSFER");
    expect(result.transactions[0].isTransfer).toBe(true);
    expect(result.transactions[0].merchantName).toBe("Internal Transfer");
    expect(result.transactions[0].counterpartyName).toBe("British Pound");
    expect(result.transactions[0].category).toBe("Transfers");
  });
});

describe("Revolut — Full 694-row file import", () => {
  it("imports the real Revolut 694-row file without fatal errors", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const filePath = path.resolve(process.cwd(), "test_data/csv/revolut_694.csv");
    const csvText = fs.readFileSync(filePath, "utf-8");

    const result = parseUpload(csvText, { companyId: "test-company" });

    expect(result.detectedProvider).toContain("revolut");
    expect(result.transactions.length).toBeGreaterThan(600);
    expect(result.failedRows.length).toBe(0);
    expect(result.detectedCurrency).toBe("GBP");
    expect(result.transactions.every((t) => t.currency === "GBP")).toBe(true);

    // Spot-check a few known rows
    const topup = result.transactions.find((t) => t.transactionType === "TOPUP");
    expect(topup).toBeDefined();
    expect(topup!.merchantName).not.toBe("Account Top-up");
    expect(topup!.isTransfer).toBe(false);

    const fee = result.transactions.find((t) => t.description === "Revolut Business Fee");
    expect(fee).toBeDefined();
    expect(fee!.merchantName).toBe("Revolut");

    const internalTransfer = result.transactions.find((t) => t.description === "From British Pound");
    expect(internalTransfer).toBeDefined();
    expect(internalTransfer!.merchantName).toBe("Internal Transfer");
  });

  it("keeps real-file uncategorised review as a last resort", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const filePath = path.resolve(process.cwd(), "references/account-statement_01-Jan-2026_24-May-2026.csv");
    const csvText = fs.readFileSync(filePath, "utf-8");

    const result = parseUpload(csvText, {
      companyId: "test-company",
      companyCurrency: "GBP",
      companyCountry: "GB",
      uploadId: "test-upload",
    });
    const rows = canonicalListToNormalised(result.transactions);
    const categorised = categoriseWithV3AndV1Fallback(rows, {
      id: "settings-1",
      companyId: "test-company",
      businessModel: "mixed",
      country: "GB",
      currency: "GBP",
      revenueModels: [],
      costStructure: [],
      categoryRules: [],
      topRevenueChannels: [],
      paymentTools: [],
      toolsUsed: [],
      agentFocus: [],
      weeklyDigestEnabled: false,
      createdAt: new Date().toISOString(),
    });

    const uncategorised = categorised.filter((row) => row.category === "Uncategorised Review");
    const ambiguous = categorised.filter((row) => row.category === "Ambiguous");
    const stripeTopups = categorised.filter((row) =>
      row.type === "income" &&
      `${row.merchant} ${row.description}`.toLowerCase().includes("stripe")
    );

    expect(categorised).toHaveLength(694);
    expect(uncategorised.length).toBeLessThanOrEqual(10);
    expect(ambiguous.length).toBeLessThanOrEqual(5);
    expect(stripeTopups.length).toBeGreaterThan(0);
    expect(stripeTopups.every((row) => row.category === "Revenue")).toBe(true);
    expect(categorised.every((row) => row.categoryConfidence >= 0 && row.categoryConfidence <= 100)).toBe(true);
    expect(categorised.every((row) => row.groupingConfidence >= 0 && row.groupingConfidence <= 100)).toBe(true);
  });
});
