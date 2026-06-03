/**
 * FounderAgent full database reconciliation proof for the real 694-row Revolut file.
 *
 * Usage:
 *   npx tsx scripts/prove-reconciliation-694.ts --reset
 *
 * The script uses SUPABASE_SECRET_KEY from the local environment. It does not
 * print secrets. `--reset` deletes demo-company upload data only.
 */

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { getRequiredSupabaseScriptConfig } from "./supabase-env";
import { runUploadPipeline } from "../src/lib/upload/pipeline";
import { getImportReconciliation } from "../src/lib/upload/reconciliation";
import { isExpense, isIncome, isKpiExcluded, isTransfer } from "../src/lib/reporting/filters";

const COMPANY_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const BUCKET = "financial_uploads";

const { url, secretKey } = getRequiredSupabaseScriptConfig();
const supabase = createClient(url, secretKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

type DbTransaction = {
  id: string;
  upload_id: string | null;
  source_row_number: number | null;
  external_transaction_id: string | null;
  source_provider: string | null;
  raw_row_hash: string | null;
  currency: string | null;
  amount: number;
  type: "income" | "expense";
  status: string;
  category: string | null;
  row_status: string | null;
  kpi_excluded: boolean | null;
  kpi_exclusion_reason: string | null;
  duplicate_of_transaction_id: string | null;
  posted_date: string | null;
  fee_amount: number | null;
  running_balance: number | null;
  metadata: Record<string, unknown> | null;
};

function resolveRealCsvPath(): string {
  const candidates = [
    "references/account statement 01 Jan 2026 24 May 2026.csv",
    "references/account-statement_01-Jan-2026_24-May-2026.csv",
    "test_data/csv/revolut_694.csv",
  ];
  const found = candidates.find((candidate) => fs.existsSync(path.resolve(process.cwd(), candidate)));
  if (!found) {
    throw new Error(`Real Revolut 694-row CSV not found. Checked: ${candidates.join(", ")}`);
  }
  return path.resolve(process.cwd(), found);
}

function assertProof(condition: unknown, message: string) {
  if (!condition) {
    throw new Error(`Proof failed: ${message}`);
  }
}

async function resetDemoData() {
  const tables = [
    "agent_activity_logs",
    "agent_tasks",
    "agent_recommendations",
    "alerts",
    "subscriptions",
    "transactions",
    "uploads",
    "upload_sessions",
    "company_metrics",
  ];

  for (const table of tables) {
    const { error } = await supabase.from(table).delete().eq("company_id", COMPANY_ID);
    if (error) throw new Error(`Failed to reset ${table}: ${error.message}`);
  }

  await ensureDemoCurrency();
}

async function ensureDemoCurrency() {
  const { error: companyError } = await supabase
    .from("companies")
    .update({ currency: "GBP" })
    .eq("id", COMPANY_ID);
  if (companyError && !companyError.message.includes("currency")) {
    throw new Error(`Failed to set company currency: ${companyError.message}`);
  }

  const { data: existingSettings, error: settingsFetchError } = await supabase
    .from("company_settings")
    .select("id")
    .eq("company_id", COMPANY_ID)
    .maybeSingle();
  if (settingsFetchError) throw new Error(`Failed to read company settings: ${settingsFetchError.message}`);

  if (existingSettings?.id) {
    const { error } = await supabase
      .from("company_settings")
      .update({ currency: "GBP", country: "GB" })
      .eq("company_id", COMPANY_ID);
    if (error) throw new Error(`Failed to update company settings currency: ${error.message}`);
  } else {
    const { error } = await supabase
      .from("company_settings")
      .insert({
        company_id: COMPANY_ID,
        currency: "GBP",
        country: "GB",
        top_revenue_channels: [],
        payment_tools: [],
        tools_used: [],
        agent_focus: [],
        weekly_digest_enabled: true,
      });
    if (error) throw new Error(`Failed to create GBP company settings: ${error.message}`);
  }

  const { error: bankError } = await supabase
    .from("bank_accounts")
    .update({ currency: "GBP" })
    .eq("company_id", COMPANY_ID);
  if (bankError) throw new Error(`Failed to set bank account currency: ${bankError.message}`);
}

async function uploadAndRun(csvPath: string, label: string) {
  const fileBuffer = fs.readFileSync(csvPath);
  const uploadId = crypto.randomUUID();
  const storagePath = `${COMPANY_ID}/reconciliation-proof-${label}-${uploadId}.csv`;

  const { error: storageError } = await supabase.storage.from(BUCKET).upload(storagePath, fileBuffer, {
    contentType: "text/csv",
    upsert: false,
  });
  if (storageError) throw new Error(`Storage upload failed: ${storageError.message}`);

  const { error: uploadError } = await supabase.from("uploads").insert({
    id: uploadId,
    company_id: COMPANY_ID,
    file_name: path.basename(csvPath),
    file_path: storagePath,
    file_size: fileBuffer.length,
    mime_type: "text/csv",
    source: "bank_statement_csv",
    status: "pending",
    metadata: {
      proof_label: label,
      source_fixture_path: path.relative(process.cwd(), csvPath),
    },
  });
  if (uploadError) throw new Error(`Upload row insert failed: ${uploadError.message}`);

  const pipelineResult = await runUploadPipeline(uploadId, COMPANY_ID);

  const { data: upload, error: uploadFetchError } = await supabase
    .from("uploads")
    .select("*")
    .eq("id", uploadId)
    .eq("company_id", COMPANY_ID)
    .single();
  if (uploadFetchError || !upload) throw new Error(`Could not fetch upload ${uploadId}: ${uploadFetchError?.message}`);

  const { data: transactions, error: txError, count } = await supabase
    .from("transactions")
    .select("*", { count: "exact" })
    .eq("company_id", COMPANY_ID)
    .eq("upload_id", uploadId)
    .order("source_row_number", { ascending: true });
  if (txError) throw new Error(`Could not fetch transactions for ${uploadId}: ${txError.message}`);

  return {
    uploadId,
    pipelineResult,
    upload,
    transactions: (transactions ?? []) as DbTransaction[],
    transactionCount: count ?? transactions?.length ?? 0,
  };
}

function calculateKpiProof(transactions: DbTransaction[]) {
  const revenue = transactions
    .filter((tx) => isIncome(tx))
    .reduce((sum, tx) => sum + Number(tx.amount), 0);
  const expenses = transactions
    .filter((tx) => isExpense(tx))
    .reduce((sum, tx) => sum + Number(tx.amount), 0);
  const transfers = transactions.filter((tx) => isTransfer(tx)).length;
  const kpiExcluded = transactions.filter((tx) => isKpiExcluded(tx)).length;

  return {
    revenue,
    expenses,
    netProfit: revenue - expenses,
    transfers,
    kpiExcluded,
    includedRevenueRows: transactions.filter((tx) => isIncome(tx)).length,
    includedExpenseRows: transactions.filter((tx) => isExpense(tx)).length,
  };
}

function verifyFirstImport(result: Awaited<ReturnType<typeof uploadAndRun>>) {
  const rec = getImportReconciliation(result.upload.metadata as Record<string, unknown>);
  assertProof(rec, "first upload reconciliation metadata exists");
  assertProof(rec!.rowsInFile === 694, `rowsInFile expected 694, got ${rec!.rowsInFile}`);
  assertProof(rec!.rowsParsed === 694, `rowsParsed expected 694, got ${rec!.rowsParsed}`);
  assertProof(rec!.rowsFailed === 0, `rowsFailed expected 0, got ${rec!.rowsFailed}`);
  assertProof(rec!.rowsInserted === result.transactionCount, "rowsInserted equals DB transaction count");
  assertProof(rec!.rowOutcomes.length === 694, `rowOutcomes expected 694, got ${rec!.rowOutcomes.length}`);
  assertProof(result.transactions.every((tx) => tx.upload_id === result.uploadId), "every transaction has upload_id");
  assertProof(result.transactions.every((tx) => typeof tx.source_row_number === "number"), "every transaction has source_row_number");
  assertProof(result.transactions.every((tx) => tx.currency === "GBP"), "every transaction currency is GBP");
  assertProof(result.transactions.every((tx) => tx.source_provider === "revolut_business_csv"), "every transaction source provider is Revolut Business");
  assertProof(result.transactions.every((tx) => Boolean(tx.raw_row_hash)), "every transaction has raw_row_hash");
  assertProof(result.transactions.every((tx) => Boolean(tx.category) || tx.status === "needs_review"), "every transaction has category or review status");
  assertProof(result.transactions.every((tx) => Boolean(tx.posted_date)), "every transaction has promoted posted_date");
  assertProof(result.transactions.every((tx) => tx.fee_amount !== null && tx.fee_amount !== undefined), "every transaction has promoted fee_amount when source fee column exists");
  assertProof(result.transactions.every((tx) => tx.running_balance !== null && tx.running_balance !== undefined), "every transaction has promoted running_balance");

  const kpiProof = calculateKpiProof(result.transactions);
  assertProof(kpiProof.includedRevenueRows === rec!.rowsIncludedInRevenue, "dashboard revenue row count equals reconciliation");
  assertProof(kpiProof.includedExpenseRows === rec!.rowsIncludedInExpenses, "dashboard expense row count equals reconciliation");
  assertProof(kpiProof.kpiExcluded === result.transactions.filter((tx) => tx.kpi_excluded === true).length, "KPI excluded promoted column is queryable");

  return {
    reconciliation: rec!,
    kpiProof,
    promotedColumnProof: {
      postedDateRows: result.transactions.filter((tx) => Boolean(tx.posted_date)).length,
      feeAmountRows: result.transactions.filter((tx) => tx.fee_amount !== null && tx.fee_amount !== undefined).length,
      runningBalanceRows: result.transactions.filter((tx) => tx.running_balance !== null && tx.running_balance !== undefined).length,
    },
  };
}

function verifyDuplicateImport(result: Awaited<ReturnType<typeof uploadAndRun>>) {
  const rec = getImportReconciliation(result.upload.metadata as Record<string, unknown>);
  assertProof(rec, "duplicate upload reconciliation metadata exists");
  assertProof(rec!.rowsInFile === 694, `duplicate rowsInFile expected 694, got ${rec!.rowsInFile}`);
  assertProof(rec!.rowsParsed === 694, `duplicate rowsParsed expected 694, got ${rec!.rowsParsed}`);
  assertProof(rec!.rowsInserted === 0, `duplicate rowsInserted expected 0, got ${rec!.rowsInserted}`);
  assertProof(rec!.rowsSkippedDuplicate === 694, `duplicate skipped expected 694, got ${rec!.rowsSkippedDuplicate}`);
  assertProof(result.transactionCount === 0, `duplicate DB transaction count expected 0, got ${result.transactionCount}`);
  assertProof(rec!.rowOutcomes.length === 694, `duplicate rowOutcomes expected 694, got ${rec!.rowOutcomes.length}`);
  assertProof(rec!.rowOutcomes.every((row) => row.status === "duplicate_skipped"), "every duplicate reupload row is marked duplicate_skipped");
  return rec!;
}

async function main() {
  const csvPath = resolveRealCsvPath();
  const shouldReset = process.argv.includes("--reset");

  if (shouldReset) {
    await resetDemoData();
  }

  const first = await uploadAndRun(csvPath, "first");
  const firstProof = verifyFirstImport(first);
  const duplicate = await uploadAndRun(csvPath, "duplicate");
  const duplicateRec = verifyDuplicateImport(duplicate);

  const proof = {
    csvPath: path.relative(process.cwd(), csvPath),
    firstUploadId: first.uploadId,
    duplicateUploadId: duplicate.uploadId,
    firstUpload: {
      status: first.upload.status,
      dbTransactions: first.transactionCount,
      rowsInFile: firstProof.reconciliation.rowsInFile,
      rowsParsed: firstProof.reconciliation.rowsParsed,
      rowsInserted: firstProof.reconciliation.rowsInserted,
      rowsFailed: firstProof.reconciliation.rowsFailed,
      rowsSkippedDuplicate: firstProof.reconciliation.rowsSkippedDuplicate,
      rowsMarkedTransfer: firstProof.reconciliation.rowsMarkedTransfer,
      rowsExcludedFromKpis: firstProof.reconciliation.rowsExcludedFromKpis,
      rowsIncludedInRevenue: firstProof.reconciliation.rowsIncludedInRevenue,
      rowsIncludedInExpenses: firstProof.reconciliation.rowsIncludedInExpenses,
      rowsNeedingReview: firstProof.reconciliation.rowsNeedingReview,
      rowsUncategorised: firstProof.reconciliation.rowsUncategorised,
      rowsAmbiguous: firstProof.reconciliation.rowsAmbiguous,
      rowsWithFees: firstProof.reconciliation.rowsWithFees,
      rowsWithCreditCardRepaymentTreatment: firstProof.reconciliation.rowsWithCreditCardRepaymentTreatment,
      currency: "GBP",
      kpiProof: firstProof.kpiProof,
      promotedColumnProof: firstProof.promotedColumnProof,
    },
    duplicateUpload: {
      status: duplicate.upload.status,
      dbTransactions: duplicate.transactionCount,
      rowsInserted: duplicateRec.rowsInserted,
      rowsSkippedDuplicate: duplicateRec.rowsSkippedDuplicate,
      rowOutcomes: duplicateRec.rowOutcomes.length,
    },
  };

  console.log(JSON.stringify(proof, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
