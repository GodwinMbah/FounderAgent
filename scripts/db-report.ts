/**
 * Database Persistence Report Generator
 * Run this after browser uploads to verify backend persistence.
 */

import { createClient } from "@supabase/supabase-js";
import { getRequiredSupabaseScriptConfig } from "./supabase-env";

const { url: SUPABASE_URL, secretKey } = getRequiredSupabaseScriptConfig();
const COMPANY_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";

const supabase = createClient(SUPABASE_URL, secretKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

interface Counts {
  uploads: number;
  transactions: number;
  bankAccounts: number;
  companyMetrics: number;
  subscriptions: number;
  alerts: number;
  recommendations: number;
  agentTasks: number;
}

async function getCounts(): Promise<Counts> {
  const tables = [
    { name: "uploads", key: "uploads" },
    { name: "transactions", key: "transactions" },
    { name: "bank_accounts", key: "bankAccounts" },
    { name: "company_metrics", key: "companyMetrics" },
    { name: "subscriptions", key: "subscriptions" },
    { name: "alerts", key: "alerts" },
    { name: "agent_recommendations", key: "recommendations" },
    { name: "agent_tasks", key: "agentTasks" },
  ];

  const counts: unknown = {};
  for (const t of tables) {
    const { count } = await supabase.from(t.name).select("*", { count: "exact", head: true }).eq("company_id", COMPANY_ID);
    counts[t.key] = count ?? 0;
  }
  return counts;
}

async function getLatestUpload() {
  const { data } = await supabase
    .from("uploads")
    .select("*")
    .eq("company_id", COMPANY_ID)
    .order("uploaded_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data;
}

async function getLatestTransactions(limit = 10) {
  const { data } = await supabase
    .from("transactions")
    .select("*")
    .eq("company_id", COMPANY_ID)
    .order("created_at", { ascending: false })
    .limit(limit);
  return data || [];
}

async function getLatestMetrics() {
  const { data } = await supabase
    .from("company_metrics")
    .select("*")
    .eq("company_id", COMPANY_ID)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data;
}

async function main() {
  console.log("╔══════════════════════════════════════════════════════════════╗");
  console.log("║     FounderAgent — Backend Persistence Report                ║");
  console.log("╚══════════════════════════════════════════════════════════════╝");

  const counts = await getCounts();

  console.log("\n📊 Current Database Counts");
  console.log("───────────────────────────────────────────────────────────────");
  console.log(` uploads:         ${counts.uploads}`);
  console.log(` transactions:    ${counts.transactions}`);
  console.log(` bank_accounts:   ${counts.bankAccounts}`);
  console.log(` company_metrics: ${counts.companyMetrics}`);
  console.log(` subscriptions:   ${counts.subscriptions}`);
  console.log(` alerts:          ${counts.alerts}`);
  console.log(` recommendations: ${counts.recommendations}`);
  console.log(` agent_tasks:     ${counts.agentTasks}`);

  const upload = await getLatestUpload();
  if (upload) {
    console.log("\n📁 Latest Upload Record");
    console.log("───────────────────────────────────────────────────────────────");
    console.log(` ID:              ${upload.id}`);
    console.log(` File:            ${upload.file_name}`);
    console.log(` Status:          ${upload.status}`);
    console.log(` Source:          ${upload.source}`);
    console.log(` Provider (col):  ${upload.provider_detected ?? "NULL ⚠️"}`);
    console.log(` Confidence (col):${upload.provider_confidence ?? "NULL ⚠️"}`);
    console.log(` Provider (meta): ${upload.metadata?.detected_provider ?? "N/A"}`);
    console.log(` Confidence(meta):${upload.metadata?.provider_confidence ?? "N/A"}`);
    console.log(` Transactions:    ${upload.transaction_count ?? "N/A"}`);
    console.log(` Processed at:    ${upload.processed_at ?? "N/A"}`);
  }

  const txns = await getLatestTransactions(8);
  if (txns.length > 0) {
    console.log("\n💰 Latest Transactions");
    console.log("───────────────────────────────────────────────────────────────");
    console.log(" Date       | Merchant              | Amount    | Type   | Bank Acc | Source Provider");
    console.log("────────────┼───────────────────────┼───────────┼────────┼──────────┼────────────────");
    for (const t of txns) {
      const src = t.metadata?.source_provider ?? "NULL";
      const bank = t.bank_account_id ?? "NULL";
      console.log(` ${t.date} | ${(t.merchant || "").padEnd(21)} | ${String(t.amount).padStart(9)} | ${t.type.padEnd(6)} | ${bank.slice(0, 8).padEnd(8)} | ${src}`);
    }
  }

  const metrics = await getLatestMetrics();
  if (metrics) {
    console.log("\n📈 Latest Company Metrics");
    console.log("───────────────────────────────────────────────────────────────");
    console.log(` Period:          ${metrics.period_type}`);
    console.log(` Revenue:         £${metrics.total_revenue}`);
    console.log(` Expenses:        £${metrics.total_expenses}`);
    console.log(` Net Profit:      £${metrics.net_profit}`);
    console.log(` Cash Balance:    £${metrics.cash_balance}`);
    console.log(` Monthly Burn:    £${metrics.monthly_burn}`);
    console.log(` Runway:          ${metrics.runway_months >= 999 ? "Infinite" : metrics.runway_months + " months"}`);
    console.log(` Health Score:    ${metrics.health_score}/100`);
    console.log(` Subscriptions:   ${metrics.active_subscription_count} active`);
    console.log(` MRR:             £${metrics.monthly_subscription_spend}`);
    console.log(` Transactions:    ${metrics.transaction_count}`);
    console.log(` Uncategorized:   ${metrics.uncategorized_count}`);
  }

  // Validation checks
  console.log("\n✅ Validation Checks");
  console.log("───────────────────────────────────────────────────────────────");

  let checks = 0;
  let passes = 0;

  function check(name: string, condition: boolean) {
    checks++;
    if (condition) passes++;
    console.log(` ${condition ? "✅" : "❌"} ${name}`);
  }

  check("Uploads record exists", counts.uploads > 0);
  check("Transactions exist", counts.transactions > 0);
  check("Bank accounts exist", counts.bankAccounts > 0);
  check("Company metrics exist", counts.companyMetrics > 0);
  check("Upload has provider_detected column", !!upload?.provider_detected);
  check("Upload has provider_confidence column", upload?.provider_confidence !== null);
  check("Transactions have company_id", txns.every((t: unknown) => t.company_id === COMPANY_ID));
  check("Latest transactions have bank_account_id", txns.slice(0, 5).every((t: unknown) => !!t.bank_account_id));
  check("Latest upload status is completed", upload?.status === "completed");
  check("Metrics revenue is non-negative", (metrics?.total_revenue ?? 0) >= 0);
  check("Metrics expenses is non-negative", (metrics?.total_expenses ?? 0) >= 0);

  console.log(`\n${passes}/${checks} checks passed`);

  if (passes < checks) {
    console.log("\n⚠️  Some validation checks failed. See details above.");
    process.exit(1);
  }

  console.log("\n🎉 All validation checks passed!");
}

main().catch((err) => {
  console.error("Report failed:", err);
  process.exit(1);
});
