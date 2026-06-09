#!/usr/bin/env tsx

import { PlaidSandboxFixtureConnector } from "@/lib/open-banking/sandbox-provider";
import { runPlaidSandboxSyncForCompany } from "@/lib/open-banking/sandbox-sync";
import { getRequiredSupabaseScriptConfig } from "./supabase-env";
import { createClient } from "@supabase/supabase-js";

const DEMO_COMPANY_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";

type SupabaseClient = ReturnType<typeof createClient>;

async function resetSandboxRows(supabase: SupabaseClient, companyId: string) {
  await supabase.from("transactions").delete().eq("company_id", companyId).eq("source_provider", "plaid");
  await supabase.from("bank_account_balances").delete().eq("company_id", companyId).eq("provider", "plaid");
  await supabase.from("open_banking_sync_logs").delete().eq("company_id", companyId).eq("provider", "plaid");
  await supabase.from("open_banking_sync_jobs").delete().eq("company_id", companyId).eq("provider", "plaid");
  await supabase.from("bank_accounts").delete().eq("company_id", companyId).eq("provider", "plaid");
  await supabase.from("provider_consents").delete().eq("company_id", companyId).eq("provider", "plaid");
  await supabase.from("connected_institutions").delete().eq("company_id", companyId).eq("provider", "plaid");
}

async function getFirstClassProof(supabase: SupabaseClient, companyId: string) {
  const [institutions, consents, accounts, balances, jobs, logs, transactions] = await Promise.all([
    supabase.from("connected_institutions").select("id, provider, provider_institution_id, institution_name, status").eq("company_id", companyId).eq("provider", "plaid"),
    supabase.from("provider_consents").select("id, provider, provider_consent_id, token_reference, status, consent_expires_at").eq("company_id", companyId).eq("provider", "plaid"),
    supabase.from("bank_accounts").select("id, provider, provider_account_id, connected_institution_id, provider_consent_id, account_subtype, available_balance, connection_status, last_successful_sync_at").eq("company_id", companyId).eq("provider", "plaid"),
    supabase.from("bank_account_balances").select("id, provider, provider_account_id, current_balance, available_balance, balance_as_of").eq("company_id", companyId).eq("provider", "plaid"),
    supabase.from("open_banking_sync_jobs").select("id, provider, status, accounts_synced, balances_synced, transactions_seen, transactions_inserted, duplicates_skipped").eq("company_id", companyId).eq("provider", "plaid").order("created_at", { ascending: false }).limit(3),
    supabase.from("open_banking_sync_logs").select("id, provider, event, message").eq("company_id", companyId).eq("provider", "plaid"),
    supabase.from("transactions").select("id, currency, source_provider, source_connection_id, source_institution_id, source_sync_job_id, source_account_provider_id, metadata").eq("company_id", companyId).eq("source_provider", "plaid"),
  ]);

  const errors = [institutions, consents, accounts, balances, jobs, logs, transactions]
    .map((result) => result.error?.message)
    .filter(Boolean);
  if (errors.length > 0) throw new Error(`First-class proof query failed: ${errors.join(" | ")}`);

  const transactionRows = transactions.data ?? [];
  return {
    connectedInstitutionRows: institutions.data?.length ?? 0,
    providerConsentRows: consents.data?.length ?? 0,
    connectedBankAccountRows: accounts.data?.length ?? 0,
    balanceSnapshotRows: balances.data?.length ?? 0,
    syncJobRows: jobs.data?.length ?? 0,
    syncLogRows: logs.data?.length ?? 0,
    transactionRows: transactionRows.length,
    transactionSourceLineageRows: transactionRows.filter((row) =>
      row.source_connection_id &&
      row.source_institution_id &&
      row.source_sync_job_id &&
      row.source_account_provider_id
    ).length,
    gbpRows: transactionRows.filter((row) => row.currency === "GBP").length,
    latestSyncJob: jobs.data?.[0] ?? null,
  };
}

async function main() {
  if (process.argv.includes("--api")) {
    process.env.OPEN_BANKING_SANDBOX_MODE = "plaid_api";
  }
  const companyId = process.argv.includes("--company-id")
    ? process.argv[process.argv.indexOf("--company-id") + 1]
    : process.argv.includes("--persist")
    ? DEMO_COMPANY_ID
    : "sandbox-company";
  const persist = process.argv.includes("--persist");
  const reset = process.argv.includes("--reset-sandbox");

  if (persist) {
    const { url, secretKey } = getRequiredSupabaseScriptConfig();
    const supabase = createClient(url, secretKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    if (reset) await resetSandboxRows(supabase, companyId);
    const persisted = await runPlaidSandboxSyncForCompany(companyId);
    const firstClassProof = await getFirstClassProof(supabase, companyId);
    console.log(JSON.stringify({
      ...persisted,
      resetSandboxRows: reset,
      firstClassProof,
      note: persisted.sourceMode === "plaid_api"
        ? "Persisted real Plaid Sandbox API data through the Open Banking sync service. No live bank account and no production credential is used."
        : "Persisted Plaid-shaped sandbox fixtures through the Open Banking sync service. No live bank account and no production credential is used.",
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
