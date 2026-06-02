import { describe, it, expect } from "vitest";
import { detectTransfer } from "../transfer-detector";

function tx(description: string, amount: number, opts?: Partial<Parameters<typeof detectTransfer>[0]>) {
  return detectTransfer({
    description,
    amount,
    merchantName: "",
    currency: "GBP",
    transactionDate: "2024-01-01",
    ...opts,
  });
}

describe("credit card repayment detection", () => {
  it("detects Capital On Tap payment as transfer", () => {
    const result = tx("Capital On Tap payment", -500);
    expect(result.isTransfer).toBe(true);
  });

  it("detects Credit card repayment as transfer", () => {
    const result = tx("Credit card repayment", -1200);
    expect(result.isTransfer).toBe(true);
  });

  it("detects Capital One monthly payment as transfer", () => {
    const result = tx("Capital One monthly payment", -800);
    expect(result.isTransfer).toBe(true);
  });

  it("does NOT flag credit card fee as transfer", () => {
    const result = tx("Credit card fee", -25);
    expect(result.isTransfer).toBe(false);
  });

  it("does NOT flag interest charge as transfer", () => {
    const result = tx("Interest charge", -15);
    expect(result.isTransfer).toBe(false);
  });

  it("does NOT flag credit card payment fee as transfer (edge case)", () => {
    const result = tx("Credit card payment fee", -5);
    expect(result.isTransfer).toBe(false);
  });
});
