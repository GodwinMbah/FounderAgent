import type { CanonicalTransaction } from "@/lib/providers/canonical-model";

export type OpenBankingProviderId =
  | "plaid"
  | "truelayer"
  | "yapily"
  | "tink"
  | "gocardless_bank_account_data"
  | "enable_banking"
  | "sandbox";

export type OpenBankingEnvironment = "sandbox" | "production";

export type ConnectedAccountType =
  | "business_current"
  | "business_savings"
  | "business_credit_card"
  | "loan"
  | "payment_processor"
  | "manual"
  | "unknown";

export type ConnectedAccountStatus =
  | "pending"
  | "connected"
  | "syncing"
  | "requires_reconnect"
  | "expired"
  | "disconnected"
  | "error";

export type OpenBankingSyncStatus =
  | "queued"
  | "running"
  | "succeeded"
  | "partial"
  | "failed";

export interface AccountKpiRouting {
  includedInRevenue: boolean;
  includedInExpenses: boolean;
  includedInCashFlow: boolean;
  includedInCashMovement: boolean;
  includedInProfitAndLoss: boolean;
  includedInBalanceSheetMovement: boolean;
  includedInDebtTracking: boolean;
  includedInOwnerMovement: boolean;
  includedInDataQuality: boolean;
  includedInAuditTrail: boolean;
  cashBalanceSource: boolean;
  explanation: string;
}

export interface ConnectedInstitution {
  id?: string;
  companyId: string;
  provider: OpenBankingProviderId;
  providerInstitutionId: string;
  institutionName: string;
  countryCodes: string[];
  status: ConnectedAccountStatus;
  connectedAt?: string;
  disconnectedAt?: string;
  metadata?: Record<string, unknown>;
}

export interface ProviderConsent {
  id?: string;
  companyId: string;
  institutionId?: string;
  provider: OpenBankingProviderId;
  providerItemId?: string;
  providerConsentId?: string;
  tokenReference?: string;
  scopes: string[];
  status: ConnectedAccountStatus;
  consentExpiresAt?: string;
  lastSyncedAt?: string;
  lastSuccessfulSyncAt?: string;
  reconnectUrl?: string;
  metadata?: Record<string, unknown>;
}

export interface ConnectedBankAccount {
  id?: string;
  companyId: string;
  institutionId?: string;
  consentId?: string;
  provider: OpenBankingProviderId;
  providerAccountId: string;
  accountName: string;
  officialName?: string;
  accountType: ConnectedAccountType;
  accountSubtype?: string;
  currency: string;
  currentBalance?: number;
  availableBalance?: number;
  limit?: number;
  accountMask?: string;
  status: ConnectedAccountStatus;
  consentExpiresAt?: string;
  lastSyncedAt?: string;
  lastSuccessfulSyncAt?: string;
  syncStatus?: OpenBankingSyncStatus;
  syncError?: string;
  kpiRouting: AccountKpiRouting;
  metadata?: Record<string, unknown>;
}

export interface ProviderBalance {
  providerAccountId: string;
  current?: number;
  available?: number;
  limit?: number;
  currency: string;
  asOf: string;
  raw: Record<string, unknown>;
}

export interface ProviderTransaction {
  providerTransactionId: string;
  providerAccountId: string;
  date: string;
  postedDate?: string;
  description: string;
  merchantName?: string;
  amount: number;
  currency: string;
  category?: string;
  subcategory?: string;
  reference?: string;
  transactionType?: string;
  pending?: boolean;
  raw: Record<string, unknown>;
}

export interface OpenBankingConnectionSession {
  provider: OpenBankingProviderId;
  environment: OpenBankingEnvironment;
  connectUrl?: string;
  linkToken?: string;
  state: string;
  expiresAt: string;
}

export interface OpenBankingConnector {
  provider: OpenBankingProviderId;
  environment: OpenBankingEnvironment;
  startConsentFlow(input: {
    companyId: string;
    redirectUri: string;
    scopes: string[];
    state: string;
  }): Promise<OpenBankingConnectionSession>;
  exchangeConnectionToken(input: {
    companyId: string;
    publicToken?: string;
    authCode?: string;
    state?: string;
  }): Promise<ProviderConsent>;
  syncAccounts(consent: ProviderConsent): Promise<ConnectedBankAccount[]>;
  syncBalances(consent: ProviderConsent, accounts: ConnectedBankAccount[]): Promise<ProviderBalance[]>;
  syncTransactions(
    consent: ProviderConsent,
    accounts: ConnectedBankAccount[],
    cursor?: string
  ): Promise<{ transactions: ProviderTransaction[]; nextCursor?: string }>;
  refreshTransactions(consent: ProviderConsent): Promise<void>;
  disconnect(consent: ProviderConsent): Promise<void>;
  normaliseTransaction(
    transaction: ProviderTransaction,
    account: ConnectedBankAccount
  ): CanonicalTransaction;
}
