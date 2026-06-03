/**
 * v3 Categorisation Adapter
 * Bridges the upload pipeline with the v3 smart categoriser.
 * Uses business profile context and user rules for primary categorisation,
 * with v1 fallback for low-confidence rows.
 */

import { categoriseTransaction } from "@/lib/intelligence/categorisation-engine";
import { getUserRulesForCategoriser } from "@/lib/intelligence/user-corrections";
import { suggestTransactionCategory } from "@/lib/categorisation";
import type { CompanySettings } from "@/lib/db/company_settings";
import type { NormalisedRow } from "@/lib/providers/canonical-adapter";
import type {
  BusinessModel,
  BusinessContext,
  TransactionContext,
} from "@/lib/intelligence/categorisation-engine";

export interface CategorisedV3Row extends NormalisedRow {
  category: string;
  confidenceScore: number;
  categoryReason: string;
  categoryConfidence: number;
  groupingConfidence: number;
  normalisedMerchant?: string;
  displayMerchant?: string;
  subcategory?: string;
  kpiTreatment: "included" | "excluded";
  businessMeaning?: string;
  isCreditCardRepayment: boolean;
  isSubscriptionCandidate: boolean;
  isRecurringCandidate: boolean;
  categoryEvidence: Array<{
    category: string;
    confidence: number;
    source: string;
    reason: string;
  }>;
}

const KPI_EXCLUDED_FALLBACK_CATEGORIES = new Set([
  "Transfers",
  "Internal Transfer",
  "International Transfer",
  "Money Transfer",
  "Credit Card Payment",
  "Loan Repayment",
  "Owner Drawings",
  "Capital Injection",
  "Loans",
  "Ambiguous",
  "Uncategorised Review",
]);

function mapBusinessModel(raw: string | undefined): BusinessModel {
  const valid: BusinessModel[] = [
    "saas",
    "ecommerce",
    "services",
    "consultancy",
    "agency",
    "coaching",
    "marketplace",
    "subscription",
    "physical_products",
    "mixed",
    "unknown",
  ];
  if (raw && valid.includes(raw as BusinessModel)) return raw as BusinessModel;
  return "unknown";
}

export function categoriseWithV3(
  rows: NormalisedRow[],
  companySettings: CompanySettings | null
): CategorisedV3Row[] {
  const businessContext: BusinessContext = {
    model: mapBusinessModel(companySettings?.businessModel),
    industry: companySettings?.industry,
    currency: companySettings?.currency,
    country: companySettings?.country,
    userRules: getUserRulesForCategoriser(companySettings),
  };

  return rows.map((row) => {
    const context: TransactionContext = {
      description: row.description || row.merchant || "",
      merchant: row.merchant,
      reference:
        row.reference || (row.metadata?.reference as string | undefined),
      amount: row.type === "income" ? row.amount : -row.amount,
      type: row.type,
      currency: row.currency,
      transactionType: row.metadata?.transaction_type as string | undefined,
      provider: (row.metadata?.source_provider as string) || "revolut",
      feeAmount: row.metadata?.fee_amount as number | undefined,
      originalCurrency: row.originalCurrency,
      merchantCategoryCode: row.metadata?.merchant_category_code as
        | string
        | undefined,
      counterpartyName: row.metadata?.counterparty as string | undefined,
      accountName: row.metadata?.account_name as string | undefined,
      cardDetails: row.metadata?.card_details as string | undefined,
      relatedTransactionId: row.metadata?.related_transaction_id as string | undefined,
      metadata: row.metadata,
      rawData: row.rawData,
      isTransfer: row.metadata?.is_transfer as boolean | undefined,
      isFee: row.metadata?.is_fee as boolean | undefined,
    };

    const result = categoriseTransaction(context, businessContext);

    const status =
      row.status === "transfer" || row.status === "possible_duplicate"
        ? row.status
        : result.status;

    return {
      ...row,
      merchant: result.displayMerchant || row.merchant,
      category: result.category,
      subcategory: result.subcategory,
      confidenceScore: result.confidence,
      status,
      categoryReason: result.reason,
      categoryConfidence: result.categoryConfidence,
      groupingConfidence: result.groupingConfidence,
      normalisedMerchant: result.normalisedMerchant,
      displayMerchant: result.displayMerchant,
      kpiTreatment: result.kpiTreatment,
      businessMeaning: result.businessMeaning,
      isCreditCardRepayment: result.isCreditCardRepayment,
      isSubscriptionCandidate: result.isSubscription,
      isRecurringCandidate: result.isRecurring,
      categoryEvidence: result.evidence,
    };
  });
}

export function categoriseWithV3AndV1Fallback(
  rows: NormalisedRow[],
  companySettings: CompanySettings | null
): CategorisedV3Row[] {
  const v3Categorised = categoriseWithV3(rows, companySettings);

  return v3Categorised.map((row) => {
    if (row.category !== "Uncategorised Review" && row.confidenceScore >= 60) return row;

    // Run v1 fallback for low confidence rows
    const v1Result = suggestTransactionCategory({
      id: `temp-${row.rowNumber}`,
      companyId: "",
      date: row.date,
      merchant: row.merchant,
      description: row.description,
      amount: row.amount,
      type: row.type,
      status: row.status,
    });

    const v1HasUsefulCategory =
      v1Result.suggestedCategory !== "Uncategorised Review" &&
      v1Result.confidenceScore > row.confidenceScore;

    if (!v1HasUsefulCategory) {
      return row;
    }

    return {
      ...row,
      category: v1Result.suggestedCategory,
      confidenceScore: v1Result.confidenceScore,
      status:
        v1Result.confidenceScore >= 75
          ? "ai_suggested"
          : "needs_review",
      categoryReason: v1Result.reason,
      categoryConfidence: v1Result.confidenceScore,
      kpiTreatment: KPI_EXCLUDED_FALLBACK_CATEGORIES.has(v1Result.suggestedCategory)
        ? "excluded"
        : "included",
      businessMeaning: `Fallback categorisation selected ${v1Result.suggestedCategory}.`,
      isCreditCardRepayment: v1Result.suggestedCategory === "Credit Card Payment",
      categoryEvidence: [
        ...row.categoryEvidence,
        {
          category: v1Result.suggestedCategory,
          confidence: v1Result.confidenceScore,
          source: "v1_fallback",
          reason: v1Result.reason,
        },
      ],
    };
  });
}
