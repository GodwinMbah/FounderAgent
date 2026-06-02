import { describe, it, expect } from "vitest";
import { categoriseV3, V3Transaction, V3Context } from "../categoriser-v3";

function makeContext(overrides?: Partial<V3Context>): V3Context {
  return {
    businessModel: "saas",
    revenueModels: [],
    costStructure: [],
    userRules: [],
    ...overrides,
  };
}

function makeTx(overrides?: Partial<V3Transaction>): V3Transaction {
  return {
    description: "",
    amount: 100,
    type: "expense",
    ...overrides,
  };
}

describe("categoriseV3", () => {
  it("SaaS context boosts software categories", () => {
    const txs: V3Transaction[] = [
      makeTx({ description: "AWS monthly bill", amount: -250 }),
      makeTx({ description: "OpenAI API usage", amount: -120 }),
    ];
    const context = makeContext({ businessModel: "saas" });
    const results = categoriseV3(txs, context);

    expect(results[0].category).toBe("Cloud Infrastructure");
    expect(results[0].confidence).toBe(100); // 95 base + 5 boost, capped at 100

    expect(results[1].category).toBe("AI Tools");
    expect(results[1].confidence).toBe(100); // 95 base + 5 boost, capped at 100

    expect(results[0].status).toBe("categorised");
    expect(results[1].status).toBe("categorised");
  });

  it("Ecommerce context detects Shopify revenue", () => {
    const txs: V3Transaction[] = [
      makeTx({ description: "Shopify payout", amount: 500, type: "income" }),
    ];
    const context = makeContext({ businessModel: "ecommerce" });
    const results = categoriseV3(txs, context);

    expect(results[0].category).toBe("Revenue");
    expect(results[0].confidence).toBe(95); // reference match, no ecommerce boost for Revenue
    expect(results[0].status).toBe("categorised");
  });

  it("Reference-based Stripe detection", () => {
    const txs: V3Transaction[] = [
      makeTx({ description: "Stripe payout", amount: 1000, type: "income" }),
      makeTx({ description: "Stripe fee", amount: -29, type: "expense" }),
    ];
    const context = makeContext();
    const results = categoriseV3(txs, context);

    expect(results[0].category).toBe("Revenue");
    expect(results[0].reason.toLowerCase()).toContain("stripe");

    expect(results[1].category).toBe("Payment Processor Fees");
    expect(results[1].reason.toLowerCase()).toContain("stripe");
  });

  it("User rules override default patterns", () => {
    const txs: V3Transaction[] = [
      makeTx({ description: "AWS monthly bill", amount: -250 }),
    ];
    // User rule gives 80 + 15 = 95; reference pattern gives 95. Tie goes to reference.
    // But with confidenceBoost 15, user rule = 95, same as reference.
    // We need boost > 15 to make user rule win.
    const context2 = makeContext({
      businessModel: "marketplace", // no Cloud Infrastructure boost
      userRules: [
        { merchantPattern: "aws", category: "Custom Cloud", confidenceBoost: 20 },
      ],
    });
    const results2 = categoriseV3(txs, context2);

    expect(results2[0].category).toBe("Custom Cloud");
    expect(results2[0].confidence).toBe(100); // 80 + 20 = 100
    expect(results2[0].reason).toContain("user rule");
  });

  it("Best-match picks highest confidence", () => {
    const txs: V3Transaction[] = [
      makeTx({ description: "Stripe advertising campaign fee", amount: -29 }),
    ];
    const context = makeContext({
      userRules: [
        { merchantPattern: "stripe", category: "Bank Fees", confidenceBoost: 5 },
      ],
    });
    const results = categoriseV3(txs, context);

    // Reference-based Stripe fee = 95 (highest)
    // User rule = 85
    // Keyword "advertising" = 75
    expect(results[0].category).toBe("Payment Processor Fees");
    expect(results[0].confidence).toBe(95);
  });

  it("Low confidence returns needs_review", () => {
    const txs: V3Transaction[] = [
      makeTx({ description: "Some random cafe", amount: -5 }),
    ];
    const context = makeContext();
    const results = categoriseV3(txs, context);

    expect(results[0].category).toBe("Uncategorised Review");
    expect(results[0].confidence).toBe(0);
    expect(results[0].status).toBe("needs_review");
  });

  it("COGS detection for ecommerce with cogs flag", () => {
    const txs: V3Transaction[] = [
      makeTx({ description: "Inventory restock from supplier", amount: -800 }),
      makeTx({ description: "Wholesale shipment received", amount: -1200 }),
    ];
    const context = makeContext({
      businessModel: "ecommerce",
      costStructure: ["cogs"],
    });
    const results = categoriseV3(txs, context);

    expect(results[0].category).toBe("COGS");
    expect(results[0].confidence).toBe(90); // 85 base + 5 ecommerce boost

    expect(results[1].category).toBe("COGS");
    expect(results[1].confidence).toBe(90); // 85 base + 5 ecommerce boost
  });

  it("Shipping only detected when costStructure includes shipping", () => {
    const txs: V3Transaction[] = [
      makeTx({ description: "FedEx ground shipping", amount: -45 }),
    ];

    const withoutShipping = makeContext({ businessModel: "ecommerce", costStructure: [] });
    const resultsWithout = categoriseV3(txs, withoutShipping);
    expect(resultsWithout[0].category).toBe("Uncategorised Review");

    const withShipping = makeContext({ businessModel: "ecommerce", costStructure: ["shipping"] });
    const resultsWith = categoriseV3(txs, withShipping);
    expect(resultsWith[0].category).toBe("Shipping and Fulfilment");
  });

  it("Ecommerce context boosts shipping, advertising and payment processor fees", () => {
    const txs: V3Transaction[] = [
      makeTx({ description: "DHL express delivery", amount: -60 }),
    ];
    const context = makeContext({
      businessModel: "ecommerce",
      costStructure: ["shipping"],
    });
    const results = categoriseV3(txs, context);

    expect(results[0].category).toBe("Shipping and Fulfilment");
    expect(results[0].confidence).toBe(90); // 85 base + 5 ecommerce boost
  });

  it("Agency context boosts professional services, contractors and advertising", () => {
    const txs: V3Transaction[] = [
      makeTx({ description: "Upwork freelancer payment", amount: -500 }),
    ];
    const context = makeContext({ businessModel: "agency" });
    const results = categoriseV3(txs, context);

    expect(results[0].category).toBe("Contractors");
    expect(results[0].confidence).toBe(90); // 85 base + 5 agency boost
  });

  it("Marketplace context boosts payment processor fees and bank fees", () => {
    const txs: V3Transaction[] = [
      makeTx({ description: "Stripe fee", amount: -29 }),
    ];
    const context = makeContext({ businessModel: "marketplace" });
    const results = categoriseV3(txs, context);

    expect(results[0].category).toBe("Payment Processor Fees");
    expect(results[0].confidence).toBe(100); // 95 base + 5 marketplace boost
  });

  it("Tie-breaking prefers reference over user rules over keywords", () => {
    // Create a scenario where reference and keyword have same boosted confidence
    // but reference should win
    const txs: V3Transaction[] = [
      makeTx({ description: "google ads campaign", amount: -100 }),
    ];
    const context = makeContext({
      businessModel: "agency", // Advertising gets +5 boost
      userRules: [
        { merchantPattern: "google", category: "Custom Ad", confidenceBoost: 10 },
      ],
    });
    const results = categoriseV3(txs, context);

    // Reference match for "google ads" = 95 base + 5 agency boost = 100
    // User rule for "google" = 80 + 10 = 90
    // Keyword "ads" = 75 + 5 agency boost = 80
    expect(results[0].category).toBe("Advertising");
    expect(results[0].reason).toContain("Reference match");
  });
});

describe("categoriseV3 personal name detection", () => {
  it("detects personal name with invoice reference as Revenue", () => {
    const txs: V3Transaction[] = [
      makeTx({ description: "John Smith", amount: 500, reference: "Invoice 123", type: "income" }),
    ];
    const context = makeContext();
    const results = categoriseV3(txs, context);

    expect(results[0].category).toBe("Revenue");
    expect(results[0].reason).toContain("Personal name");
    expect(results[0].status).toBe("ai_suggested"); // 85 confidence
  });

  it("detects personal name with salary reference as Payroll", () => {
    const txs: V3Transaction[] = [
      makeTx({ description: "Jane Doe", amount: -2000, reference: "Monthly salary", type: "expense" }),
    ];
    const context = makeContext();
    const results = categoriseV3(txs, context);

    expect(results[0].category).toBe("Payroll");
    expect(results[0].reason).toContain("salary");
  });

  it("flags unclear personal name for review", () => {
    const txs: V3Transaction[] = [
      makeTx({ description: "Charlie Day", amount: -100, reference: "Random ref", type: "expense" }),
    ];
    const context = makeContext();
    const results = categoriseV3(txs, context);

    expect(results[0].category).toBe("Uncategorised Review");
    expect(results[0].status).toBe("needs_review");
    expect(results[0].reason).toContain("review needed");
  });

  it("does not detect business names as personal names", () => {
    const txs: V3Transaction[] = [
      makeTx({ description: "Smith Limited", amount: -100, type: "expense" }),
    ];
    const context = makeContext();
    const results = categoriseV3(txs, context);

    expect(results[0].category).toBe("Uncategorised Review");
    expect(results[0].status).toBe("needs_review");
  });
});

describe("categoriseV3 direction-aware user rules", () => {
  it("applies direction boost when rule direction matches transaction type", () => {
    const txs: V3Transaction[] = [
      makeTx({ description: "Consulting fee", amount: -500, type: "expense" }),
    ];
    const context = makeContext({
      userRules: [
        {
          merchantPattern: "consulting",
          category: "Professional Services",
          confidenceBoost: 15,
          direction: "expense",
        },
      ],
    });
    const results = categoriseV3(txs, context);

    // Base: 80 + 10 = 90, +10 direction = 100
    expect(results[0].category).toBe("Professional Services");
    expect(results[0].confidence).toBe(100);
    expect(results[0].reason).toContain("user rule");
  });

  it("matches user rule on description pattern", () => {
    const txs: V3Transaction[] = [
      makeTx({ description: "Weekly team lunch", amount: -45, type: "expense" }),
    ];
    const context = makeContext({
      userRules: [
        {
          descriptionPattern: "team lunch",
          category: "Food and Meals",
          confidenceBoost: 10,
        },
      ],
    });
    const results = categoriseV3(txs, context);

    expect(results[0].category).toBe("Food and Meals");
    expect(results[0].reason).toContain("description");
  });

  it("matches user rule on reference pattern", () => {
    const txs: V3Transaction[] = [
      makeTx({ description: "Payment", reference: "REF-9876", amount: -100, type: "expense" }),
    ];
    const context = makeContext({
      userRules: [
        {
          referencePattern: "ref-9876",
          category: "Office Costs",
          confidenceBoost: 10,
        },
      ],
    });
    const results = categoriseV3(txs, context);

    expect(results[0].category).toBe("Office Costs");
    expect(results[0].reason).toContain("reference");
  });

  it("adds bonus confidence for multiple signal matches", () => {
    const txs: V3Transaction[] = [
      makeTx({ description: "Team lunch at cafe", merchant: "Cafe Nero", amount: -45, type: "expense" }),
    ];
    const context = makeContext({
      userRules: [
        {
          merchantPattern: "cafe nero",
          descriptionPattern: "team lunch",
          category: "Food & Drink",
          confidenceBoost: 10,
        },
      ],
    });
    const results = categoriseV3(txs, context);

    // Base: 80 + 10 = 90, +5 bonus for 2 signals = 95
    expect(results[0].category).toBe("Food & Drink");
    expect(results[0].confidence).toBe(95);
  });
});

describe("categoriseV3 credit card payment detection", () => {
  it("detects Capital On Tap as Credit Card Payment", () => {
    const txs: V3Transaction[] = [
      makeTx({ description: "Capital On Tap payment", amount: -500 }),
    ];
    const context = makeContext();
    const results = categoriseV3(txs, context);

    expect(results[0].category).toBe("Credit Card Payment");
    expect(results[0].confidence).toBe(90);
    expect(results[0].status).toBe("categorised");
  });

  it("detects Amex as Credit Card Payment", () => {
    const txs: V3Transaction[] = [
      makeTx({ description: "Amex monthly payment", amount: -1200 }),
    ];
    const context = makeContext();
    const results = categoriseV3(txs, context);

    expect(results[0].category).toBe("Credit Card Payment");
    expect(results[0].confidence).toBe(90);
  });

  it("detects Barclaycard as Credit Card Payment", () => {
    const txs: V3Transaction[] = [
      makeTx({ description: "Barclaycard repayment", amount: -800 }),
    ];
    const context = makeContext();
    const results = categoriseV3(txs, context);

    expect(results[0].category).toBe("Credit Card Payment");
    expect(results[0].confidence).toBe(90);
  });

  it("detects credit card fee as Credit Card Fees", () => {
    const txs: V3Transaction[] = [
      makeTx({ description: "Credit card annual fee", amount: -25 }),
    ];
    const context = makeContext();
    const results = categoriseV3(txs, context);

    expect(results[0].category).toBe("Credit Card Fees");
    expect(results[0].confidence).toBe(85);
  });

  it("detects interest charge as Interest Charges", () => {
    const txs: V3Transaction[] = [
      makeTx({ description: "Card interest charge", amount: -15 }),
    ];
    const context = makeContext();
    const results = categoriseV3(txs, context);

    expect(results[0].category).toBe("Interest Charges");
    expect(results[0].confidence).toBe(85);
  });

  it("does NOT flag generic credit card payment fee as transfer", () => {
    const txs: V3Transaction[] = [
      makeTx({ description: "Credit card payment fee", amount: -5 }),
    ];
    const context = makeContext();
    const results = categoriseV3(txs, context);

    expect(results[0].category).not.toBe("Transfers");
  });
});
