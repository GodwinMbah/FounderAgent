/**
 * Comprehensive Multi-Provider Duplicate Detection Test
 * Tests all 8 provider CSV formats end-to-end through the actual pipeline.
 */

import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";
import { getRequiredSupabaseScriptConfig } from "./supabase-env";

const { url: SUPABASE_URL, secretKey } = getRequiredSupabaseScriptConfig();
const COMPANY_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const BUCKET = "financial_uploads";

const supabase = createClient(SUPABASE_URL, secretKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// Must set env vars BEFORE importing pipeline module
process.env.NEXT_PUBLIC_SUPABASE_URL = SUPABASE_URL;
process.env.SUPABASE_SECRET_KEY = secretKey;
process.env.SUPABASE_SERVICE_ROLE_KEY = secretKey;

interface ProviderTest {
  name: string;
  file: string;
  source: string;
}

const TEST_USER_ID = "da39cf9b-7325-4a80-a2b3-aafee51480c4";

const PROVIDERS: ProviderTest[] = [
  { name: "Tide", file: "tide_sample.csv", source: "bank_statement_csv" },
  { name: "Revolut", file: "revolut_business_sample.csv", source: "bank_statement_csv" },
  { name: "Monzo", file: "monzo_sample.csv", source: "bank_statement_csv" },
  { name: "Starling", file: "starling_sample.csv", source: "bank_statement_csv" },
  { name: "Wise", file: "wise_sample.csv", source: "bank_statement_csv" },
  { name: "Stripe", file: "stripe_payouts_sample.csv", source: "bank_statement_csv" },
  { name: "PayPal", file: "paypal_activity_sample.csv", source: "bank_statement_csv" },
  { name: "Generic CSV", file: "generic_money_in_out.csv", source: "bank_statement_csv" },
];

async function getTxCount(): Promise<number> {
  const { count, error } = await supabase
    .from("transactions")
    .select("*", { count: "exact", head: true })
    .eq("company_id", COMPANY_ID);
  if (error) {
    console.error("Error getting tx count:", error);
    return 0;
  }
  return count ?? 0;
}

async function deleteCompanyTransactions(): Promise<void> {
  const { error } = await supabase
    .from("transactions")
    .delete()
    .eq("company_id", COMPANY_ID);
  if (error) {
    console.error("Error deleting transactions:", error);
  }
}

async function deleteCompanyUploads(): Promise<void> {
  const { data: uploads, error } = await supabase
    .from("uploads")
    .select("id, file_path")
    .eq("company_id", COMPANY_ID);
  if (error) {
    console.error("Error fetching uploads:", error);
    return;
  }
  for (const u of uploads || []) {
    if (u.file_path) {
      await supabase.storage.from(BUCKET).remove([u.file_path]);
    }
    await supabase.from("uploads").delete().eq("id", u.id);
  }
}

async function uploadCsv(fileName: string, source: string): Promise<string> {
  const csvPath = path.join(process.cwd(), "test_data/csv", fileName);
  const fileBuffer = fs.readFileSync(csvPath);
  const uploadId = crypto.randomUUID();
  const storagePath = `${COMPANY_ID}/${uploadId}_${fileName}`;

  const { error: storageError } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, fileBuffer, {
      contentType: "text/csv",
      upsert: false,
    });

  if (storageError) {
    throw new Error(`Storage upload failed: ${storageError.message}`);
  }

  const { error: dbError } = await supabase.from("uploads").insert({
    id: uploadId,
    company_id: COMPANY_ID,
    user_id: TEST_USER_ID,
    file_name: fileName,
    file_path: storagePath,
    file_size: fileBuffer.length,
    mime_type: "text/csv",
    source,
    status: "pending",
    metadata: {},
  });

  if (dbError) {
    throw new Error(`Upload record insert failed: ${dbError.message}`);
  }

  return uploadId;
}

async function runPipeline(uploadId: string): Promise<{ transactionsInserted: number; success: boolean; error?: string }> {
  const { runUploadPipeline } = await import("../src/lib/upload/pipeline");
  const result = await runUploadPipeline(uploadId, COMPANY_ID);
  return {
    transactionsInserted: result.transactionsInserted,
    success: result.success,
    error: result.error,
  };
}

async function testProvider(provider: ProviderTest): Promise<{
  provider: string;
  file: string;
  firstInserted: number;
  duplicateInserted: number;
  pass: boolean;
  firstError?: string;
  dupError?: string;
}> {
  console.log(`\nTesting ${provider.name}...`);

  // Clean slate for this provider
  await deleteCompanyTransactions();
  await deleteCompanyUploads();

  const beforeCount = await getTxCount();
  console.log(`  Transactions before: ${beforeCount}`);

  // First upload
  const uploadId1 = await uploadCsv(provider.file, provider.source);
  console.log(`  First upload ID: ${uploadId1}`);
  const result1 = await runPipeline(uploadId1);
  console.log(`  First pipeline result: inserted=${result1.transactionsInserted}, success=${result1.success}${result1.error ? `, error=${result1.error}` : ""}`);

  const afterFirstCount = await getTxCount();
  const firstInserted = afterFirstCount - beforeCount;
  console.log(`  Transactions after first upload: ${afterFirstCount} (inserted: ${firstInserted})`);

  if (firstInserted === 0) {
    console.log(`  ⚠️ First upload inserted 0 transactions - duplicate test is invalid`);
    return {
      provider: provider.name,
      file: provider.file,
      firstInserted: 0,
      duplicateInserted: 0,
      pass: false,
      firstError: result1.error || "First upload inserted 0 transactions",
    };
  }

  // Duplicate upload
  const uploadId2 = await uploadCsv(provider.file, provider.source);
  console.log(`  Duplicate upload ID: ${uploadId2}`);
  const result2 = await runPipeline(uploadId2);
  console.log(`  Duplicate pipeline result: inserted=${result2.transactionsInserted}, success=${result2.success}${result2.error ? `, error=${result2.error}` : ""}`);

  const afterDupCount = await getTxCount();
  const duplicateInserted = afterDupCount - afterFirstCount;
  console.log(`  Transactions after duplicate upload: ${afterDupCount} (inserted: ${duplicateInserted})`);

  const pass = duplicateInserted === 0;

  return {
    provider: provider.name,
    file: provider.file,
    firstInserted,
    duplicateInserted,
    pass,
    firstError: result1.error,
    dupError: result2.error,
  };
}

async function main() {
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("  Multi-Provider Duplicate Detection Test");
  console.log("═══════════════════════════════════════════════════════════════");
  console.log(`Company ID: ${COMPANY_ID}`);
  console.log(`Supabase URL: ${SUPABASE_URL}`);
  console.log("");

  // Clean up any existing test data for this company
  console.log("🧹 Cleaning up existing test data...");
  await deleteCompanyTransactions();
  await deleteCompanyUploads();

  const results = [];
  for (const provider of PROVIDERS) {
    try {
      const result = await testProvider(provider);
      results.push(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`  ❌ CRASH: ${message}`);
      results.push({
        provider: provider.name,
        file: provider.file,
        firstInserted: 0,
        duplicateInserted: 0,
        pass: false,
        firstError: message,
      });
    }
  }

  // Final cleanup
  await deleteCompanyTransactions();
  await deleteCompanyUploads();

  // Print results table
  console.log("\n═══════════════════════════════════════════════════════════════");
  console.log("  RESULTS");
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("| Provider      | File                           | First | Dup   | Status |");
  console.log("|---------------|--------------------------------|-------|-------|--------|");
  let passCount = 0;
  let failCount = 0;
  for (const r of results) {
    const status = r.pass ? "✅ PASS" : "❌ FAIL";
    const providerPad = r.provider.padEnd(13);
    const filePad = r.file.padEnd(30);
    const firstPad = String(r.firstInserted).padEnd(5);
    const dupPad = String(r.duplicateInserted).padEnd(5);
    console.log(`| ${providerPad} | ${filePad} | ${firstPad} | ${dupPad} | ${status} |`);
    if (r.pass) passCount++;
    else failCount++;
  }
  console.log("|---------------|--------------------------------|-------|-------|--------|");
  console.log(`\nTotal: ${passCount} passed, ${failCount} failed out of ${results.length} providers`);

  if (failCount > 0) {
    console.log("\nFailed providers details:");
    for (const r of results.filter((x) => !x.pass)) {
      console.log(`  - ${r.provider}: first=${r.firstInserted}, dup=${r.duplicateInserted}${r.firstError ? `, firstError=${r.firstError}` : ""}${r.dupError ? `, dupError=${r.dupError}` : ""}`);
    }
    process.exit(1);
  }

  console.log("\nAll providers passed duplicate detection!");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
