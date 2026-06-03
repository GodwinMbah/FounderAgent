import { describe, it, expect } from "vitest";
import {
  categoriseTransaction,
  type TransactionContext,
  type BusinessContext,
} from "../categorisation-engine";

function makeTx(partial: Partial<TransactionContext>): TransactionContext {
  return {
    description: "",
    merchant: "",
    reference: "",
    amount: -100,
    type: "expense",
    currency: "GBP",
    ...partial,
  };
}

function makeContext(
  model: BusinessContext["model"] = "mixed",
  rules = []
): BusinessContext {
  return { model, userRules: rules };
}

describe("Revolut CSV categorisation", () => {
  const ctx = makeContext("mixed");

  it("Stripe top-up → Revenue", () => {
    const result = categoriseTransaction(
      makeTx({
        description: "Money added from STRIPE PAYMENTS UK LTD",
        amount: 5000,
        type: "income",
        transactionType: "TOPUP",
      }),
      ctx
    );
    expect(result.category).toBe("Revenue");
    expect(result.confidence).toBeGreaterThanOrEqual(80);
  });

  it("Eventsconnecter → Software", () => {
    const result = categoriseTransaction(
      makeTx({
        merchant: "Eventsconnecter",
        description: "Eventsconnecter payment",
        amount: -150,
      }),
      ctx
    );
    expect(result.category).toBe("Software");
    expect(result.confidence).toBeGreaterThanOrEqual(70);
  });

  it("HighLevel → Software", () => {
    const result = categoriseTransaction(
      makeTx({
        merchant: "Highlevel Inc.",
        description: "Highlevel Agency Sub",
        amount: -297,
      }),
      ctx
    );
    expect(result.category).toBe("Software");
    expect(result.confidence).toBeGreaterThanOrEqual(85);
  });

  it("Facebook Ads → Advertising", () => {
    const result = categoriseTransaction(
      makeTx({
        merchant: "Meta",
        description: "Facebook Ads",
        amount: -500,
      }),
      ctx
    );
    expect(result.category).toBe("Advertising");
    expect(result.confidence).toBeGreaterThanOrEqual(90);
  });

  it("Canva → Software", () => {
    const result = categoriseTransaction(
      makeTx({
        merchant: "Canva",
        description: "Canva subscription",
        amount: -12.99,
      }),
      ctx
    );
    expect(result.category).toBe("Software");
    expect(result.confidence).toBeGreaterThanOrEqual(80);
  });

  it("Uber Eats → Food and Meals", () => {
    const result = categoriseTransaction(
      makeTx({
        merchant: "Uber Eats",
        description: "Uber Eats delivery",
        amount: -25,
      }),
      ctx
    );
    expect(result.category).toBe("Food and Meals");
    expect(result.confidence).toBeGreaterThanOrEqual(70);
  });

  it("Asda → Food and Meals", () => {
    const result = categoriseTransaction(
      makeTx({
        merchant: "Asda Stores",
        description: "Asda Stores",
        amount: -45,
      }),
      ctx
    );
    expect(result.category).toBe("Food and Meals");
    expect(result.confidence).toBeGreaterThanOrEqual(70);
  });

  it("Capital On Tap → Credit Card Payment or Transfer", () => {
    const result = categoriseTransaction(
      makeTx({
        merchant: "Capital On Tap",
        description: "Capital On Tap",
        amount: -500,
      }),
      ctx
    );
    expect(["Credit Card Payment", "Transfers"]).toContain(result.category);
    expect(result.confidence).toBeGreaterThanOrEqual(80);
  });

  it("Revolut Fee → Bank Fees", () => {
    const result = categoriseTransaction(
      makeTx({
        merchant: "Revolut",
        description: "Revolut Business Fee",
        amount: -2.99,
        isFee: true,
      }),
      ctx
    );
    expect(result.category).toBe("Bank Fees");
    expect(result.confidence).toBeGreaterThanOrEqual(80);
  });

  it("Internal transfer → Transfer", () => {
    const result = categoriseTransaction(
      makeTx({
        description: "From British Pound",
        amount: -100,
        transactionType: "TRANSFER",
      }),
      ctx
    );
    expect(result.category).toBe("Transfers");
    expect(result.confidence).toBeGreaterThanOrEqual(70);
  });

  it("Marketing Commission → Sales Commission", () => {
    const result = categoriseTransaction(
      makeTx({
        description: "Marketing Commission",
        amount: -300,
      }),
      ctx
    );
    expect(result.category).toBe("Sales Commission");
    expect(result.confidence).toBeGreaterThanOrEqual(70);
  });

  it("Sales Rep Commission → Sales Commission", () => {
    const result = categoriseTransaction(
      makeTx({
        description: "Sales Rep Commission",
        amount: -200,
      }),
      ctx
    );
    expect(result.category).toBe("Sales Commission");
    expect(result.confidence).toBeGreaterThanOrEqual(70);
  });

  it("Director Consultancy Fee → Professional Services", () => {
    const result = categoriseTransaction(
      makeTx({
        description: "Director Consultancy Fee",
        amount: -2500,
      }),
      ctx
    );
    expect(result.category).toBe("Professional Services");
    expect(result.confidence).toBeGreaterThanOrEqual(70);
  });

  it("Apple.com → Software", () => {
    const result = categoriseTransaction(
      makeTx({
        merchant: "Apple.com",
        description: "Apple.com",
        amount: -29.99,
      }),
      ctx
    );
    expect(result.category).toBe("Software");
    expect(result.confidence).toBeGreaterThanOrEqual(70);
  });

  it("Klarna*amazon → Amazon office cost with Klarna as payment context", () => {
    const result = categoriseTransaction(
      makeTx({
        merchant: "Klarna*amazon",
        description: "Klarna*amazon",
        amount: -89.99,
      }),
      ctx
    );
    expect(result.category).toBe("Office Costs");
    expect(result.normalisedMerchant).toBe("Amazon");
    expect(result.reason).not.toContain("Payment Processor Fees");
    expect(result.confidence).toBeGreaterThanOrEqual(70);
  });
});
