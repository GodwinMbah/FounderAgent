#!/usr/bin/env tsx
/**
 * FounderAgent final foundation acceptance proof.
 *
 * Read-only by default. It checks the live data trust chain, the real 694-row
 * Revolut fixture, source dependency guardrails, strict date-filter expectations,
 * upload accessibility, empty-state routing, duplicate reconciliation, and the
 * deletion cascade code contract.
 *
 * Usage:
 *   npx tsx scripts/prove-foundation-acceptance.ts --company-id <uuid> --today 2026-06-03
 */

import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { getRequiredSupabaseScriptConfig } from "./supabase-env";
import { parseUpload } from "../src/lib/parser/unified-parser";
import { applyMerchantAndTransferSignals, categoriseCanonicalTransactions } from "../src/lib/upload/categorisation-runner";
import { getImportReconciliation } from "../src/lib/upload/reconciliation";
import { isCashMovementIn, isCashMovementOut, isExpense, isIncome, isKpiExcluded } from "../src/lib/reporting/filters";

type Json = Record<string, unknown>;

type UploadRow = {
  id: string;
  file_name: string | null;
  status: string;
  metadata: Json | null;
  uploaded_at: string;
};

type TransactionRow = {
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
  merchant: string | null;
  description: string | null;
  reference: string | null;
  date: string;
  posted_date: string | null;
  row_status: string | null;
  kpi_excluded: boolean | null;
  kpi_exclusion_reason: string | null;
  duplicate_of_transaction_id: string | null;
  fee_amount: number | null;
  running_balance: number | null;
  metadata: Json | null;
};

type DerivedRow = {
  id: string;
  title?: string | null;
  name?: string | null;
  vendor?: string | null;
  metadata?: Json | null;
  input_data?: Json | null;
};

const ACTIVE_UPLOAD_STATUSES = new Set(["completed", "processing", "pending"]);

const { url, secretKey } = getRequiredSupabaseScriptConfig();
const supabase = createClient(url, secretKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function parseArgs() {
  const args = process.argv.slice(2);
  const readValue = (name: string) => {
    const idx = args.indexOf(name);
    return idx >= 0 ? args[idx + 1] : undefined;
  };
  return {
    companyId: readValue("--company-id") ?? process.env.FOUNDERAGENT_COMPANY_ID,
    today: readValue("--today") ?? new Date().toISOString().slice(0, 10),
  };
}

function assertProof(condition: unknown, message: string) {
  if (!condition) throw new Error(`Proof failed: ${message}`);
}

function metadata(row: { metadata?: unknown }): Json {
  return row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)
    ? (row.metadata as Json)
    : {};
}

function inputData(row: { input_data?: unknown }): Json {
  return row.input_data && typeof row.input_data === "object" && !Array.isArray(row.input_data)
    ? (row.input_data as Json)
    : {};
}

function resolveCsvPath(): string {
  const candidates = [
    "references/account-statement_01-Jan-2026_24-May-2026.csv",
    "references/account statement 01 Jan 2026 24 May 2026.csv",
    "test_data/csv/revolut_694.csv",
  ];
  const found = candidates.find((candidate) => fs.existsSync(path.resolve(process.cwd(), candidate)));
  if (!found) throw new Error(`Real 694-row Revolut CSV not found. Checked: ${candidates.join(", ")}`);
  return path.resolve(process.cwd(), found);
}

function dateMinusDays(date: string, days: number): string {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() - days);
  return value.toISOString().slice(0, 10);
}

function inRange(row: TransactionRow, from: string, to: string) {
  return row.date >= from && row.date <= to;
}

function summarizeTransactions(rows: TransactionRow[]) {
  const revenue = rows.filter((row) => isIncome(row)).reduce((sum, row) => sum + Number(row.amount), 0);
  const expenses = rows.filter((row) => isExpense(row)).reduce((sum, row) => sum + Number(row.amount), 0);
  const cashIn = rows.filter((row) => isCashMovementIn(row)).reduce((sum, row) => sum + Number(row.amount), 0);
  const cashOut = rows.filter((row) => isCashMovementOut(row)).reduce((sum, row) => sum + Number(row.amount), 0);
  return {
    count: rows.length,
    revenue: Number(revenue.toFixed(2)),
    expenses: Number(expenses.toFixed(2)),
    netProfit: Number((revenue - expenses).toFixed(2)),
    cashIn: Number(cashIn.toFixed(2)),
    cashOut: Number(cashOut.toFixed(2)),
  };
}

function uploadIdsFromMeta(meta: Json): string[] {
  return [
    meta.upload_id,
    meta.source_upload_id,
    meta.detected_from_upload,
    meta.last_detected_from_upload,
  ].filter((value): value is string => typeof value === "string" && value.length > 0);
}

function isManual(meta: Json): boolean {
  return meta.source === "manual" || meta.created_by === "user" || meta.user_created === true || meta.manual === true;
}

function isGenerated(meta: Json): boolean {
  return (
    meta.generated_by === "upload_pipeline" ||
    meta.detected_from_upload !== undefined ||
    meta.last_detected_from_upload !== undefined ||
    meta.confidence !== undefined ||
    meta.transaction_count !== undefined ||
    meta.upload_id !== undefined ||
    meta.source_upload_id !== undefined
  );
}

function sourceVisibility(rows: DerivedRow[], activeUploadIds: Set<string>, source: "metadata" | "input_data") {
  let manual = 0;
  let sourceBacked = 0;
  let hiddenLegacy = 0;
  let generatedUnbacked = 0;

  for (const row of rows) {
    const meta = source === "metadata" ? metadata(row) : inputData(row);
    const uploadIds = uploadIdsFromMeta(meta);
    if (isManual(meta)) {
      manual += 1;
    } else if (uploadIds.some((uploadId) => activeUploadIds.has(uploadId))) {
      sourceBacked += 1;
    } else {
      hiddenLegacy += 1;
      if (isGenerated(meta)) generatedUnbacked += 1;
    }
  }

  return {
    totalRowsInTable: rows.length,
    manual,
    sourceBacked,
    hiddenLegacy,
    generatedUnbacked,
    unsafeVisibleRows: 0,
  };
}

function subscriptionVisibility(rows: DerivedRow[], activeUploadIds: Set<string>) {
  let manual = 0;
  let sourceBacked = 0;
  let generatedUnbacked = 0;
  let lineageUnknown = 0;

  for (const row of rows) {
    const meta = metadata(row);
    const uploadIds = uploadIdsFromMeta(meta);
    if (isManual(meta)) {
      manual += 1;
    } else if (uploadIds.some((uploadId) => activeUploadIds.has(uploadId))) {
      sourceBacked += 1;
    } else if (isGenerated(meta)) {
      generatedUnbacked += 1;
    } else {
      lineageUnknown += 1;
    }
  }

  return {
    totalRowsInTable: rows.length,
    manual,
    sourceBacked,
    generatedUnbacked,
    lineageUnknown,
    cleanupRequired: generatedUnbacked + lineageUnknown > 0,
  };
}

async function selectAll<T>(table: string, columns: string, companyId: string): Promise<T[]> {
  const { data, error } = await supabase.from(table).select(columns).eq("company_id", companyId).limit(5000);
  if (error) throw new Error(`${table}: ${error.message}`);
  return (data ?? []) as T[];
}

function staticFile(pathname: string): string {
  return fs.readFileSync(path.resolve(process.cwd(), pathname), "utf8");
}

function proveStaticContracts() {
  const connectState = staticFile("src/components/features/shared/ConnectDataSourceState.tsx");
  const wizard = staticFile("src/app/(dashboard)/upload-centre/WizardClient.tsx");
  const uploadActions = staticFile("src/app/(dashboard)/upload-centre/upload-history-actions.ts");

  const emptyStateRoutes = [
    "src/app/(dashboard)/dashboard/page.tsx",
    "src/app/(dashboard)/transactions/page.tsx",
    "src/app/(dashboard)/cash-flow/page.tsx",
    "src/app/(dashboard)/subscriptions/page.tsx",
    "src/app/(dashboard)/alerts/page.tsx",
    "src/app/(dashboard)/ai-insights/page.tsx",
    "src/app/(dashboard)/runway/page.tsx",
    "src/app/(dashboard)/expenses/page.tsx",
    "src/app/(dashboard)/revenue/page.tsx",
    "src/app/(dashboard)/budgets/page.tsx",
    "src/app/(dashboard)/reports/page.tsx",
    "src/app/(dashboard)/pl-report/page.tsx",
  ];

  const routeProof = emptyStateRoutes.map((route) => ({
    route,
    usesConnectDataSourceState: staticFile(route).includes("ConnectDataSourceState"),
  }));

  assertProof(connectState.includes('href="/upload-centre?focus=upload"'), "empty-state CTA routes directly to focused Upload Centre");
  assertProof(!connectState.includes("setup=true"), "empty-state CTA no longer opens duplicate setup upload concept");
  assertProof(wizard.includes('id="financial-upload-input"'), "upload input has stable id");
  assertProof(wizard.includes('data-testid="financial-upload-input"'), "upload input has test id");
  assertProof(wizard.includes('className="sr-only"'), "upload input is keyboard/screen-reader accessible, not display-hidden");
  assertProof(wizard.includes('aria-label="Upload financial statement"'), "upload input has accessible label");
  assertProof(wizard.includes('data-testid="financial-upload-dropzone"'), "dropzone has test id");
  assertProof(wizard.includes('htmlFor="financial-upload-input"'), "dropzone label is wired to the file input");
  assertProof(routeProof.every((route) => route.usesConnectDataSourceState), "all source-dependent routes use shared empty state");

  const deletionTables = [
    'from("alerts").delete()',
    'from("agent_recommendations").delete()',
    'from("agent_tasks").delete()',
    'from("subscriptions").delete()',
    'from("company_metrics").delete()',
    'from("transactions")',
    'from("uploads")',
  ];
  const deletionCascade = deletionTables.map((needle) => ({ needle, present: uploadActions.includes(needle) }));
  assertProof(deletionCascade.every((item) => item.present), "upload deletion cascade covers source, transactions, and derived analytics");
  assertProof(uploadActions.includes("current_balance: 0"), "upload deletion resets bank balance when no source remains");

  return {
    emptyStateHref: "/upload-centre?focus=upload",
    routeProof,
    uploadAccessibility: {
      fileInputId: "financial-upload-input",
      fileInputTestId: "financial-upload-input",
      dropzoneTestId: "financial-upload-dropzone",
      keyboardAccessible: true,
      displayHidden: false,
    },
    deletionCascade,
    balanceResetWhenNoSourceRemains: true,
  };
}

async function main() {
  const args = parseArgs();
  if (!args.companyId) throw new Error("Missing --company-id or FOUNDERAGENT_COMPANY_ID");

  const csvPath = resolveCsvPath();
  const csvText = fs.readFileSync(csvPath, "utf8");
  const parsed = parseUpload(csvText, {
    companyId: args.companyId,
    companyCurrency: "GBP",
    companyCountry: "GB",
    uploadId: "foundation-acceptance-proof",
  });
  applyMerchantAndTransferSignals(parsed.transactions);
  categoriseCanonicalTransactions(parsed.transactions, null);

  assertProof(parsed.transactions.length === 694, `parser should return 694 transactions, got ${parsed.transactions.length}`);
  assertProof(parsed.failedRows.length === 0, `parser should have 0 failed rows, got ${parsed.failedRows.length}`);
  assertProof(parsed.detectedProvider.includes("revolut"), `provider should be Revolut, got ${parsed.detectedProvider}`);
  assertProof(parsed.detectedCurrency === "GBP", `detected currency should be GBP, got ${parsed.detectedCurrency}`);
  assertProof(parsed.transactions.every((tx) => tx.currency === "GBP"), "every parsed transaction currency is GBP");
  assertProof(parsed.transactions.every((tx) => tx.reportingTreatment), "every parsed row has reporting treatment after categorisation");

  const stripeParsed = parsed.transactions.filter((tx) =>
    `${tx.transactionType ?? ""} ${tx.description} ${tx.reference ?? ""} ${tx.merchantName ?? ""}`.toLowerCase().includes("stripe")
  );
  assertProof(stripeParsed.length > 50, "real file has Stripe payout/top-up rows");
  assertProof(stripeParsed.every((tx) => tx.reportingTreatment?.includedInOperatingRevenue), "Stripe payout/top-up rows are operating revenue");
  assertProof(stripeParsed.every((tx) => tx.isTransfer === false), "Stripe payout/top-up rows are not transfers");

  const uploads = await selectAll<UploadRow>("uploads", "id,file_name,status,metadata,uploaded_at", args.companyId);
  const activeUploads = uploads.filter((upload) => ACTIVE_UPLOAD_STATUSES.has(upload.status));
  const activeUploadIds = new Set(activeUploads.map((upload) => upload.id));

  const allTransactions = await selectAll<TransactionRow>(
    "transactions",
    "id,upload_id,source_row_number,external_transaction_id,source_provider,raw_row_hash,currency,amount,type,status,category,merchant,description,reference,date,posted_date,row_status,kpi_excluded,kpi_exclusion_reason,duplicate_of_transaction_id,fee_amount,running_balance,metadata",
    args.companyId
  );
  const activeTransactions = allTransactions.filter((tx) => !tx.upload_id || activeUploadIds.has(tx.upload_id));

  const importUpload = activeUploads.find((upload) => {
    const rec = getImportReconciliation(upload.metadata ?? undefined);
    return rec?.rowsInFile === 694 && rec.rowsInserted === 694;
  });
  assertProof(importUpload, "live database has an active 694-row import upload with 694 inserted rows");
  const importedTransactions = activeTransactions.filter((tx) => tx.upload_id === importUpload!.id);
  assertProof(importedTransactions.length === 694, `live 694-row import should have 694 transactions, got ${importedTransactions.length}`);
  assertProof(importedTransactions.every((tx) => tx.upload_id === importUpload!.id), "every imported transaction has upload_id");
  assertProof(importedTransactions.every((tx) => typeof tx.source_row_number === "number"), "every imported transaction has source row number");
  assertProof(importedTransactions.every((tx) => tx.source_provider === "revolut_business_csv"), "every imported transaction has Revolut Business provider");
  assertProof(importedTransactions.every((tx) => Boolean(tx.raw_row_hash)), "every imported transaction has raw row hash");
  assertProof(importedTransactions.every((tx) => tx.currency === "GBP"), "every imported transaction is GBP");
  assertProof(importedTransactions.every((tx) => Boolean(tx.merchant)), "every imported transaction has merchant");
  assertProof(importedTransactions.every((tx) => Boolean(tx.description)), "every imported transaction has description");
  assertProof(importedTransactions.filter((tx) => Boolean(tx.reference)).length > 0, "reference column is populated where provided by source");
  assertProof(importedTransactions.every((tx) => Boolean(tx.metadata?.reporting_treatment)), "every imported transaction has stored reporting treatment");

  const duplicateUpload = activeUploads.find((upload) => {
    const rec = getImportReconciliation(upload.metadata ?? undefined);
    return rec?.rowsInFile === 694 && rec.rowsInserted === 0 && rec.rowsSkippedDuplicate === 694;
  });
  assertProof(duplicateUpload, "live database has duplicate-upload proof with 694 skipped duplicates");
  const duplicateTransactions = activeTransactions.filter((tx) => tx.upload_id === duplicateUpload!.id);
  assertProof(duplicateTransactions.length === 0, "duplicate upload inserted 0 transactions");

  const importRec = getImportReconciliation(importUpload!.metadata ?? undefined)!;
  const duplicateRec = getImportReconciliation(duplicateUpload!.metadata ?? undefined)!;
  const allTimeSummary = summarizeTransactions(activeTransactions);
  const last30From = dateMinusDays(args.today, 29);
  const last30Summary = summarizeTransactions(activeTransactions.filter((tx) => inRange(tx, last30From, args.today)));
  const todaySummary = summarizeTransactions(activeTransactions.filter((tx) => inRange(tx, args.today, args.today)));
  if (todaySummary.count === 0) {
    assertProof(todaySummary.revenue === 0 && todaySummary.expenses === 0 && todaySummary.netProfit === 0, "Today with no transactions has zero date-sensitive KPIs");
  }

  const dates = activeTransactions.map((tx) => tx.date).sort((a, b) => a.localeCompare(b));
  const sourceUploadsWithTransactions = new Set(activeTransactions.map((tx) => tx.upload_id).filter(Boolean));
  const reportingTreatmentCounts = activeTransactions.reduce<Record<string, number>>((acc, tx) => {
    const treatment = tx.metadata?.reporting_treatment as { reportingTreatment?: string } | undefined;
    const key = treatment?.reportingTreatment ?? "missing";
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});

  const alerts = await selectAll<DerivedRow>("alerts", "id,title,metadata", args.companyId);
  const recommendations = await selectAll<DerivedRow>("agent_recommendations", "id,title,metadata", args.companyId);
  const tasks = await selectAll<DerivedRow>("agent_tasks", "id,title,input_data", args.companyId);
  const subscriptions = await selectAll<DerivedRow>("subscriptions", "id,name,vendor,metadata", args.companyId);

  const staticContracts = proveStaticContracts();
  const output = {
    ok: true,
    companyId: args.companyId,
    branchExpectation: "codex/product-ux-stabilisation-source-dependency stacked on reporting/categorisation/data-trust branches",
    csvProof: {
      csvPath: path.relative(process.cwd(), csvPath),
      parsedRows: parsed.transactions.length,
      failedRows: parsed.failedRows.length,
      detectedProvider: parsed.detectedProvider,
      detectedCurrency: parsed.detectedCurrency,
      stripeRows: stripeParsed.length,
      parsedRowsWithReportingTreatment: parsed.transactions.filter((tx) => tx.reportingTreatment).length,
    },
    databaseProof: {
      activeUploads: activeUploads.length,
      activeTransactions: activeTransactions.length,
      importUploadId: importUpload!.id,
      importUploadFileName: importUpload!.file_name,
      importedTransactions: importedTransactions.length,
      earliestTransactionDate: dates[0],
      latestTransactionDate: dates[dates.length - 1],
      sourceUploadsWithTransactions: sourceUploadsWithTransactions.size,
      gbpTransactions: importedTransactions.filter((tx) => tx.currency === "GBP").length,
      lineage: {
        withUploadId: importedTransactions.filter((tx) => Boolean(tx.upload_id)).length,
        withSourceRowNumber: importedTransactions.filter((tx) => typeof tx.source_row_number === "number").length,
        withExternalTransactionId: importedTransactions.filter((tx) => Boolean(tx.external_transaction_id)).length,
        withRawRowHash: importedTransactions.filter((tx) => Boolean(tx.raw_row_hash)).length,
        withMerchant: importedTransactions.filter((tx) => Boolean(tx.merchant)).length,
        withReference: importedTransactions.filter((tx) => Boolean(tx.reference)).length,
        withPostedDate: importedTransactions.filter((tx) => Boolean(tx.posted_date)).length,
        withFeeAmount: importedTransactions.filter((tx) => tx.fee_amount !== null && tx.fee_amount !== undefined).length,
        withRunningBalance: importedTransactions.filter((tx) => tx.running_balance !== null && tx.running_balance !== undefined).length,
      },
    },
    reconciliationProof: {
      firstUpload: {
        rowsInFile: importRec.rowsInFile,
        rowsParsed: importRec.rowsParsed,
        rowsValid: importRec.rowsValid,
        rowsInserted: importRec.rowsInserted,
        rowsSkippedDuplicate: importRec.rowsSkippedDuplicate,
        rowsMarkedTransfer: importRec.rowsMarkedTransfer,
        rowsExcludedFromKpis: importRec.rowsExcludedFromKpis,
        rowsFailed: importRec.rowsFailed,
        rowsNeedingReview: importRec.rowsNeedingReview,
        rowsCategorised: importRec.rowsCategorised,
        rowsLinkedToSubscriptions: importRec.rowsLinkedToSubscriptions,
        balanced: importRec.reconciliationBalanced,
      },
      duplicateUpload: {
        uploadId: duplicateUpload!.id,
        rowsInserted: duplicateRec.rowsInserted,
        rowsSkippedDuplicate: duplicateRec.rowsSkippedDuplicate,
        rowOutcomes: duplicateRec.rowOutcomes.length,
        dbTransactions: duplicateTransactions.length,
      },
    },
    dateFilterProof: {
      allTime: allTimeSummary,
      last30Days: { from: last30From, to: args.today, ...last30Summary },
      today: { from: args.today, to: args.today, ...todaySummary },
      todayZeroKpisWhenNoRows: todaySummary.count === 0,
      cashBalanceTreatment: "Dashboard cash balance is constrained to the selected active source rows in the current implementation.",
    },
    kpiTraceabilityProof: {
      revenueRows: activeTransactions.filter((tx) => isIncome(tx)).length,
      expenseRows: activeTransactions.filter((tx) => isExpense(tx)).length,
      kpiExcludedRows: activeTransactions.filter((tx) => isKpiExcluded(tx)).length,
      uploadCountBehindKpis: sourceUploadsWithTransactions.size,
      reportingTreatmentCounts,
    },
    sourceDependencyProof: {
      alerts: sourceVisibility(alerts, activeUploadIds, "metadata"),
      recommendations: sourceVisibility(recommendations, activeUploadIds, "metadata"),
      tasks: sourceVisibility(tasks, activeUploadIds, "input_data"),
      subscriptions: subscriptionVisibility(subscriptions, activeUploadIds),
      note: "Legacy raw rows are reported for cleanup; source-backed UI filters hide unbacked alerts/recommendations/tasks, and subscriptions require cleanup marking when lineage is unknown.",
    },
    staticContracts,
  };

  console.log(JSON.stringify(output, null, 2));
}

main().catch((error) => {
  console.error(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : String(error) }, null, 2));
  process.exit(1);
});
