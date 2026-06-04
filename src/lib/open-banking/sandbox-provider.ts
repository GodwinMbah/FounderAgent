import type {
  ConnectedBankAccount,
  OpenBankingConnectionSession,
  OpenBankingConnector,
  ProviderBalance,
  ProviderConsent,
  ProviderTransaction,
} from "./types";
import { getAccountKpiRouting } from "./kpi-routing";
import { normalisePlaidTransaction } from "./plaid-normaliser";

const now = () => new Date().toISOString();

export class PlaidSandboxFixtureConnector implements OpenBankingConnector {
  provider = "plaid" as const;
  environment = "sandbox" as const;

  async startConsentFlow(input: { companyId: string; redirectUri: string; scopes: string[]; state: string }): Promise<OpenBankingConnectionSession> {
    return {
      provider: this.provider,
      environment: this.environment,
      linkToken: `sandbox-link-token-${input.companyId}`,
      state: input.state,
      expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
    };
  }

  async exchangeConnectionToken(input: { companyId: string; publicToken?: string }): Promise<ProviderConsent> {
    return {
      companyId: input.companyId,
      provider: this.provider,
      providerItemId: "sandbox-plaid-item-founderagent",
      providerConsentId: "sandbox-plaid-consent-founderagent",
      tokenReference: "vault://open-banking/plaid/sandbox/founderagent",
      scopes: ["accounts", "balances", "transactions"],
      status: "connected",
      consentExpiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
      lastSyncedAt: now(),
      lastSuccessfulSyncAt: now(),
      metadata: {
        public_token_seen: Boolean(input.publicToken),
        sandbox_fixture: true,
      },
    };
  }

  async syncAccounts(consent: ProviderConsent): Promise<ConnectedBankAccount[]> {
    const base = {
      companyId: consent.companyId,
      provider: this.provider,
      status: "connected" as const,
      lastSyncedAt: now(),
      lastSuccessfulSyncAt: now(),
      syncStatus: "succeeded" as const,
    };

    return [
      {
        ...base,
        providerAccountId: "plaid-current-001",
        accountName: "Plaid Sandbox Business Current",
        officialName: "FounderAgent Current Account",
        accountType: "business_current",
        accountSubtype: "checking",
        currency: "GBP",
        currentBalance: 10273.52,
        availableBalance: 10273.52,
        accountMask: "0001",
        kpiRouting: getAccountKpiRouting("business_current"),
      },
      {
        ...base,
        providerAccountId: "plaid-savings-001",
        accountName: "Plaid Sandbox Business Savings",
        officialName: "FounderAgent Savings Account",
        accountType: "business_savings",
        accountSubtype: "savings",
        currency: "GBP",
        currentBalance: 4500,
        availableBalance: 4500,
        accountMask: "0002",
        kpiRouting: getAccountKpiRouting("business_savings"),
      },
      {
        ...base,
        providerAccountId: "plaid-card-001",
        accountName: "Plaid Sandbox Business Credit Card",
        officialName: "FounderAgent Credit Card",
        accountType: "business_credit_card",
        accountSubtype: "credit card",
        currency: "GBP",
        currentBalance: 650.25,
        availableBalance: 4349.75,
        limit: 5000,
        accountMask: "0003",
        kpiRouting: getAccountKpiRouting("business_credit_card"),
      },
    ];
  }

  async syncBalances(_consent: ProviderConsent, accounts: ConnectedBankAccount[]): Promise<ProviderBalance[]> {
    return accounts.map((account) => ({
      providerAccountId: account.providerAccountId,
      current: account.currentBalance,
      available: account.availableBalance,
      limit: account.limit,
      currency: account.currency,
      asOf: now(),
      raw: {
        account_id: account.providerAccountId,
        balances: {
          current: account.currentBalance,
          available: account.availableBalance,
          limit: account.limit,
          iso_currency_code: account.currency,
        },
      },
    }));
  }

  async syncTransactions(
    _consent?: ProviderConsent,
    _accounts?: ConnectedBankAccount[],
    _cursor?: string
  ): Promise<{ transactions: ProviderTransaction[]; nextCursor: string }> {
    return {
      nextCursor: "sandbox-cursor-001",
      transactions: [
        {
          providerTransactionId: "plaid-tx-stripe-001",
          providerAccountId: "plaid-current-001",
          date: "2026-05-24",
          description: "STRIPE PAYMENTS UK LTD PAYOUT",
          merchantName: "Stripe Payments UK LTD",
          amount: -491.76,
          currency: "GBP",
          category: "Revenue",
          transactionType: "credit",
          raw: { transaction_id: "plaid-tx-stripe-001", amount: -491.76 },
        },
        {
          providerTransactionId: "plaid-tx-google-001",
          providerAccountId: "plaid-current-001",
          date: "2026-05-22",
          description: "GOOGLE WORKSPACE",
          merchantName: "Google Workspace",
          amount: 24.99,
          currency: "GBP",
          category: "Software",
          transactionType: "card",
          raw: { transaction_id: "plaid-tx-google-001", amount: 24.99 },
        },
        {
          providerTransactionId: "plaid-tx-saving-transfer-001",
          providerAccountId: "plaid-savings-001",
          date: "2026-05-21",
          description: "TRANSFER FROM BUSINESS CURRENT",
          merchantName: "FounderAgent Current Account",
          amount: -1000,
          currency: "GBP",
          category: "Transfer",
          transactionType: "transfer",
          raw: { transaction_id: "plaid-tx-saving-transfer-001", amount: -1000 },
        },
        {
          providerTransactionId: "plaid-tx-interest-001",
          providerAccountId: "plaid-savings-001",
          date: "2026-05-20",
          description: "GROSS INTEREST",
          merchantName: "Bank Interest",
          amount: -5.22,
          currency: "GBP",
          category: "Revenue",
          transactionType: "interest",
          raw: { transaction_id: "plaid-tx-interest-001", amount: -5.22 },
        },
        {
          providerTransactionId: "plaid-tx-canva-card-001",
          providerAccountId: "plaid-card-001",
          date: "2026-05-18",
          description: "CANVA SUBSCRIPTION",
          merchantName: "Canva",
          amount: 10,
          currency: "GBP",
          category: "Software",
          transactionType: "card",
          raw: { transaction_id: "plaid-tx-canva-card-001", amount: 10 },
        },
        {
          providerTransactionId: "plaid-tx-card-repayment-001",
          providerAccountId: "plaid-card-001",
          date: "2026-05-17",
          description: "PAYMENT RECEIVED THANK YOU",
          merchantName: "Capital One",
          amount: -350,
          currency: "GBP",
          category: "Credit Card Payment",
          transactionType: "payment",
          raw: { transaction_id: "plaid-tx-card-repayment-001", amount: -350 },
        },
      ],
    };
  }

  async refreshTransactions(_consent?: ProviderConsent): Promise<void> {
    return undefined;
  }

  async disconnect(_consent?: ProviderConsent): Promise<void> {
    return undefined;
  }

  normaliseTransaction(transaction: ProviderTransaction, account: ConnectedBankAccount) {
    return normalisePlaidTransaction(transaction, account);
  }
}
