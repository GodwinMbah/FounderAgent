/**
 * Direct pipeline test with duplicate detection logging
 */
import { createClient } from "@supabase/supabase-js";
import { parseUpload } from "../src/lib/parser/unified-parser";
import { detectDuplicate, generateTransactionHash } from "../src/lib/intelligence/duplicate-detector-v2";
import fs from "fs";
import path from "path";
import { getRequiredSupabaseScriptConfig } from "./supabase-env";

const { url: SUPABASE_URL, secretKey } = getRequiredSupabaseScriptConfig();
const COMPANY_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";

const supabase = createClient(SUPABASE_URL, secretKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  // 1. Get existing transactions (using only columns that exist in live schema)
  const { data: existingTxs, error } = await supabase
    .from("transactions")
    .select("date, amount, merchant, metadata")
    .eq("company_id", COMPANY_ID)
    .order("created_at", { ascending: false })
    .limit(1000);

  if (error) {
    console.error("Query error:", error);
    process.exit(1);
  }

  console.log(`Existing transactions in DB: ${existingTxs?.length ?? 0}`);

  const existingForDedup = (existingTxs || []).map((t) => {
    const meta = (t.metadata as Record<string, unknown> | null) || {};
    return {
      transactionDate: t.date as string,
      amount: Number(t.amount),
      currency: (meta.currency as string) || "GBP",
      merchantName: (t.merchant as string) || "",
      reference: (meta.reference as string) || undefined,
      externalTransactionId: (meta.external_transaction_id as string) || undefined,
      accountName: (meta.account_name as string) || undefined,
      sourceProvider: (meta.source_provider as string) || "unknown",
      sourceFileId: (meta.source_file_id as string) || undefined,
    };
  });

  // 2. Parse Tide CSV
  const csvPath = path.join(process.cwd(), "test_data/csv/tide_sample.csv");
  const csvText = fs.readFileSync(csvPath, "utf-8");
  const parseResult = parseUpload(csvText, {
    companyId: COMPANY_ID,
    companyCurrency: "GBP",
    companyCountry: "GB",
    uploadId: "test-upload-id",
  });

  console.log(`Parsed transactions: ${parseResult.transactions.length}`);

  // 3. Check each parsed transaction against existing
  let dupCount = 0;
  for (const tx of parseResult.transactions) {
    const txHash = generateTransactionHash(tx);
    console.log(`\nTX: ${tx.merchantName} | ${tx.transactionDate} | ${tx.amount}`);
    console.log(`  Hash: ${txHash}`);

    // Find matching hash in existing
    const match = existingForDedup.find((ex) => generateTransactionHash(ex) === txHash);
    if (match) {
      console.log(`  -> HASH MATCH with existing: ${match.merchantName} | ${match.transactionDate}`);
    } else {
      console.log(`  -> NO hash match`);
    }

    // Run full duplicate detection
    const dupResult = detectDuplicate(tx, existingForDedup);
    console.log(`  -> detectDuplicate: isDuplicate=${dupResult.isDuplicate}, reason=${dupResult.reason}`);
    if (dupResult.isDuplicate) dupCount++;
  }

  console.log(`\n=== SUMMARY ===`);
  console.log(`Total parsed: ${parseResult.transactions.length}`);
  console.log(`Duplicates detected: ${dupCount}`);
  if (dupCount === parseResult.transactions.length && existingForDedup.length > 0) {
    console.log("✅ PASS: All transactions correctly detected as duplicates");
  } else if (existingForDedup.length === 0) {
    console.log("ℹ️ No existing transactions to compare against");
  } else {
    console.log("❌ FAIL: Some transactions not detected as duplicates");
  }
}

main().catch(console.error);
