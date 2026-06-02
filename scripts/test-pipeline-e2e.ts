/**
 * End-to-end pipeline test: upload file, run pipeline, verify no duplicates.
 */
import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  throw new Error("Missing Supabase environment variables");
}
const COMPANY_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function getTxCount(): Promise<number> {
  const { count } = await supabase
    .from("transactions")
    .select("*", { count: "exact", head: true })
    .eq("company_id", COMPANY_ID);
  return count ?? 0;
}

async function main() {
  const beforeCount = await getTxCount();
  console.log(`Transactions before: ${beforeCount}`);

  // Upload Tide CSV to storage
  const csvPath = path.join(process.cwd(), "test_data/csv/tide_sample.csv");
  const fileBuffer = fs.readFileSync(csvPath);
  const uploadId = crypto.randomUUID();
  const fileName = `tide_${uploadId}.csv`;

  const { error: uploadError } = await supabase.storage
    .from("financial_uploads")
    .upload(`${COMPANY_ID}/${fileName}`, fileBuffer, {
      contentType: "text/csv",
      upsert: false,
    });

  if (uploadError) {
    console.error("Storage upload failed:", uploadError);
    process.exit(1);
  }

  // Create upload record
  const { error: dbError } = await supabase.from("uploads").insert({
    id: uploadId,
    company_id: COMPANY_ID,
    file_name: "tide_sample.csv",
    file_path: `${COMPANY_ID}/${fileName}`,
    file_size: fileBuffer.length,
    status: "pending",
    source: "bank_statement_csv",
    metadata: { detected_provider: "tide", provider_confidence: 145 },
  });

  if (dbError) {
    console.error("Upload record insert failed:", dbError);
    process.exit(1);
  }

  // Run pipeline
  const { runUploadPipeline } = await import("../src/lib/upload/pipeline");
  const result = await runUploadPipeline(uploadId, COMPANY_ID);

  console.log("Pipeline result:", JSON.stringify(result, null, 2));

  const afterCount = await getTxCount();
  console.log(`Transactions after: ${afterCount}`);
  console.log(`Change: ${afterCount - beforeCount}`);

  if (afterCount === beforeCount) {
    console.log("✅ PASS: No duplicate transactions inserted");
  } else {
    console.log("❌ FAIL: Duplicate transactions were inserted");
  }
}

main().catch(console.error);
