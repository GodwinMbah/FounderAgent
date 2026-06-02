import { describe, it, expect } from "vitest";
import { parseUpload } from "../unified-parser";

describe("parseUpload — merchant extraction", () => {
  it("uses reference when description is generic", () => {
    const csv = [
      "Date,Description,Reference,Amount",
      "2024-01-15,Card Payment,STARBUCKS LONDON,-5.40",
    ].join("\n");

    const result = parseUpload(csv, { companyId: "test-company" });
    expect(result.transactions.length).toBe(1);
    // When description is generic ("Card Payment"), merchant falls back to reference
    expect(result.transactions[0].merchantName).toBe("STARBUCKS LONDON");
  });

  it("falls back to description when reference is missing", () => {
    const csv = [
      "Date,Description,Amount",
      "2024-01-15,Acme Office Supplies,-45.67",
    ].join("\n");

    const result = parseUpload(csv, { companyId: "test-company" });
    expect(result.transactions.length).toBe(1);
    // Description is used directly (up to 3 words)
    expect(result.transactions[0].merchantName).toBe("Acme Office Supplies");
  });
});

describe("parseUpload — Revolut type column", () => {
  it("detects TOPUP and extracts source merchant from description", () => {
    const csv = [
      "Date Started (UTC),Date Completed (UTC),ID,Description,Reference,Type,State,Amount,Total Amount,Fee,Balance,Account",
      "2024-01-15,2024-01-15,tx-001,Money added from STRIPE PAYMENTS UK LTD,REF001,topup,completed,2000.00,2000.00,0.00,3454.33,Business GBP",
    ].join("\n");

    const result = parseUpload(csv, { companyId: "test-company" });
    expect(result.transactions.length).toBe(1);
    expect(result.transactions[0].merchantName).toBe("Stripe Payments Uk Ltd");
    expect(result.transactions[0].counterpartyName).toBe("Stripe Payments Uk Ltd");
  });

  it("detects FEE and uses source provider name", () => {
    const csv = [
      "Date Started (UTC),Date Completed (UTC),ID,Description,Reference,Type,State,Amount,Total Amount,Fee,Balance,Account",
      "2024-01-15,2024-01-15,tx-002,Monthly Account Fee,REF002,fee,completed,-12.99,-12.99,0.00,3435.94,Business GBP",
    ].join("\n");

    const result = parseUpload(csv, { companyId: "test-company" });
    expect(result.transactions.length).toBe(1);
    // FEE type uses the source provider name as merchant
    expect(result.transactions[0].merchantName).toBe("Revolut Business");
  });

  it("detects CARD_PAYMENT and extracts merchant from description", () => {
    const csv = [
      "Date Started (UTC),Date Completed (UTC),ID,Description,Reference,Type,State,Amount,Total Amount,Fee,Balance,Account",
      "2024-01-15,2024-01-15,tx-003,STARBUCKS LONDON,REF003,card_payment,completed,-5.40,-5.40,0.00,3448.93,Business GBP",
    ].join("\n");

    const result = parseUpload(csv, { companyId: "test-company" });
    expect(result.transactions.length).toBe(1);
    // Non-generic description is used directly
    expect(result.transactions[0].merchantName).toBe("STARBUCKS LONDON");
  });

  it("detects TRANSFER and uses reference as counterparty", () => {
    const csv = [
      "Date Started (UTC),Date Completed (UTC),ID,Description,Reference,Type,State,Amount,Total Amount,Fee,Balance,Account",
      "2024-01-15,2024-01-15,tx-004,Transfer to Marketing,Marketing Budget,transfer,completed,-500.00,-500.00,0.00,1454.33,Business GBP",
    ].join("\n");

    const result = parseUpload(csv, { companyId: "test-company" });
    expect(result.transactions.length).toBe(1);
    // TRANSFER type uses reference (up to 3 words)
    expect(result.transactions[0].merchantName).toBe("Marketing Budget");
    expect(result.transactions[0].isTransfer).toBe(true);
  });
});

describe("parseUpload — provider detection", () => {
  it("detects Revolut Business from headers", () => {
    const csv = [
      "Date Started (UTC),Date Completed (UTC),ID,Description,Reference,Type,State,Amount,Total Amount,Fee,Balance,Account",
      "2024-01-15,2024-01-15,tx-001,Acme Office Supplies,REF001,card_payment,completed,-45.67,-45.67,0.00,1954.33,Business GBP",
    ].join("\n");

    const result = parseUpload(csv, { companyId: "test-company" });
    expect(result.detectedProvider).toContain("revolut");
  });
});
