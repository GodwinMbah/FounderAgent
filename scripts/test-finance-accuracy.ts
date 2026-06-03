/**
 * Finance Accuracy Validation
 * Verifies dashboard KPIs and company_metrics do not change on duplicate uploads.
 */
import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";
import { getRequiredSupabaseScriptConfig } from "./supabase-env";

const { url: SUPABASE_URL, secretKey } = getRequiredSupabaseScriptConfig();
const COMPANY_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const TEST_USER_ID = "da39cf9b-7325-4a80-a2b3-aafee51480c4";
const BUCKET = "financial_uploads";

const supabase = createClient(SUPABASE_URL, secretKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

process.env.NEXT_PUBLIC_SUPABASE_URL = SUPABASE_URL;
process.env.SUPABASE_SECRET_KEY = secretKey;
process.env.SUPABASE_SERVICE_ROLE_KEY = secretKey;

interface ProviderTest {
  name: string;
  file: string;
}

const PROVIDERS: ProviderTest[] = [
  { name: "Tide", file: "tide_sample.csv" },
  { name: "Revolut", file: "revolut_business_sample.csv" },
  { name: "Monzo", file: "monzo_sample.csv" },
  { name: "Starling", file: "starling_sample.csv" },
  { name: "Wise", file: "wise_sample.csv" },
  { name: "Stripe", file: "stripe_payouts_sample.csv" },
  { name: "PayPal", file: "paypal_activity_sample.csv" },
  { name: "Generic CSV", file: "generic_money_in_out.csv" },
];

async function getMetrics() {
  const { data } = await supabase
    .from("company_metrics")
    .select("period_type, total_revenue, total_expenses, net_profit, cash_balance, monthly_burn, runway_months, active_subscription_count, transaction_count")
    .eq("company_id", COMPANY_ID)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data;
}

async function getTxCount() {
  const { count } = await supabase.from("transactions").select("*", { count: "exact", head: true }).eq("company_id", COMPANY_ID);
  return count ?? 0;
}

async function uploadCsv(fileName: string): Promise<string> {
  const csvPath = path.join(process.cwd(), "test_data/csv", fileName);
  const fileBuffer = fs.readFileSync(csvPath);
  const uploadId = crypto.randomUUID();
  const storagePath = `${COMPANY_ID}/${uploadId}_${fileName}`;
  await supabase.storage.from(BUCKET).upload(storagePath, fileBuffer, { contentType: "text/csv", upsert: false });
  await supabase.from("uploads").insert({
    id: uploadId, company_id: COMPANY_ID, user_id: TEST_USER_ID,
    file_name: fileName, file_path: storagePath, file_size: fileBuffer.length,
    mime_type: "text/csv", source: "bank_statement_csv", status: "pending", metadata: {},
  });
  return uploadId;
}

async function runPipeline(uploadId: string) {
  const { runUploadPipeline } = await import("../src/lib/upload/pipeline");
  return await runUploadPipeline(uploadId, COMPANY_ID);
}

async function cleanState() {
  await supabase.from("transactions").delete().eq("company_id", COMPANY_ID);
  await supabase.from("uploads").delete().eq("company_id", COMPANY_ID);
  await supabase.from("company_metrics").delete().eq("company_id", COMPANY_ID);
}

async function testProvider(provider: ProviderTest) {
  console.log(`\n🧪 ${provider.name}`);
  await cleanState();

  const beforeTx = await getTxCount();
  const beforeMetrics = await getMetrics();
  console.log(`  Before: tx=${beforeTx}, metrics=${JSON.stringify(beforeMetrics)}`);

  // First upload
  const id1 = await uploadCsv(provider.file);
  const r1 = await runPipeline(id1);
  const afterFirstTx = await getTxCount();
  const afterFirstMetrics = await getMetrics();
  console.log(`  After first: tx=${afterFirstTx} (+${afterFirstTx - beforeTx}), inserted=${r1.transactionsInserted}`);

  // Duplicate upload
  const id2 = await uploadCsv(provider.file);
  const r2 = await runPipeline(id2);
  const afterDupTx = await getTxCount();
  const afterDupMetrics = await getMetrics();
  console.log(`  After dup: tx=${afterDupTx} (+${afterDupTx - afterFirstTx}), inserted=${r2.transactionsInserted}`);

  // Validate
  const dupInserted = afterDupTx - afterFirstTx;
  const metricsChanged = JSON.stringify(afterFirstMetrics) !== JSON.stringify(afterDupMetrics);
  const pass = dupInserted === 0 && !metricsChanged;

  if (!pass) {
    if (dupInserted > 0) console.log(`  ❌ FAIL: Duplicate inserted ${dupInserted} transactions`);
    if (metricsChanged) console.log(`  ❌ FAIL: Metrics changed after duplicate upload`);
  } else {
    console.log(`  ✅ PASS: No duplicate insertions, metrics stable`);
  }

  return { provider: provider.name, pass, dupInserted, metricsChanged };
}

async function main() {
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("  Finance Accuracy Validation");
  console.log("═══════════════════════════════════════════════════════════════");

  const results = [];
  for (const provider of PROVIDERS) {
    try {
      const result = await testProvider(provider);
      results.push(result);
    } catch (err) {
      console.error(`  ❌ CRASH: ${err instanceof Error ? err.message : String(err)}`);
      results.push({ provider: provider.name, pass: false, dupInserted: -1, metricsChanged: false });
    }
  }

  console.log("\n═══════════════════════════════════════════════════════════════");
  console.log("  SUMMARY");
  console.log("═══════════════════════════════════════════════════════════════");
  const passCount = results.filter((r) => r.pass).length;
  console.log(`Passed: ${passCount}/${results.length}`);
  for (const r of results) {
    console.log(`  ${r.pass ? "✅" : "❌"} ${r.provider}: dupInserted=${r.dupInserted}, metricsChanged=${r.metricsChanged}`);
  }
}

main().catch(console.error);
