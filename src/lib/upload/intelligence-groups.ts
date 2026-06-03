import type { CanonicalTransaction } from "@/lib/providers/canonical-model";
import type { PreviewRow } from "@/lib/upload/wizard-types";
import {
  formatKpiExclusionReason,
  getKpiExclusionReasonForCategory,
  isKpiExcludedCategory,
  isTransferStyleCategory,
} from "@/lib/kpi-treatment";

export interface TransactionIntelligenceGroup {
  id: string;
  label: string;
  rowCount: number;
  rowNumbers: number[];
  category?: string;
  categoryConfidence: number;
  groupConfidence: number;
  kpiTreatment: "included" | "excluded";
  kpiExclusionReason?: string;
  reason: string;
  signals: string[];
  reviewRequiredCount: number;
}

export interface PreviewIntelligenceSummary {
  rowsAutoCategorised: number;
  rowsSuggested: number;
  rowsNeedingReview: number;
  rowsAmbiguous: number;
  transfersDetected: number;
  creditCardPaymentsDetected: number;
  recurringGroupsDetected: number;
  subscriptionsDetected: number;
  kpiExcludedRows: number;
  intelligenceGroups: number;
}

const REVIEW_CATEGORIES = new Set(["Uncategorised Review", "Needs Review", "Ambiguous"]);

function normalise(value?: string | null): string {
  return (value ?? "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function firstUsefulTokens(value?: string | null, max = 4): string {
  return normalise(value)
    .split(/\s+/)
    .filter((token) => token.length > 1 && !/^\d+$/.test(token))
    .map((token) => (/^\d/.test(token) ? "#" : token))
    .slice(0, max)
    .join(" ");
}

function directionOf(amount: number): "income" | "expense" {
  return amount >= 0 ? "income" : "expense";
}

function txMerchant(tx: CanonicalTransaction): string {
  return tx.normalisedMerchantName || tx.displayMerchantName || tx.merchantName || tx.counterpartyName || "unknown";
}

function txReferencePattern(tx: CanonicalTransaction): string {
  return firstUsefulTokens(tx.reference || tx.description || tx.transactionType, 5);
}

function txGroupKey(tx: CanonicalTransaction): string {
  const merchant = firstUsefulTokens(txMerchant(tx), 4);
  const reference = txReferencePattern(tx);
  const counterparty = firstUsefulTokens(tx.counterpartyName, 4);
  const type = firstUsefulTokens(tx.transactionType, 3);
  const mcc = firstUsefulTokens(tx.merchantCategoryCode, 2);
  const provider = firstUsefulTokens(tx.sourceProvider, 2);
  const direction = directionOf(tx.amount);
  return [provider, merchant, reference || counterparty, type, mcc, direction].filter(Boolean).join("|");
}

function groupLabel(tx: CanonicalTransaction): string {
  return tx.displayMerchantName || tx.merchantName || tx.counterpartyName || tx.reference || "Similar transactions";
}

function stableGroupId(key: string): string {
  let hash = 2166136261;
  for (let i = 0; i < key.length; i++) {
    hash ^= key.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `grp_${(hash >>> 0).toString(36)}`;
}

function isReviewCategory(category?: string): boolean {
  return REVIEW_CATEGORIES.has(category ?? "");
}

function dominantCategory(group: CanonicalTransaction[]): {
  category?: string;
  confidence: number;
  count: number;
} {
  const counts = new Map<string, { count: number; confidenceTotal: number }>();

  for (const tx of group) {
    if (!tx.category || isReviewCategory(tx.category)) continue;
    const confidence = tx.categoryConfidence ?? tx.confidenceScore ?? 0;
    if (confidence < 70) continue;
    const current = counts.get(tx.category) ?? { count: 0, confidenceTotal: 0 };
    current.count += 1;
    current.confidenceTotal += confidence;
    counts.set(tx.category, current);
  }

  const [category, stat] = [...counts.entries()].sort((a, b) => {
    if (b[1].count !== a[1].count) return b[1].count - a[1].count;
    return b[1].confidenceTotal - a[1].confidenceTotal;
  })[0] ?? [];

  if (!category || !stat) return { confidence: 0, count: 0 };
  return {
    category,
    confidence: Math.round(stat.confidenceTotal / stat.count),
    count: stat.count,
  };
}

function categoryToKpiTreatment(category?: string): "included" | "excluded" {
  return isKpiExcludedCategory(category) || isTransferStyleCategory(category) ? "excluded" : "included";
}

function shouldApplyGroupCategory(tx: CanonicalTransaction, category?: string, dominantCount = 0): boolean {
  if (!category || tx.isPossibleDuplicate) return false;
  if (tx.userConfirmedCategory || tx.categorySource === "user") return false;
  if (tx.category === category && (tx.categoryConfidence ?? tx.confidenceScore ?? 0) >= 70) return false;
  if (isReviewCategory(tx.category) || (tx.categoryConfidence ?? tx.confidenceScore ?? 0) < 70) return dominantCount >= 2;
  return false;
}

export function applyIntelligenceGroups(transactions: CanonicalTransaction[]): TransactionIntelligenceGroup[] {
  const buckets = new Map<string, CanonicalTransaction[]>();

  for (const tx of transactions) {
    const key = txGroupKey(tx);
    if (!key) continue;
    const bucket = buckets.get(key) ?? [];
    bucket.push(tx);
    buckets.set(key, bucket);
  }

  const groups: TransactionIntelligenceGroup[] = [];

  for (const [key, group] of buckets.entries()) {
    if (group.length < 2) continue;

    const dominant = dominantCategory(group);
    const label = groupLabel(group[0]);
    const groupConfidence = Math.min(98, Math.max(70, 68 + group.length * 4 + (dominant.count >= 2 ? 10 : 0)));
    const kpiTreatment = categoryToKpiTreatment(dominant.category);
    const kpiExclusionReason = kpiTreatment === "excluded"
      ? getKpiExclusionReasonForCategory(dominant.category) ?? "non_operating_movement"
      : undefined;
    const id = stableGroupId(key);
    const signals = [
      "normalised merchant",
      "reference pattern",
      "direction",
      "transaction type",
      "provider",
    ];
    const reason = dominant.category
      ? `${group.length} similar rows grouped by merchant/reference/direction and treated as ${dominant.category}.`
      : `${group.length} similar rows grouped for review because the category evidence is still unclear.`;

    for (const tx of group) {
      tx.intelligenceGroupId = id;
      tx.intelligenceGroupLabel = label;
      tx.intelligenceGroupReason = reason;
      tx.intelligenceGroupSignals = signals;
      tx.groupingConfidence = Math.max(tx.groupingConfidence ?? 0, groupConfidence);

      if (shouldApplyGroupCategory(tx, dominant.category, dominant.count)) {
        tx.category = dominant.category;
        tx.categoryConfidence = Math.max(tx.categoryConfidence ?? 0, Math.min(92, dominant.confidence));
        tx.confidenceScore = Math.max(tx.confidenceScore ?? 0, tx.categoryConfidence ?? dominant.confidence);
        tx.categoryReason = `${reason} Group evidence lifted this row from review.`;
        tx.status = (tx.categoryConfidence ?? 0) >= 90 ? "categorised" : "ai_suggested";
        tx.categorySource = "grouping";
        tx.kpiTreatment = kpiTreatment;
        tx.kpiExcluded = kpiTreatment === "excluded";
        tx.kpiExclusionReason = kpiExclusionReason;
        if (isTransferStyleCategory(dominant.category)) {
          tx.isTransfer = true;
          tx.rowStatus = "transfer";
        }
      }
    }

    groups.push({
      id,
      label,
      rowCount: group.length,
      rowNumbers: group.map((tx) => tx.sourceRowNumber ?? 0).filter(Boolean),
      category: dominant.category,
      categoryConfidence: dominant.confidence,
      groupConfidence,
      kpiTreatment,
      kpiExclusionReason,
      reason,
      signals,
      reviewRequiredCount: group.filter((tx) => isReviewCategory(tx.category) || tx.status === "needs_review").length,
    });
  }

  return groups.sort((a, b) => b.rowCount - a.rowCount);
}

export function buildPreviewIntelligenceSummary(previewRows: PreviewRow[]): PreviewIntelligenceSummary {
  const rowConfidence = (row: PreviewRow) => row.categoryConfidence ?? row.confidenceScore ?? 0;
  const isNeedsReview = (row: PreviewRow) =>
    row.status === "needs_review" || isReviewCategory(row.category) || rowConfidence(row) < 70;
  const isSuggested = (row: PreviewRow) => !isNeedsReview(row) && rowConfidence(row) >= 70 && rowConfidence(row) < 90;
  const isAuto = (row: PreviewRow) => !isNeedsReview(row) && !isSuggested(row);
  const groupIds = new Set(previewRows.map((row) => row.intelligenceGroupId).filter(Boolean));

  return {
    rowsAutoCategorised: previewRows.filter(isAuto).length,
    rowsSuggested: previewRows.filter(isSuggested).length,
    rowsNeedingReview: previewRows.filter(isNeedsReview).length,
    rowsAmbiguous: previewRows.filter((row) => row.category === "Ambiguous").length,
    transfersDetected: previewRows.filter((row) => row.status === "transfer" || isTransferStyleCategory(row.category)).length,
    creditCardPaymentsDetected: previewRows.filter((row) => row.isCreditCardRepayment || row.category === "Credit Card Payment").length,
    recurringGroupsDetected: previewRows.filter((row) => row.isRecurringCandidate).length,
    subscriptionsDetected: previewRows.filter((row) => row.isSubscriptionCandidate).length,
    kpiExcludedRows: previewRows.filter((row) => row.kpiTreatment === "excluded" || isKpiExcludedCategory(row.category)).length,
    intelligenceGroups: groupIds.size,
  };
}

export function describePreviewKpiTreatment(row: PreviewRow): string {
  return row.kpiTreatment === "excluded"
    ? `KPI excluded: ${formatKpiExclusionReason(row.kpiExclusionReason, row.category)}`
    : "Included in KPIs";
}
