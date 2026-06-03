import type { CanonicalTransaction } from "@/lib/providers/canonical-model";
import type { Transaction } from "@/lib/types";
import { getKpiExclusionReasonForCategory, isKpiExcludedCategory } from "@/lib/kpi-treatment";

const VALID_DB_STATUSES = new Set([
  "categorised",
  "needs_review",
  "possible_subscription",
  "possible_duplicate",
  "unusual_spend",
  "ai_suggested",
  "user_confirmed",
]);

export function isUserCategoryProtected(transaction: Pick<Transaction, "status" | "metadata">): boolean {
  const metadata = transaction.metadata ?? {};
  return (
    transaction.status === "user_confirmed" ||
    metadata.category_source === "user" ||
    metadata.user_confirmed_category === true ||
    metadata.user_category_locked === true
  );
}

export function normaliseCategoryRefreshStatus(status?: string): string {
  const normalized = (status || "").toLowerCase().replace(/\s+/g, "_");
  if (VALID_DB_STATUSES.has(normalized)) return normalized;
  if (normalized === "transfer") return "ai_suggested";
  return "needs_review";
}

export function buildCategoryRefreshUpdate(
  existing: Transaction,
  categorised: CanonicalTransaction,
  refreshedAt = new Date().toISOString()
): Record<string, unknown> | null {
  if (isUserCategoryProtected(existing)) return null;

  const kpiExcluded =
    categorised.kpiExcluded === true ||
    categorised.kpiTreatment === "excluded" ||
    isKpiExcludedCategory(categorised.category);
  const kpiExclusionReason = kpiExcluded
    ? categorised.kpiExclusionReason ?? getKpiExclusionReasonForCategory(categorised.category) ?? "non_operating_movement"
    : null;
  const existingMetadata = existing.metadata ?? {};
  const metadata = {
    ...existingMetadata,
    detected_subcategory: categorised.subcategory,
    category_reason: categorised.categoryReason,
    category_confidence: categorised.categoryConfidence,
    grouping_confidence: categorised.groupingConfidence,
    category_evidence: categorised.categoryEvidence,
    business_meaning: categorised.businessMeaning,
    kpi_treatment: kpiExcluded ? "excluded" : "included",
    kpi_excluded: kpiExcluded,
    kpi_exclusion_reason: kpiExclusionReason,
    normalised_merchant: categorised.normalisedMerchantName,
    display_merchant: categorised.displayMerchantName,
    category_source: categorised.categorySource ?? "system",
    intelligence_group_id: categorised.intelligenceGroupId,
    intelligence_group_label: categorised.intelligenceGroupLabel,
    intelligence_group_reason: categorised.intelligenceGroupReason,
    intelligence_group_signals: categorised.intelligenceGroupSignals,
    is_credit_card_repayment: categorised.isCreditCardRepayment,
    is_subscription_candidate: categorised.isSubscriptionCandidate,
    is_recurring_candidate: categorised.isRecurringCandidate,
    row_status: categorised.rowStatus ?? (categorised.isTransfer ? "transfer" : existing.rowStatus),
    previous_category_before_refresh: existing.category,
    category_refreshed_at: refreshedAt,
    category_refreshed_by: "system_intelligence",
  };

  return {
    category: categorised.category,
    merchant: categorised.displayMerchantName ?? categorised.merchantName ?? existing.merchant,
    status: normaliseCategoryRefreshStatus(categorised.status),
    confidence_score: categorised.confidenceScore,
    row_status: categorised.rowStatus ?? (categorised.isTransfer ? "transfer" : existing.rowStatus),
    kpi_excluded: kpiExcluded,
    kpi_exclusion_reason: kpiExclusionReason,
    metadata,
  };
}
