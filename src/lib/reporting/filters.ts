/**
 * Transaction filters — canonical rules for income/expense/transfer detection.
 * Every revenue/expense calculation in the app must use these to stay consistent.
 */

import { getReportingTreatment, getStoredReportingTreatment } from "@/lib/reporting/treatment-engine";
import type { ReportingTreatment } from "@/lib/reporting/treatment-engine";

export interface TransactionLike {
  type: string;
  category?: string;
  tags?: string[];
  rowStatus?: string;
  row_status?: string;
  kpiExcluded?: boolean;
  kpi_excluded?: boolean;
  kpiExclusionReason?: string;
  kpi_exclusion_reason?: string;
  reportingTreatment?: ReportingTreatment;
  metadata?: Record<string, unknown> | null;
}

const TRANSFER_CATEGORIES = new Set([
  "Transfers",
  "Internal Transfer",
  "International Transfer",
  "Money Transfer",
  "Credit Card Payment",
  "Loan Repayment",
  "Owner Drawings",
  "Capital Injection",
  "Loans",
]);

export function isTransfer(t: TransactionLike): boolean {
  const treatment = getStoredReportingTreatment(t);
  if (treatment) {
    return (
      treatment.reportingTreatment === "internal_transfer" ||
      treatment.reportingTreatment === "money_transfer" ||
      treatment.reportingTreatment === "international_transfer" ||
      treatment.includedInDebtTracking ||
      treatment.includedInOwnerMovement
    );
  }

  const metadata = t.metadata ?? {};
  return (
    TRANSFER_CATEGORIES.has(t.category ?? "") ||
    t.rowStatus === "transfer" ||
    t.row_status === "transfer" ||
    t.kpiExclusionReason === "transfer" ||
    t.kpi_exclusion_reason === "transfer" ||
    metadata.row_status === "transfer" ||
    metadata.kpi_exclusion_reason === "transfer" ||
    (Array.isArray(t.tags) && t.tags.includes("transfer"))
  );
}

export function isKpiExcluded(t: TransactionLike): boolean {
  const treatment = getStoredReportingTreatment(t);
  if (treatment) return !treatment.includedInOperatingKpis;

  return !getReportingTreatment(t).includedInOperatingKpis;
}

export function isIncome(t: TransactionLike): boolean {
  return t.type === "income" && getReportingTreatment(t).includedInOperatingRevenue;
}

export function isExpense(t: TransactionLike): boolean {
  return t.type === "expense" && getReportingTreatment(t).includedInOperatingExpenses;
}

export function isCashMovementIn(t: TransactionLike): boolean {
  return t.type === "income" && getReportingTreatment(t).includedInCashMovement;
}

export function isCashMovementOut(t: TransactionLike): boolean {
  return t.type === "expense" && getReportingTreatment(t).includedInCashMovement;
}

export function isCashFlowIn(t: TransactionLike): boolean {
  return t.type === "income" && getReportingTreatment(t).includedInCashFlow;
}

export function isCashFlowOut(t: TransactionLike): boolean {
  return t.type === "expense" && getReportingTreatment(t).includedInCashFlow;
}

const COGS_CATEGORIES = new Set([
  "cogs",
  "cost of goods sold",
  "materials",
  "manufacturing",
  "inventory",
  "production",
  "shipping",
  "shipping and fulfilment",
  "fulfillment",
  "direct labor",
]);

/**
 * Detect whether a transaction is a Cost of Goods Sold (COGS).
 * Transfers are explicitly excluded — they are neither income, expense, nor COGS.
 */
export function isCOGS(t: TransactionLike): boolean {
  if (isTransfer(t)) return false;
  const category = (t.category || "").toLowerCase();
  if (COGS_CATEGORIES.has(category)) return true;
  if (Array.isArray(t.tags)) {
    const lowerTags = t.tags.map((tag) => tag.toLowerCase());
    return lowerTags.some((tag) => COGS_CATEGORIES.has(tag));
  }
  return false;
}
