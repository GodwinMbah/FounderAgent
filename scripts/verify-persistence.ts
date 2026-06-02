/**
 * Backend Persistence Verification Script
 * Records database state before/after uploads and verifies persistence.
 */

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  throw new Error("Missing Supabase environment variables");
}
const COMPANY_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

interface DbCounts {
  uploads: number;
  transactions: number;
  bankAccounts: number;
  companyMetrics: number;
  subscriptions: number;
  alerts: number;
  recommendations: number;
  agentTasks: number;
}

async function getCounts(): Promise<DbCounts> {
  const tables = [
    { name: "uploads", col: "company_id" },
    { name: "transactions", col: "company_id" },
    { name: "bank_accounts", col: "company_id" },
    { name: "company_metrics", col: "company_id" },
    { name: "subscriptions", col: "company_id" },
    { name: "alerts", col: "company_id" },
    { name: "agent_recommendations", col: "company_id" },
    { name: "agent_tasks", col: "company_id" },
  ];

  const counts: unknown = {};
  for (const t of tables) {
    const { count } = await supabase.from(t.name).select("*", { count: "exact", head: true }).eq(t.col, COMPANY_ID);
    counts[t.name.replace("agent_", "").replace("company_", "companyMetrics").replace("bank_accounts", "bankAccounts")] = count ?? 0;
  }

  return counts as DbCounts;
}

async function getLatestUpload(): Promise<unknown> {
  const { data } = await supabase
    .from("uploads")
    .select("*")
    .eq("company_id", COMPANY_ID)
    .order("uploaded_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data;
}

async function getLatestTransactions(limit = 10): Promise<unknown[]> {
  const { data } = await supabase
    .from("transactions")
    .select("*")
    .eq("company_id", COMPANY_ID)
    .order("created_at", { ascending: false })
    .limit(limit);
  return data || [];
}

async function getLatestBankAccount(): Promise<unknown> {
  const { data } = await supabase
    .from("bank_accounts")
    .select("*")
    .eq("company_id", COMPANY_ID)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data;
}

async function getLatestMetrics(): Promise<unknown> {
  const { data } = await supabase
    .from("company_metrics")
    .select("*")
    .eq("company_id", COMPANY_ID)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data;
}

function diff(a: DbCounts, b: DbCounts): Partial<DbCounts> {
  const d: Partial<DbCounts> = {};
  for (const key of Object.keys(a) as (keyof DbCounts)[]) {
    const diff = b[key] - a[key];
    if (diff !== 0) d[key] = diff;
  }
  return d;
}

export async function recordState(label: string): Promise<{ counts: DbCounts; report: string }> {
  const counts = await getCounts();
  const lines = [
    `\n=== ${label} ===`,
    `uploads:        ${counts.uploads}`,
    `transactions:   ${counts.transactions}`,
    `bankAccounts:   ${counts.bankAccounts}`,
    `companyMetrics: ${counts.companyMetrics}`,
    `subscriptions:  ${counts.subscriptions}`,
    `alerts:         ${counts.alerts}`,
    `recommendations:${counts.recommendations}`,
    `agentTasks:     ${counts.agentTasks}`,
  ];
  const report = lines.join("\n");
  console.log(report);
  return { counts, report };
}

export async function verifyUpload(label: string, before: DbCounts, after: DbCounts) {
  const d = diff(before, after);
  console.log(`\n--- Changes after ${label} ---`);
  for (const [key, val] of Object.entries(d)) {
    console.log(`  ${key}: ${val >= 0 ? "+" : ""}${val}`);
  }

  const upload = await getLatestUpload();
  if (upload) {
    console.log(`\n  Latest upload:`);
    console.log(`    File: ${upload.file_name}`);
    console.log(`    Status: ${upload.status}`);
    console.log(`    Provider detected (column): ${upload.provider_detected ?? "NULL"}`);
    console.log(`    Provider confidence (column): ${upload.provider_confidence ?? "NULL"}`);
    console.log(`    Provider in metadata: ${upload.metadata?.detected_provider ?? "N/A"}`);
    console.log(`    Transactions: ${upload.transaction_count ?? "N/A"}`);
  }

  const txns = await getLatestTransactions(5);
  if (txns.length > 0) {
    console.log(`\n  Latest transactions:`);
    for (const t of txns) {
      console.log(`    ${t.date} | ${t.merchant} | £${t.amount} | ${t.type} | bank_account_id: ${t.bank_account_id ?? "NULL"} | source_provider: ${t.metadata?.source_provider ?? "NULL"}`);
    }
  }

  const bankAccount = await getLatestBankAccount();
  if (bankAccount) {
    console.log(`\n  Latest bank account: ${bankAccount.name} (balance: ${bankAccount.current_balance})`);
  }

  const metrics = await getLatestMetrics();
  if (metrics) {
    console.log(`\n  Latest metrics (${metrics.period_type}):`);
    console.log(`    Revenue: ${metrics.total_revenue} | Expenses: ${metrics.total_expenses} | Net: ${metrics.net_profit}`);
    console.log(`    Cash: ${metrics.cash_balance} | Burn: ${metrics.monthly_burn} | Runway: ${metrics.runway_months}`);
    console.log(`    Health: ${metrics.health_score} | Subs: ${metrics.active_subscription_count}`);
  }
}

export async function verifyNoDoubleCount(before: DbCounts, afterFirst: DbCounts, afterDuplicate: DbCounts) {
  const firstDiff = diff(before, afterFirst);
  const dupDiff = diff(afterFirst, afterDuplicate);

  console.log(`\n=== DUPLICATE DETECTION CHECK ===`);
  console.log(`Transactions added on first upload:  ${firstDiff.transactions ?? 0}`);
  console.log(`Transactions added on duplicate upload: ${dupDiff.transactions ?? 0}`);

  if ((dupDiff.transactions ?? 0) === 0) {
    console.log("✅ PASS: No duplicate transactions inserted");
  } else if ((dupDiff.transactions ?? 0) < (firstDiff.transactions ?? 0)) {
    console.log(`⚠️ PARTIAL: Some duplicates were inserted (${dupDiff.transactions} of ${firstDiff.transactions})`);
  } else {
    console.log("❌ FAIL: Duplicate upload created full double-count");
  }
}

// If run directly
if (require.main === module) {
  (async () => {
    console.log("Persistence Verification Tool");
    console.log("Use this alongside browser uploads or call functions from another script.");
    await recordState("Current State");
    process.exit(0);
  })();
}
