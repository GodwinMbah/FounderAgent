import { getAccountKpiRouting } from "./kpi-routing";
import { normalisePlaidTransaction } from "./plaid-normaliser";
import { assertSandboxOnly, getOpenBankingProviderConfig } from "./provider-config";
import type {
  ConnectedAccountType,
  ConnectedBankAccount,
  OpenBankingConnectionSession,
  OpenBankingConnector,
  ProviderBalance,
  ProviderConsent,
  ProviderTransaction,
} from "./types";

const PLAID_SANDBOX_BASE_URL = "https://sandbox.plaid.com";

type PlaidAccount = {
  account_id: string;
  balances?: {
    available?: number | null;
    current?: number | null;
    iso_currency_code?: string | null;
    unofficial_currency_code?: string | null;
    limit?: number | null;
  };
  mask?: string | null;
  name?: string | null;
  official_name?: string | null;
  type?: string | null;
  subtype?: string | null;
};

type PlaidTransaction = {
  account_id: string;
  transaction_id: string;
  date: string;
  authorized_date?: string | null;
  name?: string | null;
  merchant_name?: string | null;
  original_description?: string | null;
  amount: number;
  iso_currency_code?: string | null;
  unofficial_currency_code?: string | null;
  category?: string[] | null;
  payment_channel?: string | null;
  transaction_type?: string | null;
  pending?: boolean | null;
  personal_finance_category?: {
    primary?: string | null;
    detailed?: string | null;
  } | null;
  counterparties?: Array<{ name?: string | null }> | null;
};

type PlaidRequestOptions = {
  accessToken?: string;
  body?: Record<string, unknown>;
};

function nonPlaceholder(value?: string): value is string {
  return Boolean(value && !value.startsWith("your-"));
}

function plaidCurrency(value: PlaidAccount["balances"] | PlaidTransaction, fallback = "GBP"): string {
  return value?.iso_currency_code || value?.unofficial_currency_code || fallback;
}

function mapPlaidAccountType(type?: string | null, subtype?: string | null): ConnectedAccountType {
  const normalizedType = (type ?? "").toLowerCase();
  const normalizedSubtype = (subtype ?? "").toLowerCase();

  if (normalizedType === "credit") return "business_credit_card";
  if (normalizedType === "loan") return "loan";
  if (normalizedType === "depository" && normalizedSubtype.includes("saving")) return "business_savings";
  if (normalizedType === "depository") return "business_current";
  return "unknown";
}

function accountDisplayType(account: PlaidAccount): string {
  return [account.type, account.subtype].filter(Boolean).join(" / ") || "unknown";
}

function providerTransactionFromPlaid(transaction: PlaidTransaction, accountCurrencyById: Map<string, string>): ProviderTransaction {
  const merchantName =
    transaction.merchant_name ||
    transaction.counterparties?.find((counterparty) => counterparty.name)?.name ||
    transaction.name ||
    "Unknown merchant";
  const category =
    transaction.personal_finance_category?.primary?.replace(/_/g, " ") ||
    transaction.category?.[0];

  return {
    providerTransactionId: transaction.transaction_id,
    providerAccountId: transaction.account_id,
    date: transaction.date,
    postedDate: transaction.authorized_date ?? undefined,
    description: transaction.original_description || transaction.name || merchantName,
    merchantName,
    amount: transaction.amount,
    currency: plaidCurrency(transaction, accountCurrencyById.get(transaction.account_id) ?? "GBP"),
    category,
    subcategory: transaction.personal_finance_category?.detailed?.replace(/_/g, " ") || transaction.category?.[1],
    transactionType: transaction.payment_channel || transaction.transaction_type || undefined,
    pending: Boolean(transaction.pending),
    raw: transaction as Record<string, unknown>,
  };
}

export class PlaidSandboxApiConnector implements OpenBankingConnector {
  provider = "plaid" as const;
  environment = "sandbox" as const;

  private clientId: string;
  private secret: string;
  private products: string[];
  private countryCodes: string[];
  private redirectUri?: string;
  private sandboxInstitutionId: string;
  private accountCache = new Map<string, PlaidAccount[]>();

  constructor() {
    const config = getOpenBankingProviderConfig();
    assertSandboxOnly(config.environment);
    if (!nonPlaceholder(config.plaid?.clientId) || !nonPlaceholder(config.plaid?.secret)) {
      throw new Error("Plaid sandbox API credentials are not configured. Set PLAID_CLIENT_ID and PLAID_SECRET in .env.local.");
    }

    this.clientId = config.plaid.clientId;
    this.secret = config.plaid.secret;
    this.products = config.plaid.sandboxInitialProducts.length > 0 ? config.plaid.sandboxInitialProducts : ["transactions"];
    this.countryCodes = config.plaid.countryCodes.length > 0 ? config.plaid.countryCodes : ["GB"];
    this.redirectUri = config.plaid.redirectUri;
    this.sandboxInstitutionId = config.plaid.sandboxInstitutionId;
  }

  async startConsentFlow(input: { companyId: string; redirectUri: string; scopes: string[]; state: string }): Promise<OpenBankingConnectionSession> {
    const body: Record<string, unknown> = {
      user: { client_user_id: input.companyId },
      client_name: "FounderAgent",
      products: this.products,
      country_codes: this.countryCodes,
      language: "en",
    };
    const redirectUri = this.redirectUri ?? input.redirectUri;
    if (redirectUri) body.redirect_uri = redirectUri;

    const response = await this.request<{ link_token: string; expiration: string }>("/link/token/create", { body });
    return {
      provider: this.provider,
      environment: this.environment,
      linkToken: response.link_token,
      state: input.state,
      expiresAt: response.expiration,
    };
  }

  async createSandboxPublicToken(): Promise<string> {
    const response = await this.request<{ public_token: string }>("/sandbox/public_token/create", {
      body: {
        institution_id: this.sandboxInstitutionId,
        initial_products: this.products,
      },
    });
    return response.public_token;
  }

  async exchangeConnectionToken(input: { companyId: string; publicToken?: string }): Promise<ProviderConsent> {
    const publicToken = input.publicToken ?? await this.createSandboxPublicToken();
    const response = await this.request<{ access_token: string; item_id: string; request_id?: string }>("/item/public_token/exchange", {
      body: { public_token: publicToken },
    });

    return {
      companyId: input.companyId,
      provider: this.provider,
      providerItemId: response.item_id,
      providerConsentId: response.item_id,
      tokenReference: `sandbox-memory://plaid/${response.item_id}`,
      runtimeAccessToken: response.access_token,
      scopes: this.products,
      status: "connected",
      consentExpiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
      lastSyncedAt: new Date().toISOString(),
      lastSuccessfulSyncAt: new Date().toISOString(),
      metadata: {
        sandbox_api: true,
        institution_id: this.sandboxInstitutionId,
        token_storage: "memory_only",
        plaid_request_id: response.request_id,
      },
    };
  }

  async syncAccounts(consent: ProviderConsent): Promise<ConnectedBankAccount[]> {
    const accounts = await this.getAccounts(consent);
    return accounts.map((account) => {
      const accountType = mapPlaidAccountType(account.type, account.subtype);
      return {
        companyId: consent.companyId,
        institutionId: this.sandboxInstitutionId,
        consentId: consent.providerConsentId,
        provider: this.provider,
        providerAccountId: account.account_id,
        accountName: account.name || account.official_name || `Plaid ${accountDisplayType(account)} account`,
        officialName: account.official_name ?? undefined,
        accountType,
        accountSubtype: account.subtype ?? account.type ?? undefined,
        currency: plaidCurrency(account.balances),
        currentBalance: account.balances?.current ?? undefined,
        availableBalance: account.balances?.available ?? undefined,
        limit: account.balances?.limit ?? undefined,
        accountMask: account.mask ?? undefined,
        status: "connected",
        consentExpiresAt: consent.consentExpiresAt,
        lastSyncedAt: new Date().toISOString(),
        lastSuccessfulSyncAt: new Date().toISOString(),
        syncStatus: "succeeded",
        kpiRouting: getAccountKpiRouting(accountType),
        metadata: {
          sandbox_api: true,
          plaid_type: account.type,
          plaid_subtype: account.subtype,
        },
      };
    });
  }

  async syncBalances(consent: ProviderConsent, _accounts: ConnectedBankAccount[]): Promise<ProviderBalance[]> {
    const response = await this.request<{ accounts: PlaidAccount[] }>("/accounts/balance/get", {
      accessToken: this.requireAccessToken(consent),
    });
    this.accountCache.set(consent.providerItemId ?? consent.providerConsentId ?? "current", response.accounts ?? []);
    return (response.accounts ?? []).map((account) => ({
      providerAccountId: account.account_id,
      current: account.balances?.current ?? undefined,
      available: account.balances?.available ?? undefined,
      limit: account.balances?.limit ?? undefined,
      currency: plaidCurrency(account.balances),
      asOf: new Date().toISOString(),
      raw: account as Record<string, unknown>,
    }));
  }

  async syncTransactions(
    consent: ProviderConsent,
    accounts: ConnectedBankAccount[],
    cursor?: string
  ): Promise<{ transactions: ProviderTransaction[]; nextCursor?: string }> {
    let nextCursor = cursor;
    let hasMore = true;
    const transactions: ProviderTransaction[] = [];
    const accountCurrencyById = new Map(accounts.map((account) => [account.providerAccountId, account.currency]));

    while (hasMore) {
      const response = await this.request<{
        added?: PlaidTransaction[];
        modified?: PlaidTransaction[];
        next_cursor?: string;
        has_more?: boolean;
      }>("/transactions/sync", {
        accessToken: this.requireAccessToken(consent),
        body: {
          cursor: nextCursor,
          count: 500,
        },
      });

      for (const transaction of [...(response.added ?? []), ...(response.modified ?? [])]) {
        transactions.push(providerTransactionFromPlaid(transaction, accountCurrencyById));
      }
      nextCursor = response.next_cursor;
      hasMore = Boolean(response.has_more);
    }

    return { transactions, nextCursor };
  }

  async refreshTransactions(_consent: ProviderConsent): Promise<void> {
    return undefined;
  }

  async disconnect(_consent: ProviderConsent): Promise<void> {
    return undefined;
  }

  normaliseTransaction(transaction: ProviderTransaction, account: ConnectedBankAccount) {
    return normalisePlaidTransaction(transaction, account);
  }

  private async getAccounts(consent: ProviderConsent): Promise<PlaidAccount[]> {
    const cacheKey = consent.providerItemId ?? consent.providerConsentId ?? "current";
    const cached = this.accountCache.get(cacheKey);
    if (cached) return cached;

    const response = await this.request<{ accounts: PlaidAccount[] }>("/accounts/get", {
      accessToken: this.requireAccessToken(consent),
    });
    this.accountCache.set(cacheKey, response.accounts ?? []);
    return response.accounts ?? [];
  }

  private requireAccessToken(consent: ProviderConsent): string {
    if (!consent.runtimeAccessToken) {
      throw new Error("Plaid sandbox access token is available only in server memory during this proof sync.");
    }
    return consent.runtimeAccessToken;
  }

  private async request<T>(endpoint: string, options: PlaidRequestOptions = {}): Promise<T> {
    const response = await fetch(`${PLAID_SANDBOX_BASE_URL}${endpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: this.clientId,
        secret: this.secret,
        access_token: options.accessToken,
        ...(options.body ?? {}),
      }),
    });

    const json = await response.json() as T & { error_code?: string; error_message?: string; request_id?: string };
    if (!response.ok || json.error_code) {
      throw new Error(`Plaid sandbox API ${endpoint} failed: ${json.error_code ?? response.status} ${json.error_message ?? response.statusText}`);
    }
    return json;
  }
}

export function hasPlaidSandboxApiCredentials(): boolean {
  const config = getOpenBankingProviderConfig();
  return config.environment === "sandbox" && nonPlaceholder(config.plaid?.clientId) && nonPlaceholder(config.plaid?.secret);
}
