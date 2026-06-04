import type { OpenBankingEnvironment, OpenBankingProviderId } from "./types";

function env(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value && !value.startsWith("your-") ? value : undefined;
}

export interface OpenBankingProviderConfig {
  defaultProvider: OpenBankingProviderId;
  environment: OpenBankingEnvironment;
  plaid?: {
    clientId?: string;
    secret?: string;
    products: string[];
    countryCodes: string[];
    redirectUri?: string;
  };
}

export function getOpenBankingProviderConfig(): OpenBankingProviderConfig {
  const defaultProvider = (env("OPEN_BANKING_DEFAULT_PROVIDER") ?? "plaid") as OpenBankingProviderId;
  const environment = (env("OPEN_BANKING_ENV") ?? env("PLAID_ENV") ?? "sandbox") as OpenBankingEnvironment;

  return {
    defaultProvider,
    environment,
    plaid: {
      clientId: env("PLAID_CLIENT_ID"),
      secret: env("PLAID_SECRET"),
      products: (env("PLAID_PRODUCTS") ?? "transactions,balance").split(",").map((value) => value.trim()).filter(Boolean),
      countryCodes: (env("PLAID_COUNTRY_CODES") ?? "GB").split(",").map((value) => value.trim()).filter(Boolean),
      redirectUri: env("PLAID_REDIRECT_URI"),
    },
  };
}

export function assertSandboxOnly(environment: OpenBankingEnvironment): void {
  if (environment !== "sandbox") {
    throw new Error("Open Banking production access is not enabled in this phase. Use sandbox only.");
  }
}

