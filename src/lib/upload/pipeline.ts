/**
 * Upload Processing Pipeline
 * Orchestrates the full flow: download → parse → normalise → categorise → detect → insert → recommend
 */

"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { getCompanySettings } from "@/lib/db/company_settings";
import { updateUploadStatus } from "@/lib/db/uploads";
import { createTransactionsChunked } from "@/lib/db/transactions";
import { createSubscription, findSubscriptionByVendor, updateSubscription } from "@/lib/db/subscriptions";
import { createAlert } from "@/lib/db/alerts";
import { createAgentRecommendation } from "@/lib/db/agent-recommendations";
import { createAgentTask } from "@/lib/db/agent-tasks";
import { getOrCreateBankAccount, updateBankAccountBalance } from "@/lib/db/bank-accounts";
import { recalculateCompanyMetrics } from "@/lib/db/company-metrics";
import { parseCsv } from "@/lib/parser/csv-core";
import { detectCsvSource } from "@/lib/parser/detect";
import { parseGenericCsv } from "@/lib/parser/adapters/generic-csv";
import { categoriseRows, getCategoryBreakdown } from "@/lib/intelligence/categoriser";
import type { TransactionCategoryType, TransactionStatus } from "@/lib/types";
import { detectSubscriptions, detectDuplicateTools } from "@/lib/intelligence/subscription-detector";
import { detectAnomalies } from "@/lib/intelligence/anomaly-detector";
import { generateRecommendations, type UploadFindings } from "@/lib/intelligence/recommendation-engine";
import { generateTasksFromRecommendations, generateTasksFromSubscriptions } from "@/lib/intelligence/task-generator";
import { revalidatePath } from "next/cache";

export interface PipelineResult {
  success: boolean;
  uploadId: string;
  companyId: string;
  transactionsInserted: number;
  transactionsFailed: number;
  subscriptionsDetected: number;
  subscriptionsCreated: number;
  alertsCreated: number;
  recommendationsCreated: number;
  tasksCreated: number;
  error?: string;
}

const BUCKET_NAME = "financial_uploads";

async function setPipelineStage(
  uploadId: string,
  companyId: string,
  stageName: string,
  progress: number,
  processedRows?: number,
  failedRows?: number
) {
  const updates: Record<string, unknown> = {
    pipeline_stage: stageName,
    pipeline_progress: progress,
  };
  if (processedRows !== undefined) updates.processed_rows = processedRows;
  if (failedRows !== undefined) updates.failed_rows = failedRows;

  await updateUploadStatus(uploadId, companyId, {
    status: progress >= 100 ? "completed" : "processing",
    metadata: updates,
  });
}

export async function runUploadPipeline(
  uploadId: string,
  companyId: string
): Promise<PipelineResult> {
  const adminClient = createAdminClient();
  if (!adminClient) throw new Error("Admin client not available");

  // Fetch upload record
  const { data: upload, error: uploadError } = await adminClient
    .from("uploads")
    .select("*")
    .eq("id", uploadId)
    .eq("company_id", companyId)
    .single();

  if (uploadError || !upload) {
    throw new Error(`Upload not found: ${uploadError?.message}`);
  }

  if (upload.status === "completed") {
    return {
      success: true,
      uploadId,
      companyId,
      transactionsInserted: upload.transaction_count ?? 0,
      transactionsFailed: 0,
      subscriptionsDetected: 0,
      subscriptionsCreated: 0,
      alertsCreated: 0,
      recommendationsCreated: 0,
      tasksCreated: 0,
    };
  }

  // Update status to processing
  await updateUploadStatus(uploadId, companyId, { status: "processing", metadata: { started_at: new Date().toISOString() } });

  try {
    // 1. Download file from storage
    await setPipelineStage(uploadId, companyId, "reading", 5);

    const { data: fileData, error: downloadError } = await adminClient.storage
      .from(BUCKET_NAME)
      .download(upload.file_path);

    if (downloadError || !fileData) {
      throw new Error(`Download failed: ${downloadError?.message}`);
    }

    const text = await fileData.text();

    // 2. Parse CSV
    await setPipelineStage(uploadId, companyId, "mapping", 15);

    const parsed = parseCsv(text);
    if (parsed.rows.length === 0) {
      throw new Error("No valid data rows found in CSV");
    }

    // 3. Get company settings for currency and country
    let companyCurrency: string | undefined;
    let companyCountry: string | undefined;
    try {
      const settings = await getCompanySettings(companyId);
      companyCurrency = settings?.currency ?? undefined;
      companyCountry = settings?.country ?? undefined;
    } catch {
      // Settings may not exist
    }

    // 4. Parse and normalise rows
    await setPipelineStage(uploadId, companyId, "validating", 25);

    const detectedSource = detectCsvSource(parsed.headers);

    const parseResult = parseGenericCsv(parsed, {
      companyId,
      companyCurrency,
      companyCountry,
      uploadId,
      source: detectedSource,
    });

    if (parseResult.rows.length === 0) {
      throw new Error(
        `Could not parse any valid transactions. Failed rows: ${parseResult.failedRows.length}. Missing columns: ${parseResult.mappingReport.missingRequired.join(", ")}`
      );
    }

    // 5. Categorise rows
    await setPipelineStage(uploadId, companyId, "categorising", 65, parseResult.rows.length, parseResult.failedRows.length);

    let categorisedRows = categoriseRows(parseResult.rows);
    const categoryBreakdown = getCategoryBreakdown(categorisedRows);

    // Transfer detection
    for (const row of categorisedRows) {
      const isTransfer = row.metadata?.is_transfer === true || row.rawData["Type"] === "TRANSFER";
      if (isTransfer) {
        row.category = "Transfer";
        if (!row.metadata) row.metadata = {};
        row.metadata.is_transfer = true;
      }
    }

    // Deduplicate by external_id
    const existingExternalIds = new Set<string>();
    if (categorisedRows.some(r => r.metadata?.external_id)) {
      const ids = categorisedRows.map(r => r.metadata?.external_id).filter(Boolean) as string[];
      const { data: existing } = await adminClient
        .from("transactions")
        .select("metadata")
        .eq("company_id", companyId)
        .in("metadata->>external_id", ids);
      existing?.forEach(e => {
        const extId = (e.metadata as Record<string, unknown> | null)?.external_id;
        if (typeof extId === "string") existingExternalIds.add(extId);
      });
    }

    const deduplicatedRows = categorisedRows.filter(row => {
      const extId = row.metadata?.external_id as string | undefined;
      if (extId && existingExternalIds.has(extId)) return false;
      return true;
    });

    categorisedRows = deduplicatedRows;

    // 7. Detect anomalies
    await setPipelineStage(uploadId, companyId, "detecting_anomalies", 85);

    const anomalies = await detectAnomalies(categorisedRows, { companyId });

    // 8. Prepare transaction inserts
    await setPipelineStage(uploadId, companyId, "importing", 50);

    // Determine bank account from upload source
    const accountName = (upload.metadata as Record<string, unknown> | undefined)?.account_name;
    const bankAccountName = typeof accountName === "string"
      ? `Revolut Business — ${accountName}`
      : upload.source
        ? `${upload.source.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase())}`
        : "Bank Account";
    const bankAccount = await getOrCreateBankAccount(companyId, bankAccountName, companyCurrency || "GBP");

    const transactionInserts = categorisedRows.map((row) => ({
      companyId,
      uploadId,
      bankAccountId: bankAccount.id,
      date: row.date,
      merchant: row.merchant,
      description: row.description,
      category: row.category,
      amount: row.amount,
      type: row.type,
      status: row.status,
      confidenceScore: row.confidenceScore,
      metadata: {
        raw_data: row.rawData,
        currency: row.currency,
        original_amount: row.originalAmount,
        original_currency: row.originalCurrency,
        company_currency: companyCurrency,
        conversion_status: row.originalCurrency && row.originalCurrency !== companyCurrency ? "pending" : "none",
        category_reason: row.categoryReason,
        parser_version: "1.1.0",
      },
    }));

    // 9. Insert transactions (chunked to avoid Postgres param limit)
    const insertResult = await createTransactionsChunked(transactionInserts);
    if (insertResult.error) {
      throw new Error(`Transaction insert failed: ${insertResult.error}`);
    }

    const transactionsInserted = insertResult.count;
    const transactionsFailed = parseResult.failedRows.length;

    // Fetch historical transactions for merged subscription detection
    const vendors = [...new Set(categorisedRows.map((r) => r.merchant))].filter(Boolean);
    let historicalRows: typeof categorisedRows = [];
    if (vendors.length > 0 && companyId) {
      try {
        const { data: histData } = await adminClient
          .from("transactions")
          .select("date, merchant, description, category, amount, type, status, confidence_score, metadata")
          .eq("company_id", companyId)
          .eq("type", "expense")
          .in("merchant", vendors)
          .neq("upload_id", uploadId)
          .order("date", { ascending: true })
          .limit(500);

        if (histData) {
          historicalRows = histData.map((row, idx) => ({
            rowNumber: idx + 10000, // offset to avoid collision
            date: row.date as string,
            merchant: row.merchant as string,
            description: row.description as string,
            amount: Number(row.amount),
            type: row.type as "income" | "expense",
            currency: (row.metadata as Record<string, unknown> | null)?.currency as string | undefined,
            category: row.category as TransactionCategoryType,
            status: row.status as TransactionStatus,
            confidenceScore: row.confidence_score as number,
            categoryReason: (row.metadata as Record<string, unknown> | null)?.category_reason as string || "historical",
            rawData: (row.metadata as Record<string, unknown> | null)?.raw_data as Record<string, string> || {},
            parseErrors: [],
          }));
        }
      } catch (err) {
        console.error("[pipeline] Failed to fetch historical transactions:", err);
      }
    }

    // 6. Detect subscriptions with historical data merged
    await setPipelineStage(uploadId, companyId, "detecting_subscriptions", 75);

    const allRowsForSubs = [...historicalRows, ...categorisedRows];
    const detectedSubs = detectSubscriptions(allRowsForSubs);
    const duplicateTools = detectDuplicateTools(detectedSubs);

    // 10. Create/update subscriptions
    await setPipelineStage(uploadId, companyId, "generating_recommendations", 92);

    let subscriptionsCreated = 0;
    for (const sub of detectedSubs) {
      try {
        const existing = await findSubscriptionByVendor(companyId, sub.vendor);
        if (!existing) {
          await createSubscription({
            companyId,
            name: sub.name,
            vendor: sub.vendor,
            category: sub.category,
            amount: sub.amount,
            billingCycle: sub.billingCycle,
            nextBillingDate: sub.nextBillingDate,
            startDate: sub.startDate,
            metadata: {
              detected_from_upload: uploadId,
              confidence: sub.confidence,
              transaction_count: sub.transactionCount,
            },
          });
          subscriptionsCreated++;
        } else {
          // Update existing subscription with latest data
          await updateSubscription(existing.id, companyId, {
            amount: sub.amount,
            nextBillingDate: sub.nextBillingDate,
            metadata: {
              ...((existing.metadata || {}) as Record<string, unknown>),
              last_detected_from_upload: uploadId,
              transaction_count: sub.transactionCount,
              updated_at: new Date().toISOString(),
            },
          });
        }
      } catch (err) {
        console.error("[pipeline] Subscription creation/update failed:", err);
      }
    }

    // 11. Create alerts for anomalies + foreign currency
    let alertsCreated = 0;
    for (const anomaly of anomalies) {
      try {
        await createAlert({
          companyId,
          title: anomaly.title,
          description: anomaly.description,
          severity: anomaly.severity,
          category: "spending",
          resourceType: "transaction",
          metadata: {
            anomaly_reason: anomaly.reason,
            amount: anomaly.amount,
            merchant: anomaly.merchant,
            upload_id: uploadId,
          },
        });
        alertsCreated++;
      } catch (err) {
        console.error("[pipeline] Alert creation failed:", err);
      }
    }

    // Create foreign currency alerts
    const foreignCurrencyRows = categorisedRows.filter(
      (r) => r.originalCurrency && r.originalCurrency !== companyCurrency
    );
    if (foreignCurrencyRows.length > 0) {
      try {
        await createAlert({
          companyId,
          title: "Foreign currency transactions detected",
          description: `${foreignCurrencyRows.length} transaction(s) were imported in foreign currency and need conversion.`,
          severity: "medium",
          category: "currency",
          resourceType: "upload",
          metadata: {
            upload_id: uploadId,
            foreign_count: foreignCurrencyRows.length,
            currencies: [...new Set(foreignCurrencyRows.map((r) => r.originalCurrency))],
          },
        });
        alertsCreated++;
      } catch (err) {
        console.error("[pipeline] Foreign currency alert failed:", err);
      }
    }

    // 12. Generate recommendations
    const findings: UploadFindings = {
      rows: categorisedRows,
      subscriptions: detectedSubs,
      duplicateTools,
      anomalies,
      categoryBreakdown,
    };

    const recommendations = generateRecommendations(findings);
    let recommendationsCreated = 0;
    for (const rec of recommendations) {
      try {
        await createAgentRecommendation({
          companyId,
          title: rec.title,
          description: rec.description,
          category: rec.category,
          potentialSavings: rec.potentialSavings,
          impactScore: rec.impactScore,
          effortScore: rec.effortScore,
          status: "new",
          metadata: {
            source: rec.source,
            severity: rec.severity,
            upload_id: uploadId,
          },
        });
        recommendationsCreated++;
      } catch (err) {
        console.error("[pipeline] Recommendation creation failed:", err);
      }
    }

    // 13. Generate agent tasks
    const tasks = [
      ...generateTasksFromRecommendations(recommendations),
      ...generateTasksFromSubscriptions(detectedSubs),
    ];
    let tasksCreated = 0;
    for (const task of tasks) {
      try {
        await createAgentTask({
          companyId,
          title: task.title,
          taskType: task.taskType,
          priority: task.priority,
          inputData: {
            ...task.inputData,
            upload_id: uploadId,
            estimated_saving: task.estimatedSaving,
          },
        });
        tasksCreated++;
      } catch (err) {
        console.error("[pipeline] Task creation failed:", err);
      }
    }

    // 14. Determine final upload status — FIX: only "failed" if zero inserted
    const finalStatus = transactionsInserted === 0
      ? "failed"
      : transactionsFailed > 0
        ? "completed_with_warnings"
        : "completed";

    // 15. Update upload record
    await updateUploadStatus(uploadId, companyId, {
      status: finalStatus,
      transactionCount: transactionsInserted,
      processedAt: new Date().toISOString(),
      metadata: {
        parser_version: "1.1.0",
        column_mapping: parseResult.mappingReport.mapping,
        mapping_confidence: parseResult.mappingReport.overallConfidence,
        detected_currency: parseResult.currencyResult,
        row_errors: parseResult.failedRows.map((f) => ({
          row_number: f.rowNumber,
          errors: f.errors,
          raw_row: f.rawRow,
        })),
        category_breakdown: categoryBreakdown,
        subscriptions_detected: detectedSubs.length,
        subscriptions_created: subscriptionsCreated,
        alerts_created: alertsCreated,
        recommendations_created: recommendationsCreated,
        tasks_created: tasksCreated,
        foreign_currency_count: foreignCurrencyRows.length,
      },
    });

    // 16. Log activity
    await adminClient.from("agent_activity_logs").insert({
      company_id: companyId,
      action: "upload_processed",
      resource_type: "upload",
      resource_id: uploadId,
      output_data: {
        transaction_count: transactionsInserted,
        failed_count: transactionsFailed,
        subscriptions_created: subscriptionsCreated,
        alerts_created: alertsCreated,
        recommendations_created: recommendationsCreated,
        tasks_created: tasksCreated,
      },
    });

    // 16b. Update bank account balance from uploaded data or computed total
    try {
      // Try to extract latest running balance from uploaded rows
      let latestBalance: number | null = null;
      let latestDate: string | null = null;
      for (const row of categorisedRows) {
        const raw = (row.rawData || {}) as Record<string, unknown>;
        const balVal = raw["balance"] ?? raw["Balance"] ?? raw["Running Balance"] ?? raw["running balance"] ?? raw["Current Balance"];
        if (balVal !== undefined && balVal !== null && balVal !== "") {
          const balNum = parseFloat(String(balVal).replace(/[$£€¥₹,]/g, ""));
          if (!isNaN(balNum)) {
            const rowDate = String(raw["date"] ?? raw["Date"] ?? row.date ?? "");
            if (!latestDate || rowDate >= latestDate) {
              latestBalance = balNum;
              latestDate = rowDate;
            }
          }
        }
      }

      if (latestBalance !== null && bankAccount) {
        await updateBankAccountBalance(bankAccount.id, companyId, latestBalance);
      } else if (bankAccount) {
        // Fallback: compute from all transactions for this account
        const { data: txns } = await adminClient
          .from("transactions")
          .select("amount, type")
          .eq("bank_account_id", bankAccount.id)
          .eq("company_id", companyId);
        if (txns) {
          const computed = txns.reduce((sum, t) => {
            return sum + (t.type === "income" ? t.amount : -t.amount);
          }, 0);
          await updateBankAccountBalance(bankAccount.id, companyId, computed);
        }
      }
    } catch (err) {
      console.error("[pipeline] Balance update failed:", err);
    }

    // 16c. Recalculate cached company metrics for key periods
    try {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const startOfQuarter = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
      const startOfYear = new Date(now.getFullYear(), 0, 1);
      const endOfPeriod = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

      await recalculateCompanyMetrics(companyId, "month", startOfMonth.toISOString(), endOfPeriod.toISOString());
      await recalculateCompanyMetrics(companyId, "quarter", startOfQuarter.toISOString(), endOfPeriod.toISOString());
      await recalculateCompanyMetrics(companyId, "year", startOfYear.toISOString(), endOfPeriod.toISOString());
      await recalculateCompanyMetrics(companyId, "all", "1970-01-01", endOfPeriod.toISOString());
    } catch (err) {
      console.error("[pipeline] Metrics recalculation failed:", err);
    }

    // 17. Revalidate dashboard routes
    revalidatePath("/dashboard");
    revalidatePath("/transactions");
    revalidatePath("/expenses");
    revalidatePath("/revenue");
    revalidatePath("/subscriptions");
    revalidatePath("/alerts");
    revalidatePath("/agent-tasks");
    revalidatePath("/ai-insights");
    revalidatePath("/upload-centre");

    return {
      success: finalStatus !== "failed",
      uploadId,
      companyId,
      transactionsInserted,
      transactionsFailed,
      subscriptionsDetected: detectedSubs.length,
      subscriptionsCreated,
      alertsCreated,
      recommendationsCreated,
      tasksCreated,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";

    // Update upload as failed
    await updateUploadStatus(uploadId, companyId, {
      status: "failed",
      errorMessage: message,
      metadata: { pipeline_stage: "failed", pipeline_progress: 0 },
    });

    // Log failure
    await adminClient.from("agent_activity_logs").insert({
      company_id: companyId,
      action: "upload_failed",
      resource_type: "upload",
      resource_id: uploadId,
      output_data: { error: message },
    });

    return {
      success: false,
      uploadId,
      companyId,
      transactionsInserted: 0,
      transactionsFailed: 0,
      subscriptionsDetected: 0,
      subscriptionsCreated: 0,
      alertsCreated: 0,
      recommendationsCreated: 0,
      tasksCreated: 0,
      error: message,
    };
  }
}
