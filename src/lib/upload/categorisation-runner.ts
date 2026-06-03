import { enrichMerchant } from "@/lib/intelligence/merchant-enrichment";
import { detectTransfer } from "@/lib/intelligence/transfer-detector";
import { canonicalListToNormalised, type NormalisedRow } from "@/lib/providers/canonical-adapter";
import type { CanonicalTransaction } from "@/lib/providers/canonical-model";
import type { CompanySettings } from "@/lib/db/company_settings";
import {
  categoriseWithV3AndV1Fallback,
  type CategorisedV3Row,
} from "@/lib/upload/categoriser-v3-adapter";

const TRANSFER_STYLE_CATEGORIES = new Set([
  "Transfers",
  "Internal Transfer",
  "International Transfer",
  "Money Transfer",
  "Credit Card Payment",
  "Loan Repayment",
  "Owner Drawings",
]);

const KPI_EXCLUDED_CATEGORIES = new Set([
  ...TRANSFER_STYLE_CATEGORIES,
  "Capital Injection",
  "Loans",
  "Ambiguous",
  "Uncategorised Review",
]);

export function isTransferStyleCategory(category?: string): boolean {
  return TRANSFER_STYLE_CATEGORIES.has(category ?? "");
}

export function isKpiExcludedCategory(category?: string): boolean {
  return KPI_EXCLUDED_CATEGORIES.has(category ?? "");
}

function categoryToExclusionReason(category?: string): string | undefined {
  if (!category) return undefined;
  if (category === "Credit Card Payment") return "credit_card_payment";
  if (category === "Loan Repayment") return "loan_repayment";
  if (isTransferStyleCategory(category)) return "transfer";
  if (category === "Ambiguous" || category === "Uncategorised Review") return "needs_review";
  if (isKpiExcludedCategory(category)) return category.toLowerCase().replace(/\s+/g, "_");
  return undefined;
}

function classifyStructuralTransfer(tx: CanonicalTransaction): string {
  const text = `${tx.transactionType ?? ""} ${tx.description ?? ""} ${tx.reference ?? ""} ${tx.merchantName ?? ""} ${tx.counterpartyName ?? ""}`.toLowerCase();
  if (/\b(capital on tap|capital one|amex|american express|barclaycard|lloyds card|tide credit|revolut card|credit card)\b/.test(text)) {
    return "Credit Card Payment";
  }
  if (/\b(moneyway|close brothers|loan repayment|loan payment)\b/.test(text)) {
    return "Loan Repayment";
  }
  if (/\b(owner drawing|director loan|shareholder|capital repayment)\b/.test(text)) {
    return "Owner Drawings";
  }
  if (/\b(internal transfer|own account|between accounts|currency exchange|from british pound|to british pound|business savings|main\s*[·\->]\s*[a-z]{3})\b/.test(text)) {
    return "Internal Transfer";
  }
  return "Transfers";
}

export function applyMerchantAndTransferSignals(transactions: CanonicalTransaction[]): void {
  for (const tx of transactions) {
    const enriched = enrichMerchant(tx.merchantName);
    tx.originalMerchantName = tx.originalMerchantName ?? tx.merchantName;
    tx.normalisedMerchantName = tx.normalisedMerchantName ?? enriched.cleanName;
    tx.displayMerchantName = tx.displayMerchantName ?? enriched.displayName;
    tx.merchantName = enriched.displayName;
    if (!tx.category && enriched.categoryHint) {
      tx.category = enriched.categoryHint;
    }
  }

  for (const tx of transactions) {
    const transferResult = detectTransfer(
      {
        transactionType: tx.transactionType,
        description: tx.description,
        reference: tx.reference,
        amount: tx.amount,
        merchantName: tx.merchantName,
        counterpartyName: tx.counterpartyName,
        accountName: tx.accountName,
        currency: tx.currency,
        transactionDate: tx.transactionDate,
        externalTransactionId: tx.externalTransactionId,
      },
      {
        sourceProvider: tx.sourceProvider,
      }
    );

    if (!transferResult.isTransfer) continue;

    const category = classifyStructuralTransfer(tx);
    tx.isTransfer = true;
    tx.status = "transfer";
    tx.rowStatus = "transfer";
    tx.category = category;
    tx.kpiExcluded = true;
    tx.kpiExclusionReason = categoryToExclusionReason(category) ?? "transfer";
    tx.transferPairId = transferResult.transferPairId;
    tx.reviewReason = transferResult.reviewReason;
    tx.isCreditCardRepayment = category === "Credit Card Payment";
  }
}

function applyCategoryToCanonical(tx: CanonicalTransaction, row: CategorisedV3Row): void {
  const rowCategory = row.category;
  const canUseCategory =
    !tx.isPossibleDuplicate &&
    (!tx.isTransfer || isTransferStyleCategory(rowCategory) || isKpiExcludedCategory(rowCategory));

  if (rowCategory && canUseCategory) {
    tx.category = rowCategory;
  }

  tx.subcategory = row.subcategory;
  tx.originalMerchantName = tx.originalMerchantName ?? tx.merchantName;
  tx.normalisedMerchantName = row.normalisedMerchant;
  tx.displayMerchantName = row.displayMerchant ?? row.merchant;
  tx.merchantName = row.displayMerchant ?? row.merchant ?? tx.merchantName;
  tx.categoryReason = row.categoryReason;
  tx.categoryConfidence = row.categoryConfidence;
  tx.groupingConfidence = row.groupingConfidence;
  tx.categoryEvidence = row.categoryEvidence;
  tx.businessMeaning = row.businessMeaning;
  tx.kpiTreatment = row.kpiTreatment;
  tx.incomeExpenseStatus = row.type;
  tx.isCreditCardRepayment = row.isCreditCardRepayment;
  tx.isSubscriptionCandidate = row.isSubscriptionCandidate;
  tx.isRecurringCandidate = row.isRecurringCandidate;
  tx.confidenceScore = row.confidenceScore ?? tx.confidenceScore;

  if (!tx.isPossibleDuplicate && (isTransferStyleCategory(tx.category) || row.kpiTreatment === "excluded")) {
    tx.kpiExcluded = true;
    tx.kpiExclusionReason = categoryToExclusionReason(tx.category) ?? "kpi_excluded";
  }

  if (!tx.isPossibleDuplicate && isTransferStyleCategory(tx.category)) {
    tx.isTransfer = true;
    tx.status = "transfer";
    tx.rowStatus = "transfer";
  }

  if (!tx.isTransfer && !tx.isPossibleDuplicate) {
    tx.status = row.status ?? tx.status;
  }
}

export function categoriseCanonicalTransactions(
  transactions: CanonicalTransaction[],
  companySettings: CompanySettings | null
): {
  normalisedRows: NormalisedRow[];
  categorisedRows: CategorisedV3Row[];
} {
  const normalisedRows = canonicalListToNormalised(transactions);
  const categorisedRows = categoriseWithV3AndV1Fallback(normalisedRows, companySettings);

  for (let i = 0; i < categorisedRows.length && i < transactions.length; i++) {
    applyCategoryToCanonical(transactions[i], categorisedRows[i]);
  }

  return { normalisedRows, categorisedRows };
}
