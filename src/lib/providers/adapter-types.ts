/**
 * Provider Adapter Type Definitions
 * Separated from registry to avoid circular imports.
 */

export type ProviderType = "bank" | "payment_processor" | "accounting" | "generic";
export type SignConvention = "uk_bank" | "us_bank" | "accounting" | "unknown";
export type FeeHandling = "separate_row" | "included_in_amount" | "separate_column";

export type CanonicalField =
  | "transactionDate"
  | "postedDate"
  | "merchantName"
  | "description"
  | "reference"
  | "externalTransactionId"
  | "transactionType"
  | "status"
  | "amount"
  | "debitAmount"
  | "creditAmount"
  | "currency"
  | "originalCurrency"
  | "originalAmount"
  | "exchangeRate"
  | "feeAmount"
  | "feeCurrency"
  | "runningBalance"
  | "accountName"
  | "accountNumber"
  | "category"
  | "merchantCategoryCode"
  | "counterpartyName";

export interface DetectionRule {
  requiredHeaders: string[];
  optionalHeaders?: string[];
  minRequiredMatches?: number;
  minScore?: number;
  preamblePatterns?: string[];
}

export interface HeaderAlias {
  field: CanonicalField;
  aliases: string[];
  required?: boolean;
}

export interface KnownTransactionType {
  direction: "income" | "expense" | "transfer" | "fee" | "neutral";
  category?: string;
  descriptionKeywords?: string[];
}

export interface ProviderAdapter {
  id: string;
  displayName: string;
  type: ProviderType;
  detection: DetectionRule;
  headerAliases: HeaderAlias[];
  signConvention: SignConvention;
  feeHandling: FeeHandling;
  knownTransactionTypes?: Record<string, KnownTransactionType>;
  transferPatterns?: string[];
  defaultCategoryRules?: { pattern: string; category: string }[];
  dateFormatHints?: string[];
  fixedCurrency?: string;
  hasSplitAmountColumns?: boolean;
  detectionWeight?: number;
}

export interface ProviderMatch {
  provider: ProviderAdapter;
  score: number;
  matchedHeaders: string[];
  missingRequired: CanonicalField[];
}
