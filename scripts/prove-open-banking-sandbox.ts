#!/usr/bin/env tsx

import { PlaidSandboxFixtureConnector } from "@/lib/open-banking/sandbox-provider";
import { runPlaidSandboxSyncForCompany } from "@/lib/open-banking/sandbox-sync";
import { getRequiredSupabaseScriptConfig } from "./supabase-env";

async function main() {
  const companyId = process.argv.includes("--company-id")
    ? process.argv[process.argv.indexOf("--company-id") + 1]
    : "sandbox-company";
  const persist = process.argv.includes("--persist");

  if (persist) {
    getRequiredSupabaseScriptConfig();
    const persisted = await runPlaidSandboxSyncForCompany(companyId);
    console.log(JSON.stringify({
      ...persisted,
      note: "Persisted Plaid-shaped sandbox fixtures through the Open Banking sync service. No live bank account and no production credential is used.",
    }, null, 2));
    return;
  }

  const connector = new PlaidSandboxFixtureConnector();
  const session = await connector.startConsentFlow({
    companyId,
    redirectUri: "http://localhost:3000/api/open-banking/plaid/callback",
    scopes: ["accounts", "balances", "transactions"],
    state: "sandbox-state",
  });
  const consent = await connector.exchangeConnectionToken({ companyId, publicToken: "public-sandbox-token" });
  const accounts = await connector.syncAccounts(consent);
  const balances = await connector.syncBalances(consent, accounts);
  const transactionSync = await connector.syncTransactions(consent, accounts);
  const accountByProviderId = new Map(accounts.map((account) => [account.providerAccountId, account]));
  const canonical = transactionSync.transactions.map((transaction) => {
    const account = accountByProviderId.get(transaction.providerAccountId);
    if (!account) throw new Error(`Missing account for provider id ${transaction.providerAccountId}`);
    return connector.normaliseTransaction(transaction, account);
  });

  const proof = {
    ok: true,
    provider: connector.provider,
    environment: connector.environment,
    sessionCreated: Boolean(session.linkToken),
    consentStatus: consent.status,
    accountsSynced: accounts.length,
    balancesSynced: balances.length,
    transactionsSynced: canonical.length,
    sourceProvider: "plaid",
    openBankingRows: canonical.filter((tx) => tx.sourceProvider === "plaid").length,
    gbpRows: canonical.filter((tx) => tx.currency === "GBP").length,
    revenueRows: canonical.filter((tx) => tx.reportingTreatment?.includedInOperatingRevenue).length,
    expenseRows: canonical.filter((tx) => tx.reportingTreatment?.includedInOperatingExpenses).length,
    transferRows: canonical.filter((tx) => tx.reportingTreatment?.reportingTreatment === "internal_transfer").length,
    debtRows: canonical.filter((tx) => tx.reportingTreatment?.includedInDebtTracking).length,
    dataQualityRows: canonical.filter((tx) => tx.reportingTreatment?.includedInDataQualityReporting).length,
    nextCursor: transactionSync.nextCursor,
    lastSyncedAt: consent.lastSyncedAt,
    note: "Uses Plaid-shaped sandbox fixtures only. No live bank account and no production credential is used.",
  };

  console.log(JSON.stringify(proof, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
