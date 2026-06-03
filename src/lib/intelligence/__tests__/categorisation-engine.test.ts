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

function makeContext(model: BusinessContext["model"], rules = []): BusinessContext {
  return { model, userRules: rules };
}

describe("UniversalCategorisationEngine", () => {
  // ─── SaaS Business Tests ────────────────────────────────────────────
  describe("SaaS business", () => {
    const ctx = makeContext("saas");

    it("categorises AWS as Cloud Infrastructure", () => {
      const result = categoriseTransaction(makeTx({ merchant: "AWS", description: "AWS EMEA", amount: -450 }), ctx);
      expect(result.category).toBe("Cloud Infrastructure");
      expect(result.confidence).toBeGreaterThanOrEqual(90);
      expect(result.reason).toContain("AWS");
    });

    it("categorises Stripe payout as Revenue", () => {
      const result = categoriseTransaction(makeTx({ merchant: "Stripe", description: "Stripe payout", amount: 5000, type: "income" }), ctx);
      expect(result.category).toBe("Revenue");
      expect(result.confidence).toBeGreaterThanOrEqual(85);
    });

    it("categorises Stripe fee as Payment Processor Fees", () => {
      const result = categoriseTransaction(makeTx({ merchant: "Stripe", description: "Stripe fee", amount: -25 }), ctx);
      expect(result.category).toBe("Payment Processor Fees");
    });

    it("categorises OpenAI as AI Tools", () => {
      const result = categoriseTransaction(makeTx({ merchant: "OpenAI", description: "OpenAI API", amount: -120 }), ctx);
      expect(result.category).toBe("AI Tools");
      expect(result.confidence).toBeGreaterThanOrEqual(90);
    });

    it("categorises Slack as Software", () => {
      const result = categoriseTransaction(makeTx({ merchant: "Slack", description: "Slack Technologies", amount: -15 }), ctx);
      expect(result.category).toBe("Software");
    });

    it("categorises Google Ads as Advertising", () => {
      const result = categoriseTransaction(makeTx({ merchant: "Google", description: "Google Ads", amount: -500 }), ctx);
      expect(result.category).toBe("Advertising");
    });

    it("categorises GitHub as Software", () => {
      const result = categoriseTransaction(makeTx({ merchant: "GitHub", description: "GitHub Inc", amount: -4 }), ctx);
      expect(result.category).toBe("Software");
    });

    it("categorises commission as Sales and Marketing", () => {
      const result = categoriseTransaction(makeTx({ merchant: "Unknown", description: "Affiliate Commission Payout", amount: -800 }), ctx);
      expect(result.category).toBe("Sales and Marketing");
      expect(result.confidence).toBeGreaterThanOrEqual(70);
    });

    it("categorises consultancy fee as Professional Services", () => {
      const result = categoriseTransaction(makeTx({ merchant: "Unknown", description: "Director Consultancy Fee", amount: -2500 }), ctx);
      expect(result.category).toBe("Professional Services");
    });

    it("categorises salary as Payroll", () => {
      const result = categoriseTransaction(makeTx({ merchant: "Unknown", description: "Monthly Salary Payment", amount: -3500 }), ctx);
      expect(result.category).toBe("Payroll");
    });
  });

  // ─── Ecommerce Business Tests ──────────────────────────────────────
  describe("Ecommerce business", () => {
    const ctx = makeContext("ecommerce");

    it("categorises Shopify payout as Revenue", () => {
      const result = categoriseTransaction(makeTx({ merchant: "Shopify", description: "Shopify payout", amount: 8000, type: "income" }), ctx);
      expect(result.category).toBe("Revenue");
    });

    it("categorises Shopify subscription as Software", () => {
      const result = categoriseTransaction(makeTx({ merchant: "Shopify", description: "Shopify monthly", amount: -79 }), ctx);
      expect(result.category).toBe("Software");
    });

    it("categorises supplier payment as COGS", () => {
      const result = categoriseTransaction(makeTx({ merchant: "Supplier Ltd", description: "Supplier payment INV-001", amount: -5000 }), ctx);
      expect(result.category).toBe("COGS");
    });

    it("categorises shipping cost as Shipping and Fulfilment", () => {
      const result = categoriseTransaction(makeTx({ merchant: "DHL", description: "DHL Express shipping", amount: -45 }), ctx);
      expect(result.category).toBe("Shipping and Fulfilment");
    });

    it("categorises Amazon income as Revenue", () => {
      const result = categoriseTransaction(makeTx({ merchant: "Amazon", description: "Amazon marketplace payout", amount: 12000, type: "income" }), ctx);
      expect(result.category).toBe("Revenue");
    });

    it("categorises inventory purchase as COGS", () => {
      const result = categoriseTransaction(makeTx({ merchant: "Wholesaler", description: "Inventory purchase", amount: -8000 }), ctx);
      expect(result.category).toBe("COGS");
    });

    it("categorises ad spend as Advertising", () => {
      const result = categoriseTransaction(makeTx({ merchant: "Meta", description: "Facebook Ads campaign", amount: -2000 }), ctx);
      expect(result.category).toBe("Advertising");
    });
  });

  // ─── Services Business Tests ───────────────────────────────────────
  describe("Services business", () => {
    const ctx = makeContext("services");

    it("categorises client payment as Revenue", () => {
      const result = categoriseTransaction(makeTx({ merchant: "Client ABC", description: "Client payment for services", amount: 5000, type: "income" }), ctx);
      expect(result.category).toBe("Revenue");
    });

    it("categorises contractor payment as Contractors", () => {
      const result = categoriseTransaction(makeTx({ merchant: "Freelancer", description: "Contractor payment - web design", amount: -2000 }), ctx);
      expect(result.category).toBe("Contractors");
    });

    it("categorises Xero as Professional Services", () => {
      const result = categoriseTransaction(makeTx({ merchant: "Xero", description: "Xero Ltd monthly", amount: -30 }), ctx);
      expect(result.category).toBe("Professional Services");
    });

    it("categorises training as Training and Education", () => {
      const result = categoriseTransaction(makeTx({ merchant: "Udemy", description: "Udemy course purchase", amount: -15 }), ctx);
      expect(result.category).toBe("Training and Education");
    });
  });

  // ─── Consultancy Business Tests ────────────────────────────────────
  describe("Consultancy business", () => {
    const ctx = makeContext("consultancy");

    it("categorises consultancy income as Revenue", () => {
      const result = categoriseTransaction(makeTx({ merchant: "Client Corp", description: "Consultancy fee payment", amount: 10000, type: "income" }), ctx);
      expect(result.category).toBe("Revenue");
    });

    it("categorises consultancy expense as Professional Services", () => {
      const result = categoriseTransaction(makeTx({ merchant: "Expert Ltd", description: "External consultancy fee", amount: -3000 }), ctx);
      expect(result.category).toBe("Professional Services");
    });

    it("categorises office rent as Office Costs", () => {
      const result = categoriseTransaction(makeTx({ merchant: "Landlord", description: "Office rent payment", amount: -2500 }), ctx);
      expect(result.category).toBe("Office Costs");
    });
  });

  // ─── Agency Business Tests ─────────────────────────────────────────
  describe("Agency business", () => {
    const ctx = makeContext("agency");

    it("categorises retainer income as Revenue", () => {
      const result = categoriseTransaction(makeTx({ merchant: "Brand Client", description: "Monthly retainer", amount: 5000, type: "income" }), ctx);
      expect(result.category).toBe("Revenue");
    });

    it("categorises SEMrush as Marketing", () => {
      const result = categoriseTransaction(makeTx({ merchant: "SEMrush", description: "SEMrush subscription", amount: -120 }), ctx);
      expect(result.category).toBe("Marketing");
    });

    it("categorises ad spend as Advertising with boost", () => {
      const result = categoriseTransaction(makeTx({ merchant: "Meta", description: "Facebook Ads", amount: -3000 }), ctx);
      expect(result.category).toBe("Advertising");
      // Agency model boosts Advertising by 15
      expect(result.confidence).toBeGreaterThanOrEqual(90);
    });

    it("categorises contractor payment as Contractors", () => {
      const result = categoriseTransaction(makeTx({ merchant: "Freelancer", description: "Freelancer payment", amount: -1500 }), ctx);
      expect(result.category).toBe("Contractors");
    });
  });

  // ─── Physical Products Business Tests ──────────────────────────────
  describe("Physical products business", () => {
    const ctx = makeContext("physical_products");

    it("categorises raw materials as COGS", () => {
      const result = categoriseTransaction(makeTx({ merchant: "Supplier", description: "Raw materials purchase", amount: -5000 }), ctx);
      expect(result.category).toBe("COGS");
    });

    it("categorises Royal Mail as Shipping and Fulfilment", () => {
      const result = categoriseTransaction(makeTx({ merchant: "Royal Mail", description: "Postage and shipping", amount: -200 }), ctx);
      expect(result.category).toBe("Shipping and Fulfilment");
    });

    it("categorises warehouse as Shipping and Fulfilment", () => {
      const result = categoriseTransaction(makeTx({ merchant: "Warehouse Ltd", description: "Warehouse storage fee", amount: -800 }), ctx);
      expect(result.category).toBe("Shipping and Fulfilment");
    });
  });

  // ─── Credit Card / Transfer Tests ──────────────────────────────────
  describe("credit card and transfer detection", () => {
    const ctx = makeContext("mixed");

    it("detects Capital On Tap as credit card repayment", () => {
      const result = categoriseTransaction(makeTx({ merchant: "Capital On Tap", description: "Capital On Tap payment", amount: -500 }), ctx);
      expect(result.category).toBe("Credit Card Payment");
      expect(result.isTransfer).toBe(true);
    });

    it("detects Amex as credit card repayment", () => {
      const result = categoriseTransaction(makeTx({ merchant: "Amex", description: "American Express payment", amount: -1500 }), ctx);
      expect(result.category).toBe("Credit Card Payment");
    });

    it("detects internal transfer as Transfer", () => {
      const result = categoriseTransaction(makeTx({ merchant: "", description: "Transfer to savings account", amount: -2000 }), ctx);
      expect(result.category).toBe("Transfers");
    });

    it("detects owner drawing as Owner Drawings", () => {
      const result = categoriseTransaction(makeTx({ merchant: "", description: "Owner drawing", amount: -3000 }), ctx);
      expect(result.category).toBe("Owner Drawings");
    });
  });

  // ─── Direction-Aware Tests ─────────────────────────────────────────
  describe("direction-aware categorisation", () => {
    const ctx = makeContext("mixed");

    it("Stripe incoming = Revenue", () => {
      const result = categoriseTransaction(makeTx({ merchant: "Stripe", description: "Stripe", amount: 5000, type: "income" }), ctx);
      expect(result.category).toBe("Revenue");
    });

    it("Stripe outgoing = Payment Processor Fees", () => {
      const result = categoriseTransaction(makeTx({ merchant: "Stripe", description: "Stripe", amount: -50, type: "expense" }), ctx);
      expect(result.category).toBe("Payment Processor Fees");
    });

    it("Amazon incoming = Revenue", () => {
      const result = categoriseTransaction(makeTx({ merchant: "Amazon", description: "Amazon", amount: 8000, type: "income" }), ctx);
      expect(result.category).toBe("Revenue");
    });

    it("Amazon outgoing = Office Costs", () => {
      const result = categoriseTransaction(makeTx({ merchant: "Amazon", description: "Amazon", amount: -50, type: "expense" }), ctx);
      expect(result.category).toBe("Office Costs");
    });
  });

  // ─── User Rules Tests ──────────────────────────────────────────────
  describe("user correction rules", () => {
    const ctx = makeContext("saas", [
      { merchantPattern: "CustomVendor", category: "Custom Category", confidenceBoost: 20 },
    ]);

    it("applies user rule when merchant matches", () => {
      const result = categoriseTransaction(makeTx({ merchant: "CustomVendor", description: "Payment", amount: -100 }), ctx);
      expect(result.category).toBe("Custom Category");
      expect(result.confidence).toBeGreaterThanOrEqual(85);
    });
  });

  // ─── Explanation Tests ─────────────────────────────────────────────
  describe("explanations", () => {
    const ctx = makeContext("saas");

    it("provides reason for known merchant", () => {
      const result = categoriseTransaction(makeTx({ merchant: "AWS", description: "AWS", amount: -300 }), ctx);
      expect(result.reason).toContain("AWS");
      expect(result.reason).toContain("Cloud Infrastructure");
    });

    it("provides reason for keyword match", () => {
      const result = categoriseTransaction(makeTx({ merchant: "", description: "Affiliate Commission Payout", amount: -500 }), ctx);
      expect(result.reason.toLowerCase()).toContain("commission");
    });

    it("explains why Uncategorised Review when unclear", () => {
      const result = categoriseTransaction(makeTx({ merchant: "", description: "", reference: "", amount: -100 }), ctx);
      expect(result.category).toBe("Uncategorised Review");
      expect(result.confidence).toBe(0);
      expect(result.status).toBe("needs_review");
    });
  });

  // ─── Confidence Tests ──────────────────────────────────────────────
  describe("confidence scoring", () => {
    const ctx = makeContext("mixed");

    it("gives high confidence for known merchant exact match", () => {
      const result = categoriseTransaction(makeTx({ merchant: "AWS", amount: -200 }), ctx);
      expect(result.confidence).toBeGreaterThanOrEqual(90);
    });

    it("gives medium confidence for keyword match", () => {
      const result = categoriseTransaction(makeTx({ merchant: "", description: "consultancy fee", amount: -500 }), ctx);
      expect(result.confidence).toBeGreaterThanOrEqual(70);
      expect(result.confidence).toBeLessThan(90);
    });

    it("never gives 100 for Uncategorised Review", () => {
      const result = categoriseTransaction(makeTx({ merchant: "", description: "", amount: -100 }), ctx);
      expect(result.category).toBe("Uncategorised Review");
      expect(result.confidence).toBe(0);
    });

    it("marks needs_review when confidence < 70", () => {
      const result = categoriseTransaction(makeTx({ merchant: "", description: "some unclear thing", amount: -100 }), ctx);
      if (result.confidence < 70) {
        expect(result.status).toBe("needs_review");
      }
    });
  });

  // ─── Specific User's Problematic Merchants ─────────────────────────
  describe("user's problematic merchants", () => {
    const ctx = makeContext("mixed");

    it("Eventsconnecter → Software", () => {
      const result = categoriseTransaction(makeTx({ merchant: "Eventsconnecter", description: "Eventsconnecter payment", amount: -150 }), ctx);
      expect(result.category).toBe("Software");
    });

    it("Highlevel Inc → Software", () => {
      const result = categoriseTransaction(makeTx({ merchant: "Highlevel Inc", description: "Highlevel Agency Sub", amount: -297 }), ctx);
      expect(result.category).toBe("Software");
      expect(result.confidence).toBeGreaterThanOrEqual(85);
    });

    it("Marketing Commission → Professional Services", () => {
      const result = categoriseTransaction(makeTx({ merchant: "", description: "Marketing Commission Payout", amount: -600 }), ctx);
      expect(result.category).toBe("Professional Services");
    });

    it("Apple.com → Software", () => {
      const result = categoriseTransaction(makeTx({ merchant: "Apple.com", description: "Apple.com", amount: -29.99 }), ctx);
      expect(result.category).toBe("Software");
    });

    it("Stripe Account Top up → Revenue", () => {
      const result = categoriseTransaction(makeTx({ merchant: "Stripe", description: "Stripe Account Top up", amount: 5000, type: "income" }), ctx);
      expect(result.category).toBe("Revenue");
    });

    it("Director Consultancy Fee → Professional Services", () => {
      const result = categoriseTransaction(makeTx({ merchant: "", description: "Director Consultancy Fee", amount: -2500 }), ctx);
      expect(result.category).toBe("Professional Services");
    });

    it("Capital On Tap → Credit Card Payment", () => {
      const result = categoriseTransaction(makeTx({ merchant: "Capital On Tap", description: "Capital On Tap", amount: -500 }), ctx);
      expect(result.category).toBe("Credit Card Payment");
    });
  });
});
