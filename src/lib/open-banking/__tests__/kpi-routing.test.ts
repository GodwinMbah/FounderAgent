import { describe, expect, it } from "vitest";
import { classifyConnectedAccountTreatment, getAccountKpiRouting } from "../kpi-routing";

describe("connected account KPI routing", () => {
  it("routes business current accounts into operating KPIs and cash balance", () => {
    const routing = getAccountKpiRouting("business_current");

    expect(routing.includedInRevenue).toBe(true);
    expect(routing.includedInExpenses).toBe(true);
    expect(routing.includedInCashMovement).toBe(true);
    expect(routing.cashBalanceSource).toBe(true);
  });

  it("classifies business current operating spend as expense", () => {
    const treatment = classifyConnectedAccountTreatment({
      accountType: "business_current",
      type: "expense",
      amount: 24.99,
      category: "Software",
      description: "Google Workspace",
      merchant: "Google Workspace",
    });

    expect(treatment.reportingTreatment).toBe("operating_expense");
    expect(treatment.includedInOperatingExpenses).toBe(true);
    expect(treatment.includedInProfitAndLoss).toBe(true);
  });

  it("keeps savings transfers out of revenue while preserving cash movement", () => {
    const treatment = classifyConnectedAccountTreatment({
      accountType: "business_savings",
      type: "income",
      amount: 1000,
      description: "Transfer from business current",
      merchant: "FounderAgent Current Account",
    });

    expect(treatment.reportingTreatment).toBe("internal_transfer");
    expect(treatment.includedInOperatingRevenue).toBe(false);
    expect(treatment.includedInCashMovement).toBe(true);
    expect(treatment.includedInBalanceSheetMovement).toBe(true);
  });

  it("allows genuine savings interest to feed revenue", () => {
    const treatment = classifyConnectedAccountTreatment({
      accountType: "business_savings",
      type: "income",
      amount: 5.22,
      description: "Gross interest",
      merchant: "Bank Interest",
    });

    expect(treatment.includedInOperatingRevenue).toBe(true);
    expect(treatment.reportingTreatment).toBe("operating_revenue");
  });

  it("tracks credit card repayments as debt movement, not expense", () => {
    const treatment = classifyConnectedAccountTreatment({
      accountType: "business_credit_card",
      type: "income",
      amount: 350,
      description: "Payment received thank you",
      merchant: "Capital One",
    });

    expect(treatment.reportingTreatment).toBe("credit_card_repayment");
    expect(treatment.includedInDebtTracking).toBe(true);
    expect(treatment.includedInOperatingExpenses).toBe(false);
    expect(treatment.includedInOperatingRevenue).toBe(false);
  });

  it("treats payment processor settlement payouts as transfers when processor feed is the sales source", () => {
    const treatment = classifyConnectedAccountTreatment({
      accountType: "payment_processor",
      type: "expense",
      amount: 491.76,
      description: "Payout to bank settlement",
      merchant: "Stripe",
    });

    expect(treatment.reportingTreatment).toBe("internal_transfer");
    expect(treatment.includedInOperatingRevenue).toBe(false);
    expect(treatment.kpiExclusionReason).toBe("internal_transfer");
  });

  it("tracks loan repayments as debt movement", () => {
    const treatment = classifyConnectedAccountTreatment({
      accountType: "loan",
      type: "expense",
      amount: 600,
      description: "Loan repayment",
      merchant: "Lender",
    });

    expect(treatment.reportingTreatment).toBe("loan_repayment");
    expect(treatment.includedInDebtTracking).toBe(true);
    expect(treatment.includedInOperatingExpenses).toBe(false);
  });
});
