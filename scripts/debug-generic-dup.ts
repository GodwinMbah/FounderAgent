import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";
import { parseUpload } from "../src/lib/parser/unified-parser";
import { generateTransactionHash } from "../src/lib/intelligence/duplicate-detector-v2";
import { getRequiredSupabaseScriptConfig } from "./supabase-env";

const { url: SUPABASE_URL, secretKey } = getRequiredSupabaseScriptConfig();
const COMPANY_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";

const supabase = createClient(SUPABASE_URL, secretKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  // Get existing transactions for this company
  const { data: existingTxs } = await supabase
    .from("transactions")
    .select("date, amount, type, merchant, metadata")
    .eq("company_id", COMPANY_ID)
    .order("created_at", { ascending: false })
    .limit(10);

  console.log("Existing transactions:", existingTxs?.length ?? 0);
  for (const t of existingTxs || []) {
    const meta = (t.metadata as Record<string, unknown> | null) || {};
    const absAmount = Number(t.amount);
    const signedAmount = t.type === "expense" ? -absAmount : absAmount;
    const hash = generateTransactionHash({
      transactionDate: t.date as string,
      amount: signedAmount,
      currency: (meta.currency as string) || "GBP",
      merchantName: (t.merchant as string) || "",
      accountName: (meta.account_name as string) || undefined,
      sourceProvider: (meta.source_provider as string) || "unknown",
    });
    console.log(`  DB: ${t.merchant} | ${t.date} | ${signedAmount} | src=${meta.source_provider} | hash=${hash}`);
  }

  // Parse generic CSV
  const csvPath = path.join(process.cwd(), "test_data/csv/generic_money_in_out.csv");
  const csvText = fs.readFileSync(csvPath, "utf-8");
  const parseResult = parseUpload(csvText, {
    companyId: COMPANY_ID,
    companyCurrency: "GBP",
    companyCountry: "GB",
    uploadId: "test",
  });

  console.log("\nParsed transactions:");
  for (const tx of parseResult.transactions) {
    const hash = generateTransactionHash(tx);
    console.log(`  NEW: ${tx.merchantName} | ${tx.transactionDate} | ${tx.amount} | src=${tx.sourceProvider} | hash=${hash}`);
  }
}

main().catch(console.error);
