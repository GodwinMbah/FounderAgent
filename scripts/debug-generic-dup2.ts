import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";
import { parseUpload } from "../src/lib/parser/unified-parser";
import { detectDuplicate, generateTransactionHash } from "../src/lib/intelligence/duplicate-detector-v2";
import { getRequiredSupabaseScriptConfig } from "./supabase-env";

const { url: SUPABASE_URL, secretKey } = getRequiredSupabaseScriptConfig();
const COMPANY_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";

const supabase = createClient(SUPABASE_URL, secretKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  // Clean up
  await supabase.from("transactions").delete().eq("company_id", COMPANY_ID);
  await supabase.from("uploads").delete().eq("company_id", COMPANY_ID);

  // Parse generic CSV
  const csvPath = path.join(process.cwd(), "test_data/csv/generic_money_in_out.csv");
  const csvText = fs.readFileSync(csvPath, "utf-8");
  const parseResult = parseUpload(csvText, {
    companyId: COMPANY_ID,
    companyCurrency: "GBP",
    companyCountry: "GB",
    uploadId: "first-upload",
  });

  console.log("Parsed transactions:");
  for (const tx of parseResult.transactions) {
    console.log(`  ${tx.merchantName} | ${tx.transactionDate} | ${tx.amount} | src=${tx.sourceProvider}`);
  }

  // Insert them manually
  for (const tx of parseResult.transactions) {
    const type = tx.amount >= 0 ? "income" : "expense";
    await supabase.from("transactions").insert({
      company_id: COMPANY_ID,
      date: tx.transactionDate,
      merchant: tx.merchantName,
      description: tx.description,
      amount: Math.abs(tx.amount),
      type,
      status: "needs_review",
      metadata: {
        source_provider: tx.sourceProvider,
        currency: tx.currency,
      },
    });
  }

  // Fetch existing transactions
  const { data: existingTxs } = await supabase
    .from("transactions")
    .select("date, amount, type, merchant, metadata")
    .eq("company_id", COMPANY_ID)
    .limit(1000);

  console.log("\nExisting transactions in DB:", existingTxs?.length ?? 0);
  const existingForDedup = (existingTxs || []).map((t) => {
    const meta = (t.metadata as Record<string, unknown> | null) || {};
    const absAmount = Number(t.amount);
    const signedAmount = t.type === "expense" ? -absAmount : absAmount;
    return {
      transactionDate: t.date as string,
      amount: signedAmount,
      currency: (meta.currency as string) || "GBP",
      merchantName: (t.merchant as string) || "",
      reference: (meta.reference as string) || undefined,
      externalTransactionId: (meta.external_transaction_id as string) || undefined,
      accountName: (meta.account_name as string) || undefined,
      sourceProvider: (meta.source_provider as string) || "unknown",
      sourceFileId: (meta.source_file_id as string) || undefined,
    };
  });

  for (const ex of existingForDedup) {
    const hash = generateTransactionHash(ex);
    console.log(`  DB: ${ex.merchantName} | ${ex.transactionDate} | ${ex.amount} | src=${ex.sourceProvider} | hash=${hash}`);
  }

  // Parse again (duplicate)
  const parseResult2 = parseUpload(csvText, {
    companyId: COMPANY_ID,
    companyCurrency: "GBP",
    companyCountry: "GB",
    uploadId: "dup-upload",
  });

  console.log("\nDuplicate detection:");
  for (const tx of parseResult2.transactions) {
    const hash = generateTransactionHash(tx);
    const dupResult = detectDuplicate(tx, existingForDedup);
    console.log(`  NEW: ${tx.merchantName} | ${tx.transactionDate} | ${tx.amount} | src=${tx.sourceProvider} | hash=${hash}`);
    console.log(`       isDuplicate=${dupResult.isDuplicate}, reason=${dupResult.reason}`);
  }
}

main().catch(console.error);
