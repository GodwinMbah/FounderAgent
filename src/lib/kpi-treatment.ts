export const TRANSFER_STYLE_CATEGORIES = new Set([
  "Transfers",
  "Internal Transfer",
  "International Transfer",
  "Money Transfer",
  "Credit Card Payment",
  "Loan Repayment",
  "Owner Drawings",
]);

export const KPI_EXCLUDED_CATEGORIES = new Set([
  ...TRANSFER_STYLE_CATEGORIES,
  "Capital Injection",
  "Loans",
  "Ambiguous",
  "Uncategorised Review",
  "Needs Review",
]);

export function isTransferStyleCategory(category?: string): boolean {
  return TRANSFER_STYLE_CATEGORIES.has(category ?? "");
}

export function isKpiExcludedCategory(category?: string): boolean {
  return KPI_EXCLUDED_CATEGORIES.has(category ?? "");
}

export function getKpiExclusionReasonForCategory(category?: string): string | undefined {
  if (!category) return undefined;
  if (category === "Credit Card Payment") return "credit_card_repayment";
  if (category === "Loan Repayment") return "loan_repayment";
  if (category === "Internal Transfer") return "internal_transfer";
  if (category === "International Transfer") return "international_transfer";
  if (category === "Money Transfer" || category === "Transfers") return "transfer";
  if (category === "Owner Drawings") return "owner_drawings";
  if (category === "Ambiguous" || category === "Uncategorised Review" || category === "Needs Review") return "needs_review";
  if (isKpiExcludedCategory(category)) return category.toLowerCase().replace(/\s+/g, "_");
  return undefined;
}

export function formatKpiExclusionReason(reason?: string | null, category?: string | null): string {
  const categoryReason = getKpiExclusionReasonForCategory(category || undefined);
  const rawReason = reason && reason !== "transfer" && reason !== "kpi_excluded"
    ? reason
    : categoryReason ?? reason;
  const normalized = (rawReason || "non_operating_movement")
    .toLowerCase()
    .replace(/\s+/g, "_");

  const labels: Record<string, string> = {
    duplicate: "Duplicate row",
    duplicate_skipped: "Duplicate row",
    transfer: "Transfer movement",
    internal_transfer: "Internal transfer",
    international_transfer: "International transfer",
    money_transfer: "Money transfer",
    credit_card_payment: "Credit card repayment",
    credit_card_repayment: "Credit card repayment",
    loan_repayment: "Loan repayment",
    owner_drawings: "Owner drawings",
    capital_injection: "Capital movement",
    loans: "Loan movement",
    needs_review: "Needs review before KPI use",
    kpi_excluded: "Non operating movement",
    non_operating_movement: "Non operating movement",
  };

  return labels[normalized] ?? normalized
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function describeKpiTreatment(input: {
  kpiTreatment?: "included" | "excluded";
  kpiExcluded?: boolean;
  kpiExclusionReason?: string | null;
  category?: string | null;
}): string {
  const excluded = input.kpiTreatment === "excluded" || input.kpiExcluded === true || isKpiExcludedCategory(input.category ?? undefined);
  if (!excluded) return "Included in KPIs";
  return `KPI excluded: ${formatKpiExclusionReason(input.kpiExclusionReason, input.category)}`;
}
