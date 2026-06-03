import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  classifyReportingTreatment,
  formatReportingTreatment,
} from "@/lib/reporting/treatment-engine";
import { isCashMovementOut, isExpense, isIncome, isTransfer } from "@/lib/reporting/filters";
import { parseUpload } from "@/lib/parser/unified-parser";
import { applyMerchantAndTransferSignals, categoriseCanonicalTransactions } from "@/lib/upload/categorisation-runner";

describe("classifyReportingTreatment", () => {
  it("keeps internal transfers out of operating KPIs but in cash movement", () => {
    const tx = {
      type: "expense",
      category: "Internal Transfer",
      amount: 1000,
      description: "Transfer to Business Savings",
    };
    const treatment = classifyReportingTreatment(tx);

    expect(treatment.includedInOperatingKpis).toBe(false);
    expect(treatment.includedInCashMovement).toBe(true);
    expect(treatment.includedInBalanceSheetMovement).toBe(true);
    expect(treatment.kpiExclusionReason).toBe("internal_transfer");
    expect(isTransfer({ ...tx, metadata: { reporting_treatment: treatment } })).toBe(true);
    expect(isExpense({ ...tx, metadata: { reporting_treatment: treatment } })).toBe(false);
  });

  it("tracks credit card repayments as debt movement, not expense", () => {
    const tx = {
      type: "expense",
      category: "Credit Card Payment",
      amount: 640.28,
      merchant: "Capital On Tap",
      description: "Capital On Tap",
    };
    const treatment = classifyReportingTreatment(tx);

    expect(treatment.reportingTreatment).toBe("credit_card_repayment");
    expect(treatment.includedInDebtTracking).toBe(true);
    expect(treatment.includedInOperatingExpenses).toBe(false);
    expect(isCashMovementOut({ ...tx, metadata: { reporting_treatment: treatment } })).toBe(true);
    expect(isExpense({ ...tx, metadata: { reporting_treatment: treatment } })).toBe(false);
  });

  it("tracks loan repayments as debt movement, not expense", () => {
    const treatment = classifyReportingTreatment({
      type: "expense",
      category: "Loan Repayment",
      amount: 489.86,
      merchant: "Moneyway",
      description: "Moneyway",
    });

    expect(treatment.reportingTreatment).toBe("loan_repayment");
    expect(treatment.includedInDebtTracking).toBe(true);
    expect(treatment.includedInProfitAndLoss).toBe(false);
  });

  it("keeps owner drawings out of profit and loss", () => {
    const treatment = classifyReportingTreatment({
      type: "expense",
      category: "Owner Drawings",
      amount: 1500,
      description: "Director loan repayment",
    });

    expect(treatment.includedInOwnerMovement).toBe(true);
    expect(treatment.includedInProfitAndLoss).toBe(false);
    expect(treatment.includedInCashMovement).toBe(true);
  });

  it("keeps capital injections out of operating revenue", () => {
    const treatment = classifyReportingTreatment({
      type: "income",
      category: "Capital Injection",
      amount: 10000,
      description: "Founder capital injection",
    });

    expect(treatment.reportingTreatment).toBe("capital_injection");
    expect(treatment.includedInOperatingRevenue).toBe(false);
    expect(treatment.includedInOwnerMovement).toBe(true);
    expect(treatment.includedInCashMovement).toBe(true);
  });

  it("treats Stripe Revolut TOPUP income as operating revenue even if a broad category is stale", () => {
    const tx = {
      type: "income",
      category: "Transfers",
      amount: 491.76,
      transactionType: "TOPUP",
      description: "Money added from STRIPE PAYMENTS UK LTD",
      reference: "STRIPE",
      merchant: "Stripe Payments UK LTD",
    };
    const treatment = classifyReportingTreatment(tx);

    expect(treatment.reportingTreatment).toBe("payment_processor_payout");
    expect(treatment.category).toBe("Revenue");
    expect(treatment.includedInOperatingRevenue).toBe(true);
    expect(isIncome({ ...tx, metadata: { reporting_treatment: treatment } })).toBe(true);
    expect(isTransfer({ ...tx, metadata: { reporting_treatment: treatment } })).toBe(false);
  });

  it.each([
    ["PayPal", "Money added from PayPal payout"],
    ["Shopify", "Shopify Payments payout"],
  ])("treats %s payouts as operating revenue", (merchant, description) => {
    const treatment = classifyReportingTreatment({
      type: "income",
      amount: 250,
      transactionType: "TOPUP",
      merchant,
      description,
    });

    expect(treatment.includedInOperatingRevenue).toBe(true);
    expect(treatment.includedInCashFlow).toBe(true);
  });

  it.each([
    ["Refunds", "Customer refund"],
    ["Tax", "HMRC VAT payment"],
    ["Bank Fees", "Revolut Business Fee"],
    ["Software", "Claude.ai Subscription"],
    ["Advertising", "Facebook ads"],
    ["Contractors", "Marketing Agency Freelance Fee"],
    ["Sales Commission", "Sales Rep Commission Fee"],
    ["Payroll", "Monthly payroll"],
    ["Inventory", "Inventory purchase"],
    ["COGS", "Cost of goods sold"],
    ["Shipping", "Shipping and fulfilment"],
  ])("keeps %s in operating P&L when it is an expense", (category, description) => {
    const treatment = classifyReportingTreatment({
      type: "expense",
      category,
      amount: 100,
      description,
    });

    expect(treatment.includedInOperatingExpenses).toBe(true);
    expect(treatment.includedInProfitAndLoss).toBe(true);
    expect(treatment.includedInCashFlow).toBe(true);
  });

  it("marks tax rows for tax reporting", () => {
    const treatment = classifyReportingTreatment({
      type: "expense",
      category: "Tax",
      amount: 1160.33,
      description: "To HMRC Shipley",
    });

    expect(treatment.includedInTaxReporting).toBe(true);
    expect(formatReportingTreatment(treatment)).toContain("KPI included");
  });

  it("keeps duplicate and ambiguous rows in data quality reporting", () => {
    const duplicate = classifyReportingTreatment({
      type: "income",
      category: "Revenue",
      amount: 100,
      isPossibleDuplicate: true,
    });
    const ambiguous = classifyReportingTreatment({
      type: "expense",
      category: "Ambiguous",
      amount: 50,
      status: "needs_review",
    });

    expect(duplicate.reportingTreatment).toBe("duplicate_row");
    expect(duplicate.includedInDataQualityReporting).toBe(true);
    expect(duplicate.includedInOperatingKpis).toBe(false);
    expect(ambiguous.includedInDataQualityReporting).toBe(true);
    expect(ambiguous.includedInOperatingKpis).toBe(false);
  });
});

describe("reporting treatment on the real 694-row Revolut file", () => {
  it("classifies every parsed row and keeps Stripe TOPUP rows as GBP operating revenue", () => {
    const csv = readFileSync(join(process.cwd(), "test_data/csv/revolut_694.csv"), "utf8");
    const result = parseUpload(csv, {
      companyId: "test-company",
      companyCurrency: "GBP",
      companyCountry: "GB",
      uploadId: "test-upload",
    });

    expect(result.transactions).toHaveLength(694);

    applyMerchantAndTransferSignals(result.transactions);
    categoriseCanonicalTransactions(result.transactions, null);

    expect(result.transactions.every((tx) => tx.reportingTreatment)).toBe(true);
    expect(new Set(result.transactions.map((tx) => tx.currency))).toEqual(new Set(["GBP"]));

    const stripeTopups = result.transactions.filter((tx) =>
      `${tx.transactionType ?? ""} ${tx.description} ${tx.reference ?? ""}`.toLowerCase().includes("stripe")
    );
    expect(stripeTopups.length).toBeGreaterThan(50);
    expect(stripeTopups.every((tx) => tx.reportingTreatment?.includedInOperatingRevenue)).toBe(true);
    expect(stripeTopups.every((tx) => tx.category === "Revenue")).toBe(true);
    expect(stripeTopups.every((tx) => tx.isTransfer === false)).toBe(true);

    const debtRows = result.transactions.filter((tx) => tx.reportingTreatment?.includedInDebtTracking);
    expect(debtRows.length).toBeGreaterThanOrEqual(5);
    expect(debtRows.every((tx) => !tx.reportingTreatment?.includedInOperatingExpenses)).toBe(true);

    const dataQualityRows = result.transactions.filter((tx) => tx.reportingTreatment?.includedInDataQualityReporting);
    expect(dataQualityRows.length).toBeGreaterThan(0);
  });
});
