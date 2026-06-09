import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PlaidSandboxApiConnector } from "../plaid-sandbox-api";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("PlaidSandboxApiConnector", () => {
  beforeEach(() => {
    process.env.OPEN_BANKING_ENV = "sandbox";
    process.env.PLAID_ENV = "sandbox";
    process.env.PLAID_CLIENT_ID = "sandbox-client-id";
    process.env.PLAID_SECRET = "sandbox-secret";
    process.env.PLAID_PRODUCTS = "transactions,balance";
    process.env.PLAID_COUNTRY_CODES = "GB";
    process.env.PLAID_SANDBOX_INSTITUTION_ID = "ins_117650";
    process.env.PLAID_SANDBOX_INITIAL_PRODUCTS = "transactions";
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.OPEN_BANKING_ENV;
    delete process.env.PLAID_ENV;
    delete process.env.PLAID_CLIENT_ID;
    delete process.env.PLAID_SECRET;
    delete process.env.PLAID_PRODUCTS;
    delete process.env.PLAID_COUNTRY_CODES;
    delete process.env.PLAID_SANDBOX_INSTITUTION_ID;
    delete process.env.PLAID_SANDBOX_INITIAL_PRODUCTS;
  });

  it("runs the Plaid sandbox API flow without persisting the access token into metadata", async () => {
    const calls: Array<{ endpoint: string; body: Record<string, unknown> }> = [];
    vi.stubGlobal("fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const endpoint = new URL(url).pathname;
      const body = JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>;
      calls.push({ endpoint, body });

      if (endpoint === "/sandbox/public_token/create") {
        return jsonResponse({ public_token: "public-sandbox-token" });
      }
      if (endpoint === "/item/public_token/exchange") {
        return jsonResponse({ access_token: "access-sandbox-token", item_id: "item-sandbox-1", request_id: "req-1" });
      }
      if (endpoint === "/accounts/get" || endpoint === "/accounts/balance/get") {
        return jsonResponse({
          accounts: [
            {
              account_id: "plaid-current-001",
              name: "Plaid Sandbox Current",
              official_name: "Plaid Sandbox Business Current",
              type: "depository",
              subtype: "checking",
              mask: "0001",
              balances: { current: 1200, available: 1150, iso_currency_code: "GBP" },
            },
            {
              account_id: "plaid-card-001",
              name: "Plaid Sandbox Card",
              type: "credit",
              subtype: "credit card",
              mask: "0002",
              balances: { current: 250, available: 4750, limit: 5000, iso_currency_code: "GBP" },
            },
          ],
        });
      }
      if (endpoint === "/transactions/sync") {
        return jsonResponse({
          added: [
            {
              account_id: "plaid-current-001",
              transaction_id: "plaid-real-sandbox-stripe-1",
              date: "2026-06-01",
              authorized_date: "2026-06-01",
              name: "STRIPE PAYMENTS UK LTD",
              merchant_name: "Stripe Payments UK LTD",
              original_description: "STRIPE PAYMENTS UK LTD PAYOUT",
              amount: -491.76,
              iso_currency_code: "GBP",
              payment_channel: "online",
              personal_finance_category: { primary: "INCOME", detailed: "INCOME_OTHER_INCOME" },
              pending: false,
            },
          ],
          modified: [],
          removed: [],
          next_cursor: "cursor-1",
          has_more: false,
        });
      }

      return jsonResponse({ error_code: "UNKNOWN_ENDPOINT", error_message: endpoint }, 400);
    });

    const connector = new PlaidSandboxApiConnector();
    const publicToken = await connector.createSandboxPublicToken();
    const consent = await connector.exchangeConnectionToken({ companyId: "company-1", publicToken });
    const accounts = await connector.syncAccounts(consent);
    const balances = await connector.syncBalances(consent, accounts);
    const synced = await connector.syncTransactions(consent, accounts);
    const canonical = connector.normaliseTransaction(synced.transactions[0], accounts[0]);

    expect(publicToken).toBe("public-sandbox-token");
    expect(consent.runtimeAccessToken).toBe("access-sandbox-token");
    expect(consent.metadata).not.toHaveProperty("access_token");
    expect(consent.tokenReference).toBe("sandbox-memory://plaid/item-sandbox-1");
    expect(accounts).toHaveLength(2);
    expect(accounts[0]).toMatchObject({
      providerAccountId: "plaid-current-001",
      accountType: "business_current",
      currency: "GBP",
    });
    expect(accounts[1]).toMatchObject({
      providerAccountId: "plaid-card-001",
      accountType: "business_credit_card",
      limit: 5000,
    });
    expect(balances).toHaveLength(2);
    expect(synced.nextCursor).toBe("cursor-1");
    expect(canonical).toMatchObject({
      externalTransactionId: "plaid-real-sandbox-stripe-1",
      amount: 491.76,
      currency: "GBP",
      sourceProvider: "plaid",
    });
    expect(canonical.reportingTreatment?.includedInOperatingRevenue).toBe(true);
    expect(calls.find((call) => call.endpoint === "/sandbox/public_token/create")?.body).toMatchObject({
      institution_id: "ins_117650",
      initial_products: ["transactions"],
    });
  });

  it("refuses production Plaid environments", () => {
    process.env.OPEN_BANKING_ENV = "production";

    expect(() => new PlaidSandboxApiConnector()).toThrow(/production access is not enabled/i);
  });
});
