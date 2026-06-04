import { classifyReportingTreatment, type ReportingTreatment } from "@/lib/reporting/treatment-engine";
import type { AccountKpiRouting, ConnectedAccountType } from "./types";

export const ACCOUNT_KPI_ROUTING: Record<ConnectedAccountType, AccountKpiRouting> = {
  business_current: {
    includedInRevenue: true,
    includedInExpenses: true,
    includedInCashFlow: true,
    includedInCashMovement: true,
    includedInProfitAndLoss: true,
    includedInBalanceSheetMovement: true,
    includedInDebtTracking: false,
    includedInOwnerMovement: true,
    includedInDataQuality: true,
    includedInAuditTrail: true,
    cashBalanceSource: true,
    explanation: "Business current accounts are the primary operating cash source for revenue, expenses, transfers, fees, and cash balance.",
  },
  business_savings: {
    includedInRevenue: false,
    includedInExpenses: false,
    includedInCashFlow: false,
    includedInCashMovement: true,
    includedInProfitAndLoss: false,
    includedInBalanceSheetMovement: true,
    includedInDebtTracking: false,
    includedInOwnerMovement: false,
    includedInDataQuality: true,
    includedInAuditTrail: true,
    cashBalanceSource: true,
    explanation: "Business savings accounts power cash balance and cash movement. Transfers are not operating revenue; genuine interest can be treated as revenue.",
  },
  business_credit_card: {
    includedInRevenue: false,
    includedInExpenses: true,
    includedInCashFlow: false,
    includedInCashMovement: false,
    includedInProfitAndLoss: true,
    includedInBalanceSheetMovement: true,
    includedInDebtTracking: true,
    includedInOwnerMovement: false,
    includedInDataQuality: true,
    includedInAuditTrail: true,
    cashBalanceSource: false,
    explanation: "Credit card purchases feed expenses and debt. Repayments reduce debt and must not double count as operating spend.",
  },
  loan: {
    includedInRevenue: false,
    includedInExpenses: false,
    includedInCashFlow: false,
    includedInCashMovement: false,
    includedInProfitAndLoss: false,
    includedInBalanceSheetMovement: true,
    includedInDebtTracking: true,
    includedInOwnerMovement: false,
    includedInDataQuality: true,
    includedInAuditTrail: true,
    cashBalanceSource: false,
    explanation: "Loan accounts power debt tracking and balance sheet movement. Principal repayments are not normal operating expenses.",
  },
  payment_processor: {
    includedInRevenue: true,
    includedInExpenses: true,
    includedInCashFlow: false,
    includedInCashMovement: false,
    includedInProfitAndLoss: true,
    includedInBalanceSheetMovement: false,
    includedInDebtTracking: false,
    includedInOwnerMovement: false,
    includedInDataQuality: true,
    includedInAuditTrail: true,
    cashBalanceSource: false,
    explanation: "Processor feeds can be the richest source for gross sales, refunds, and fees. Bank payouts should become settlement movement to avoid double counting.",
  },
  manual: {
    includedInRevenue: true,
    includedInExpenses: true,
    includedInCashFlow: true,
    includedInCashMovement: true,
    includedInProfitAndLoss: true,
    includedInBalanceSheetMovement: false,
    includedInDebtTracking: false,
    includedInOwnerMovement: false,
    includedInDataQuality: true,
    includedInAuditTrail: true,
    cashBalanceSource: false,
    explanation: "Manual rows use normal transaction treatment and remain audit-visible.",
  },
  unknown: {
    includedInRevenue: false,
    includedInExpenses: false,
    includedInCashFlow: false,
    includedInCashMovement: true,
    includedInProfitAndLoss: false,
    includedInBalanceSheetMovement: false,
    includedInDebtTracking: false,
    includedInOwnerMovement: false,
    includedInDataQuality: true,
    includedInAuditTrail: true,
    cashBalanceSource: false,
    explanation: "Unknown account types are held out of operating KPIs until the user confirms account routing.",
  },
};

export interface ConnectedTreatmentInput {
  accountType: ConnectedAccountType;
  type: "income" | "expense";
  amount: number;
  category?: string;
  merchant?: string;
  description?: string;
  reference?: string;
  transactionType?: string;
  sourceProvider?: string;
  metadata?: Record<string, unknown>;
}

function textFor(input: ConnectedTreatmentInput): string {
  return [
    input.accountType,
    input.category,
    input.merchant,
    input.description,
    input.reference,
    input.transactionType,
  ].filter(Boolean).join(" ").toLowerCase();
}

function rawTextFor(input: ConnectedTreatmentInput): string {
  return [
    input.merchant,
    input.description,
    input.reference,
    input.transactionType,
  ].filter(Boolean).join(" ").toLowerCase();
}

function hasAny(text: string, needles: string[]): boolean {
  return needles.some((needle) => text.includes(needle));
}

function operatingCategory(category?: string): string | undefined {
  if (!category) return undefined;
  if (["Credit Card Payment", "Internal Transfer", "International Transfer", "Money Transfer", "Transfers"].includes(category)) {
    return undefined;
  }
  return category;
}

export function getAccountKpiRouting(accountType: ConnectedAccountType): AccountKpiRouting {
  return ACCOUNT_KPI_ROUTING[accountType] ?? ACCOUNT_KPI_ROUTING.unknown;
}

export function classifyConnectedAccountTreatment(input: ConnectedTreatmentInput): ReportingTreatment {
  const text = textFor(input);

  if (input.accountType === "unknown") {
    return classifyReportingTreatment({
      ...input,
      category: "Uncategorised Review",
      status: "needs_review",
      kpiExcluded: true,
      kpiExclusionReason: "account_routing_unconfirmed",
      metadata: {
        ...input.metadata,
        account_type: input.accountType,
        kpi_exclusion_reason: "account_routing_unconfirmed",
      },
    });
  }

  if (input.accountType === "business_savings") {
    if (input.type === "income" && hasAny(rawTextFor(input), ["interest", "gross interest", "credit interest"])) {
      return classifyReportingTreatment({
        ...input,
        category: "Revenue",
        metadata: { ...input.metadata, account_type: input.accountType, connected_account_signal: "savings_interest" },
      });
    }

    return classifyReportingTreatment({
      ...input,
      category: "Internal Transfer",
      kpiExcluded: true,
      kpiExclusionReason: "internal_transfer",
      metadata: { ...input.metadata, account_type: input.accountType, connected_account_signal: "savings_transfer" },
    });
  }

  if (input.accountType === "business_credit_card") {
    const rawText = rawTextFor(input);
    if (input.type === "income" && hasAny(rawText, ["payment received", "repayment", "direct debit payment", "autopay", "capital one payment"])) {
      return classifyReportingTreatment({
        ...input,
        category: "Credit Card Payment",
        kpiExcluded: true,
        kpiExclusionReason: "credit_card_repayment",
        metadata: { ...input.metadata, account_type: input.accountType, connected_account_signal: "card_repayment" },
      });
    }

    return classifyReportingTreatment({
      ...input,
      category: operatingCategory(input.category) ?? "Card Purchase",
      metadata: { ...input.metadata, account_type: input.accountType, connected_account_signal: "card_purchase" },
    });
  }

  if (input.accountType === "loan") {
    const isFunding = input.type === "income" || hasAny(text, ["loan advance", "loan funding", "drawdown"]);
    return classifyReportingTreatment({
      ...input,
      category: isFunding ? "Loans" : "Loan Repayment",
      kpiExcluded: true,
      kpiExclusionReason: isFunding ? "loans" : "loan_repayment",
      metadata: { ...input.metadata, account_type: input.accountType, connected_account_signal: isFunding ? "loan_funding" : "loan_repayment" },
    });
  }

  if (input.accountType === "payment_processor") {
    if (hasAny(text, ["payout", "transfer to bank", "settlement"])) {
      return classifyReportingTreatment({
        ...input,
        category: "Internal Transfer",
        kpiExcluded: true,
        kpiExclusionReason: "processor_payout_settlement",
        metadata: { ...input.metadata, account_type: input.accountType, connected_account_signal: "processor_settlement" },
      });
    }
    if (hasAny(text, ["fee", "processing fee", "processor fee"])) {
      return classifyReportingTreatment({
        ...input,
        category: "Payment Processor Fees",
        metadata: { ...input.metadata, account_type: input.accountType, connected_account_signal: "processor_fee" },
      });
    }
    if (hasAny(text, ["refund", "chargeback", "dispute"])) {
      return classifyReportingTreatment({
        ...input,
        category: "Refunds",
        metadata: { ...input.metadata, account_type: input.accountType, connected_account_signal: "processor_refund" },
      });
    }
    return classifyReportingTreatment({
      ...input,
      category: input.category ?? "Revenue",
      metadata: { ...input.metadata, account_type: input.accountType, connected_account_signal: "processor_sale" },
    });
  }

  return classifyReportingTreatment({
    ...input,
    metadata: { ...input.metadata, account_type: input.accountType },
  });
}
