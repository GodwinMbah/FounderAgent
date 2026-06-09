#!/usr/bin/env tsx

import { createClient } from "@supabase/supabase-js";
import { hasPlaidSandboxApiCredentials } from "@/lib/open-banking/plaid-sandbox-api";
import { runPlaidSandboxSyncForCompany } from "@/lib/open-banking/sandbox-sync";
import { getRequiredSupabaseScriptConfig } from "./supabase-env";

const DEMO_COMPANY_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";

async function main() {
  process.env.OPEN_BANKING_SANDBOX_MODE = "plaid_api";
  process.env.OPEN_BANKING_ENV = process.env.OPEN_BANKING_ENV ?? "sandbox";
  process.env.PLAID_ENV = process.env.PLAID_ENV ?? "sandbox";

  if (!hasPlaidSandboxApiCredentials()) {
    console.log(JSON.stringify({
      ok: false,
      skipped: true,
      reason: "Plaid sandbox API credentials are not configured. Set PLAID_CLIENT_ID and PLAID_SECRET in .env.local.",
      requiredEnv: ["PLAID_CLIENT_ID", "PLAID_SECRET", "PLAID_ENV=sandbox", "OPEN_BANKING_SANDBOX_MODE=plaid_api"],
    }, null, 2));
    return;
  }

  const companyId = process.argv.includes("--company-id")
    ? process.argv[process.argv.indexOf("--company-id") + 1]
    : DEMO_COMPANY_ID;
  const { url, secretKey } = getRequiredSupabaseScriptConfig();
  const supabase = createClient(url, secretKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const before = await supabase
    .from("transactions")
    .select("id", { count: "exact", head: true })
    .eq("company_id", companyId)
    .eq("source_provider", "plaid");

  const result = await runPlaidSandboxSyncForCompany(companyId);

  const after = await supabase
    .from("transactions")
    .select("id", { count: "exact", head: true })
    .eq("company_id", companyId)
    .eq("source_provider", "plaid");

  console.log(JSON.stringify({
    ok: true,
    sourceMode: result.sourceMode,
    provider: result.provider,
    environment: result.environment,
    accountsSynced: result.accountsSynced,
    balancesSynced: result.balancesSynced,
    providerTransactions: result.providerTransactions,
    canonicalTransactions: result.canonicalTransactions,
    transactionsInserted: result.transactionsInserted,
    duplicatesSkipped: result.duplicatesSkipped,
    plaidRowsBefore: before.count ?? null,
    plaidRowsAfter: after.count ?? null,
    warnings: result.warnings,
    note: "Uses real Plaid Sandbox API only. No live bank account and no production credential is used.",
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
