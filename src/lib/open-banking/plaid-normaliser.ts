import { generateTransactionHash } from "@/lib/intelligence/duplicate-detector-v2";
import type { CanonicalTransaction } from "@/lib/providers/canonical-model";
import { classifyConnectedAccountTreatment } from "./kpi-routing";
import type { ConnectedBankAccount, ProviderTransaction } from "./types";

function deriveType(amount: number): "income" | "expense" {
  return amount >= 0 ? "income" : "expense";
}

export function normalisePlaidTransaction(
  transaction: ProviderTransaction,
  account: ConnectedBankAccount
): CanonicalTransaction {
  // Plaid uses positive amounts for outflows and negative amounts for inflows.
  const signedAmount = -transaction.amount;
  const merchantName = transaction.merchantName || transaction.description || "Unknown merchant";
  const type = deriveType(signedAmount);
  const treatment = classifyConnectedAccountTreatment({
    accountType: account.accountType,
    type,
    amount: Math.abs(signedAmount),
    category: transaction.category,
    merchant: merchantName,
    description: transaction.description,
    reference: transaction.reference,
    transactionType: transaction.transactionType,
    sourceProvider: "plaid",
    metadata: {
      source_provider: "plaid",
      provider_account_id: account.providerAccountId,
      connected_account_type: account.accountType,
      connected_account_name: account.accountName,
    },
  });
  const rawRowHash = generateTransactionHash({
    transactionDate: transaction.date,
    amount: signedAmount,
    currency: transaction.currency,
    merchantName,
    accountName: account.accountName,
    sourceProvider: "plaid",
  });

  return {
    transactionDate: transaction.date,
    postedDate: transaction.postedDate,
    externalTransactionId: transaction.providerTransactionId,
    transactionType: transaction.transactionType,
    merchantName,
    description: transaction.description,
    reference: transaction.reference,
    amount: signedAmount,
    currency: transaction.currency,
    accountName: account.accountName,
    category: treatment.category ?? transaction.category,
    subcategory: transaction.subcategory,
    categoryReason: "Open Banking provider data normalised through connected account routing.",
    categoryConfidence: treatment.confidence,
    reportingTreatment: treatment,
    kpiTreatment: treatment.includedInOperatingKpis ? "included" : "excluded",
    status: treatment.includedInDataQualityReporting ? "needs_review" : "categorised",
    confidenceScore: treatment.confidence,
    sourceProvider: "plaid",
    rawRowHash,
    rowStatus: treatment.includedInDataQualityReporting ? "needs_review" : "inserted",
    kpiExcluded: !treatment.includedInOperatingKpis,
    kpiExclusionReason: treatment.kpiExclusionReason,
    isTransfer: treatment.includedInCashMovement && !treatment.includedInOperatingKpis && !treatment.includedInDataQualityReporting,
    isFee: treatment.reportingTreatment === "bank_fee",
    isCreditCardRepayment: treatment.reportingTreatment === "credit_card_repayment",
    isSubscriptionCandidate: false,
    isRecurringCandidate: false,
    isPossibleDuplicate: false,
    rawData: Object.fromEntries(
      Object.entries(transaction.raw).map(([key, value]) => [key, typeof value === "string" ? value : JSON.stringify(value)])
    ),
    parseErrors: [],
  };
}

