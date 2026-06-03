/**
 * Upload Wizard Type Definitions
 * Shared types for the multi-step CSV upload wizard
 */

import type { ReportingTreatment } from "@/lib/reporting/treatment-engine";

export type WizardStep =
  | "upload"
  | "mapping"
  | "preview"
  | "processing"
  | "summary";

export type SourceType =
  | "auto_detect"
  | "bank_statement_csv"
  | "payment_processor_csv"
  | "accounting_export_csv"
  | "manual_csv"
  | "generic_bank";

export type DetectedProvider =
  | "revolut_business_csv"
  | "tide"
  | "monzo"
  | "starling"
  | "wise"
  | "barclays"
  | "hsbc"
  | "lloyds"
  | "natwest"
  | "chase"
  | "stripe_csv"
  | "paypal_csv"
  | "square_csv"
  | "gocardless_csv"
  | "shopify_payouts_csv"
  | "generic_bank"
  | "manual_csv";

export interface ColumnMapping {
  field: string;
  header: string;
  index: number;
  confidence: number;
}

export type SignConvention = "uk_bank" | "us_bank" | "accounting" | "unknown";

export interface MappingOverrides {
  dateColumn?: string;
  descriptionColumn?: string;
  merchantColumn?: string;
  amountColumn?: string;
  debitColumn?: string;
  creditColumn?: string;
  currencyColumn?: string;
  balanceColumn?: string;
  typeColumn?: string;
  referenceColumn?: string;
  externalTransactionIdColumn?: string;
  merchantCategoryCodeColumn?: string;
  categoryColumn?: string;
  dateFormat?: string;
  signConvention?: SignConvention;
}

export interface ColumnSampleValues {
  header: string;
  samples: string[];
}

export interface PreviewRow {
  rowNumber: number;
  date: string;
  merchant: string;
  description: string;
  bankDescription?: string;
  reference?: string;
  payer?: string;
  counterparty?: string;
  transactionType?: string;
  sourceProvider?: string;
  accountName?: string;
  externalTransactionId?: string;
  merchantCategoryCode?: string;
  feeAmount?: number;
  runningBalance?: number;
  amount: number;
  type: "income" | "expense";
  currency: string;
  category: string;
  subcategory?: string;
  confidenceScore: number;
  categoryReason?: string;
  categoryConfidence?: number;
  groupingConfidence?: number;
  normalisedMerchant?: string;
  displayMerchant?: string;
  kpiTreatment?: "included" | "excluded";
  kpiExclusionReason?: string;
  reportingTreatment?: ReportingTreatment;
  businessMeaning?: string;
  intelligenceGroupId?: string;
  intelligenceGroupLabel?: string;
  intelligenceGroupReason?: string;
  intelligenceGroupSignals?: string[];
  categorySource?: "system" | "user" | "user_rule" | "grouping";
  isCreditCardRepayment?: boolean;
  isSubscriptionCandidate?: boolean;
  isRecurringCandidate?: boolean;
  categoryEvidence?: Array<{
    category: string;
    confidence: number;
    source: string;
    reason: string;
  }>;
  reviewReason?: string;
  status: string;
  issues: string[];
  rawData: Record<string, string>;
  isPossibleDuplicate?: boolean;
}

export interface WizardValidation {
  valid: boolean;
  error?: string;
  fileName?: string;
  fileSize?: number;
  rowCount?: number;
  columnCount?: number;
  headers?: string[];
  delimiter?: string;
}

export interface WizardPreview {
  sourceType: SourceType;
  detectedProvider?: string;
  providerConfidence?: number;
  detectedDelimiter: string;
  detectedCurrency: string;
  detectedDateFormat: string;
  columnMappings: ColumnMapping[];
  columnSamples: ColumnSampleValues[];
  previewRows: PreviewRow[];
  failedRows: { rowNumber: number; errors: string[]; rawRow: string[] }[];
  parsedHeaders?: string[];
  incomeTotal: number;
  expenseTotal: number;
  netMovement: number;
  mappingConfidence: number;
  latestBalance?: number;
  matchedHeaders?: string[];
  missingHeaders?: string[];
  intelligenceSummary?: {
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
  };
  intelligenceGroups?: Array<{
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
  }>;
  estimatedImpact?: {
    incomeToAdd: number;
    expensesToAdd: number;
    netMovement: number;
    duplicatesToSkip: number;
    failedRows: number;
    subscriptionsDetected: number;
    kpiExcludedRows?: number;
    creditCardPaymentsDetected?: number;
    recurringGroupsDetected?: number;
    latestBalanceDetected?: number;
  };
}

export interface ProcessingProgress {
  stage:
    | "uploading"
    | "reading"
    | "mapping"
    | "validating"
    | "importing"
    | "categorising"
    | "detecting_subscriptions"
    | "detecting_anomalies"
    | "generating_recommendations"
    | "updating_dashboard"
    | "completed"
    | "failed";
  message: string;
  percent: number;
}

export interface ImportSummary {
  success: boolean;
  uploadId?: string;
  fileName: string;
  sourceType: SourceType;
  rowsInFile: number;
  rowsParsed: number;
  rowsValid: number;
  rowsImported: number;
  rowsSkipped: number;
  rowsFailed: number;
  rowsNeedReview: number;
  rowsUncategorised: number;
  rowsAmbiguous: number;
  rowsCategorised: number;
  rowsHighConfidence: number;
  rowsCategorisedByUserRule: number;
  rowsCategorisedBySystemIntelligence: number;
  rowsIncludedInRevenue: number;
  rowsIncludedInExpenses: number;
  rowsIncludedInCashFlow: number;
  rowsIncludedInCashMovement: number;
  rowsIncludedInProfitAndLoss: number;
  rowsIncludedInDebtTracking: number;
  rowsIncludedInOwnerMovement: number;
  rowsIncludedInTaxReporting: number;
  rowsIncludedInDataQualityReporting: number;
  rowsTransfer: number;
  rowsDuplicate: number;
  rowsKpiExcluded: number;
  rowsLinkedToSubscriptions: number;
  rowsWithFees: number;
  rowsWithRefunds: number;
  rowsWithCreditCardRepaymentTreatment: number;
  reconciliationBalanced: boolean;
  reconciliationExplanation?: string;
  incomeTotal: number;
  expenseTotal: number;
  sourceCurrency: string;
  baseCurrency: string;
  subscriptionsDetected: number;
  unknownTransactions: number;
  alertsCreated: number;
  recommendationsCreated: number;
  error?: string;
}
