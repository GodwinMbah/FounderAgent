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
import { createAlert, createAlertsBatch } from "@/lib/db/alerts";
import { normalizeAlertCategory } from "@/lib/db/alert-helpers";
import { createAgentRecommendationsBatch } from "@/lib/db/agent-recommendations";
import { createAgentTasksBatch } from "@/lib/db/agent-tasks";
import { getOrCreateBankAccount, updateBankAccountBalance } from "@/lib/db/bank-accounts";
import { recalculateCompanyMetrics } from "@/lib/db/company-metrics";
import { parseCsv } from "@/lib/parser/csv-core";
import { parseUpload } from "@/lib/parser/unified-parser";
import { getCategoryBreakdown } from "@/lib/intelligence/categoriser";
import { categoriseWithV3AndV1Fallback } from "@/lib/upload/categoriser-v3-adapter";
import { enrichMerchant } from "@/lib/intelligence/merchant-enrichment";
import { detectTransfer } from "@/lib/intelligence/transfer-detector";
import { detectDuplicate } from "@/lib/intelligence/duplicate-detector-v2";
import { canonicalListToNormalised } from "@/lib/providers/canonical-adapter";
import { toDbTransaction } from "@/lib/providers/canonical-model";
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
  totalParsed: number;
  duplicateCount: number;
  transferCount: number;
  needReviewCount: number;
  categorisedCount: number;
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
  console.log(`[pipeline] Starting pipeline for upload ${uploadId}, company ${companyId}`);
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
    console.error(`[pipeline] Upload not found: ${uploadError?.message}`);
    throw new Error(`Upload not found: ${uploadError?.message}`);
  }

  if (upload.status === "processing") {
    console.log(`[pipeline] Upload already processing`);
    return {
      success: false,
      uploadId,
      companyId,
      transactionsInserted: 0,
      transactionsFailed: 0,
      totalParsed: 0,
      duplicateCount: 0,
      transferCount: 0,
      needReviewCount: 0,
      categorisedCount: 0,
      subscriptionsDetected: 0,
      subscriptionsCreated: 0,
      alertsCreated: 0,
      recommendationsCreated: 0,
      tasksCreated: 0,
      error: "Upload is already being processed",
    };
  }

  if (upload.status === "completed") {
    const meta = (upload.metadata as Record<string, unknown> | null) || {};
    return {
      success: true,
      uploadId,
      companyId,
      transactionsInserted: upload.transaction_count ?? 0,
      transactionsFailed: 0,
      totalParsed: (meta.total_parsed as number) ?? 0,
      duplicateCount: (meta.duplicate_count as number) ?? 0,
      transferCount: (meta.transfer_count as number) ?? 0,
      needReviewCount: (meta.needs_review_count as number) ?? 0,
      categorisedCount: (meta.categorised_count as number) ?? 0,
      subscriptionsDetected: (meta.subscriptions_detected as number) ?? 0,
      subscriptionsCreated: (meta.subscriptions_created as number) ?? 0,
      alertsCreated: (meta.alerts_created as number) ?? 0,
      recommendationsCreated: (meta.recommendations_created as number) ?? 0,
      tasksCreated: (meta.tasks_created as number) ?? 0,
    };
  }

  // Update status to processing
  await updateUploadStatus(uploadId, companyId, { status: "processing", metadata: { started_at: new Date().toISOString() } });

  let transactionsInserted = 0;
  let transactionsFailed = 0;
  let detectedSubs: ReturnType<typeof detectSubscriptions> = [];
  let subscriptionsCreated = 0;
  let alertsCreated = 0;
  let recommendationsCreated = 0;
  let tasksCreated = 0;

  try {
    // 1. Download file from storage
    await setPipelineStage(uploadId, companyId, "reading", 5);

    const { data: fileData, error: downloadError } = await adminClient.storage
      .from(BUCKET_NAME)
      .download(upload.file_path);

    if (downloadError || !fileData) {
      console.error(`[pipeline] Download failed: ${downloadError?.message}`);
      throw new Error(`Download failed: ${downloadError?.message}`);
    }

    const text = await fileData.text();

    // 2. Parse CSV
    await setPipelineStage(uploadId, companyId, "mapping", 15);

    const parsed = parseCsv(text);
    if (parsed.rows.length === 0) {
      console.error(`[pipeline] No valid data rows`);
      throw new Error("No valid data rows found in CSV");
    }

    // 3. Get company settings for currency, country and business profile
    let companySettings: Awaited<ReturnType<typeof getCompanySettings>> = null;
    let companyCurrency: string | undefined;
    let companyCountry: string | undefined;
    try {
      companySettings = await getCompanySettings(companyId);
      companyCurrency = companySettings?.currency ?? undefined;
      companyCountry = companySettings?.country ?? undefined;
    } catch {
      // Settings may not exist
    }

    // 4. Parse and normalise rows using unified parser
    await setPipelineStage(uploadId, companyId, "validating", 25);

    const parseResult = parseUpload(text, {
      companyId,
      companyCurrency,
      companyCountry,
      uploadId,
    });

    if (parseResult.transactions.length === 0) {
      console.error(`[pipeline] Could not parse any valid transactions`);
      throw new Error(
        `Could not parse any valid transactions. Failed rows: ${parseResult.failedRows.length}. Provider: ${parseResult.detectedProvider}`
      );
    }

    // Enrich merchants
    for (const tx of parseResult.transactions) {
      const enriched = enrichMerchant(tx.merchantName);
      tx.merchantName = enriched.displayName;
      if (!tx.category && enriched.categoryHint) {
        tx.category = enriched.categoryHint;
      }
    }

    // Detect transfers
    for (const tx of parseResult.transactions) {
      const transferResult = detectTransfer({
        transactionType: tx.transactionType,
        description: tx.description,
        reference: tx.reference,
        amount: tx.amount,
        merchantName: tx.merchantName,
        counterpartyName: tx.counterpartyName,
        accountName: tx.accountName,
        currency: tx.currency,
        transactionDate: tx.transactionDate,
        externalTransactionId: tx.externalTransactionId,
      }, {
        sourceProvider: tx.sourceProvider,
      });
      if (transferResult.isTransfer) {
        tx.isTransfer = true;
        tx.status = "transfer";
        tx.category = "Transfers";
        tx.transferPairId = transferResult.transferPairId;
        tx.reviewReason = transferResult.reviewReason;
      }
    }

    // Detect duplicates against existing transactions
    const { data: existingTxs } = await adminClient
      .from("transactions")
      .select("date, amount, type, merchant, metadata")
      .eq("company_id", companyId)
      .limit(1000);

    const existingForDedup = (existingTxs || []).map((t) => {
      const meta = (t.metadata as Record<string, unknown> | null) || {};
      // DB stores absolute amounts; restore signed amount for hash comparison
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

    for (const tx of parseResult.transactions) {
      const dupResult = detectDuplicate(tx, existingForDedup);
      if (dupResult.isDuplicate) {
        tx.isPossibleDuplicate = true;
        tx.status = "possible_duplicate";
        tx.reviewReason = dupResult.reason;
      }
    }

    // Convert to normalised rows for downstream compatibility
    const normalisedRows = canonicalListToNormalised(parseResult.transactions);

    // 5. Categorise rows
    await setPipelineStage(uploadId, companyId, "categorising", 65, normalisedRows.length, parseResult.failedRows.length);

    // Primary: v3 with business profile context + v1 fallback for low confidence
    let categorisedRows = categoriseWithV3AndV1Fallback(normalisedRows, companySettings);
    const categoryBreakdown = getCategoryBreakdown(categorisedRows);

    // Propagate v3 categories back to canonical transactions so they are used for insertion
    for (let i = 0; i < categorisedRows.length && i < parseResult.transactions.length; i++) {
      if (categorisedRows[i].category) {
        // Never overwrite transfer or duplicate classifications
        if (!parseResult.transactions[i].isTransfer) {
          parseResult.transactions[i].category = categorisedRows[i].category;
        }
        parseResult.transactions[i].confidenceScore = categorisedRows[i].confidenceScore ?? parseResult.transactions[i].confidenceScore;
        if (!parseResult.transactions[i].isTransfer && !parseResult.transactions[i].isPossibleDuplicate) {
          parseResult.transactions[i].status = categorisedRows[i].status ?? parseResult.transactions[i].status;
        }
      }
    }

    // Apply user preview category overrides stored in upload metadata
    const categoryOverrides = upload.metadata?.category_overrides as Record<number, string> | undefined;
    if (categoryOverrides && typeof categoryOverrides === "object") {
      for (let i = 0; i < parseResult.transactions.length; i++) {
        const rowNumber = i + 2; // 1-based CSV row, skipping header
        const overrideCategory = categoryOverrides[rowNumber];
        if (overrideCategory) {
          parseResult.transactions[i].category = overrideCategory;
          parseResult.transactions[i].confidenceScore = 100; // User-confirmed
          parseResult.transactions[i].status = "categorised";
        }
      }
    }

    // Skip already-detected transfers and duplicates (handled above in canonical flow)
    // Filter out duplicates from insertion
    const deduplicatedRows = categorisedRows.filter((_, i) => !parseResult.transactions[i]?.isPossibleDuplicate);
    categorisedRows = deduplicatedRows;

    // 7. Detect anomalies
    await setPipelineStage(uploadId, companyId, "detecting_anomalies", 85);

    const anomalies = await detectAnomalies(categorisedRows, { companyId });

    // 8. Prepare transaction inserts using canonical model
    await setPipelineStage(uploadId, companyId, "importing", 50);

    // Determine bank account from upload source
    const detectedProviderName = parseResult.detectedProvider
      ? parseResult.detectedProvider.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase())
      : "Bank Account";
    const bankAccountName = parseResult.accountName
      ? `${detectedProviderName} — ${parseResult.accountName}`
      : detectedProviderName;
    const bankAccount = await getOrCreateBankAccount(companyId, bankAccountName, companyCurrency || "GBP");

    // Use canonical model for inserts
    const transactionInserts = parseResult.transactions
      .filter((tx) => !tx.isPossibleDuplicate)
      .map((tx) => {
        const mapped = toDbTransaction(tx, companyId, uploadId, bankAccount.id);
        return {
          ...mapped,
          companyId,
          bankAccountId: mapped.accountId,
        };
      });

    // 9. Insert transactions (chunked to avoid Postgres param limit)
    console.log(`[pipeline] Inserting ${transactionInserts.length} transactions`);
    const insertResult = await createTransactionsChunked(transactionInserts as Parameters<typeof createTransactionsChunked>[0]);
    if (insertResult.error) {
      console.error(`[pipeline] Transaction insert failed: ${insertResult.error}`);
      throw new Error(`Transaction insert failed: ${insertResult.error}`);
    }
    console.log(`[pipeline] Inserted ${insertResult.count} transactions`);

    transactionsInserted = insertResult.count;
    transactionsFailed = parseResult.failedRows.length;

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
    detectedSubs = detectSubscriptions(allRowsForSubs);
    const duplicateTools = detectDuplicateTools(detectedSubs);

    // 10. Create/update subscriptions
    await setPipelineStage(uploadId, companyId, "generating_recommendations", 92);

    subscriptionsCreated = 0;
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

    // 11. Create alerts for anomalies + foreign currency (batched)
    const alertInserts: Parameters<typeof createAlertsBatch>[0] = [];
    for (const anomaly of anomalies) {
      alertInserts.push({
        companyId,
        title: anomaly.title,
        description: anomaly.description,
        severity: anomaly.severity,
        category: normalizeAlertCategory("spending"),
        resourceType: "transaction",
        metadata: {
          anomaly_reason: anomaly.reason,
          amount: anomaly.amount,
          merchant: anomaly.merchant,
          upload_id: uploadId,
        },
      });
    }

    const foreignCurrencyRows = categorisedRows.filter(
      (r) => r.originalCurrency && r.originalCurrency !== companyCurrency
    );
    if (foreignCurrencyRows.length > 0) {
      alertInserts.push({
        companyId,
        title: "Foreign currency transactions detected",
        description: `${foreignCurrencyRows.length} transaction(s) were imported in foreign currency and need conversion.`,
        severity: "warning",
        category: normalizeAlertCategory("currency"),
        resourceType: "upload",
        metadata: {
          upload_id: uploadId,
          foreign_count: foreignCurrencyRows.length,
          currencies: [...new Set(foreignCurrencyRows.map((r) => r.originalCurrency))],
        },
      });
    }

    if (alertInserts.length > 0) {
      try {
        const alertResult = await createAlertsBatch(alertInserts);
        if (alertResult.error) {
          console.error("[pipeline] Batch alert creation failed:", alertResult.error);
        } else {
          alertsCreated = alertResult.count;
        }
      } catch (err) {
        console.error("[pipeline] Alert batch creation failed:", err);
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
    recommendationsCreated = 0;
    const recommendationInserts = recommendations.map((rec) => ({
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
    }));
    if (recommendationInserts.length > 0) {
      try {
        const recResult = await createAgentRecommendationsBatch(recommendationInserts);
        if (recResult.error) {
          console.error("[pipeline] Batch recommendation creation failed:", recResult.error);
        } else {
          recommendationsCreated = recResult.count;
        }
      } catch (err) {
        console.error("[pipeline] Recommendation batch creation failed:", err);
      }
    }

    // 13. Generate agent tasks
    const tasks = [
      ...generateTasksFromRecommendations(recommendations),
      ...generateTasksFromSubscriptions(detectedSubs),
    ];
    tasksCreated = 0;
    const taskInserts = tasks.map((task) => ({
      companyId,
      title: task.title,
      taskType: task.taskType,
      priority: task.priority,
      inputData: {
        ...task.inputData,
        upload_id: uploadId,
        estimated_saving: task.estimatedSaving,
      },
    }));
    if (taskInserts.length > 0) {
      try {
        const taskResult = await createAgentTasksBatch(taskInserts);
        if (taskResult.error) {
          console.error("[pipeline] Batch task creation failed:", taskResult.error);
        } else {
          tasksCreated = taskResult.count;
        }
      } catch (err) {
        console.error("[pipeline] Task batch creation failed:", err);
      }
    }

    // 14. Determine final upload status
    // "failed" only if there were fatal errors AND nothing was inserted.
    // If all rows were duplicates (0 inserted but 694 parsed), that's a successful deduplication.
    const totalParsed = parseResult.transactions.length;
    const duplicateCount = parseResult.transactions.filter((tx) => tx.isPossibleDuplicate).length;
    const transferCount = parseResult.transactions.filter((tx) => tx.isTransfer).length;
    const needReviewCount = parseResult.transactions.filter((tx) => tx.status === "needs_review" && !tx.isPossibleDuplicate).length;
    const categorisedCount = parseResult.transactions.filter((tx) => tx.status === "categorised" && !tx.isPossibleDuplicate).length;
    const hasFatalErrors = transactionsFailed > 0 && transactionsInserted === 0;
    const allDuplicates = totalParsed > 0 && duplicateCount === totalParsed;
    const finalStatus = (transactionsInserted === 0 && !allDuplicates) || hasFatalErrors ? "failed" : "completed";

    // 15. Update upload record
    // Cap provider confidence at 100 to respect DB check constraint
    const cappedProviderConfidence = Math.min(100, parseResult.providerConfidence ?? 0);
    const metadata = {
      parser_version: "2.0.0",
      detected_provider: parseResult.detectedProvider,
      provider_confidence: cappedProviderConfidence,
      detected_currency: parseResult.detectedCurrency,
      detected_date_format: parseResult.detectedDateFormat,
      latest_balance: parseResult.latestBalance,
      total_parsed: totalParsed,
      duplicate_count: duplicateCount,
      transfer_count: transferCount,
      needs_review_count: needReviewCount,
      categorised_count: categorisedCount,
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
    };
    try {
      await updateUploadStatus(uploadId, companyId, {
        status: finalStatus,
        transactionCount: transactionsInserted,
        processedAt: new Date().toISOString(),
        providerDetected: parseResult.detectedProvider,
        providerConfidence: cappedProviderConfidence,
        metadata,
      });
    } catch (schemaErr) {
      const errMsg = schemaErr instanceof Error ? schemaErr.message : String(schemaErr);
      if (errMsg.includes("schema cache") || errMsg.includes("column") || errMsg.includes("check constraint")) {
        console.warn("[pipeline] Provider columns not in schema yet or constraint violation, falling back to metadata-only update");
        await updateUploadStatus(uploadId, companyId, {
          status: finalStatus,
          transactionCount: transactionsInserted,
          processedAt: new Date().toISOString(),
          metadata,
        });
      } else {
        throw schemaErr;
      }
    }

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

    // 16c. Recalculate cached company metrics for key periods (non-blocking)
    // Fire-and-forget: metrics will update in background; dashboard may show stale data briefly
    const metricsPromise = (async () => {
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

        const thirtyDaysAgo = new Date(now);
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        await recalculateCompanyMetrics(companyId, "30d", thirtyDaysAgo.toISOString(), endOfPeriod.toISOString());
        console.log("[pipeline] Metrics recalculation completed");
      } catch (err) {
        console.error("[pipeline] Metrics recalculation failed:", err);
      }
    })();

    // Do not await metrics — let it run in background while we return success to client
    metricsPromise.catch(() => {});

    // 17. Revalidate dashboard routes
    try {
      revalidatePath("/dashboard");
      revalidatePath("/transactions");
      revalidatePath("/expenses");
      revalidatePath("/revenue");
      revalidatePath("/subscriptions");
      revalidatePath("/alerts");
      revalidatePath("/agent-tasks");
      revalidatePath("/ai-insights");
      revalidatePath("/upload-centre");
    } catch {
      console.warn("[pipeline] revalidatePath failed (expected outside Next.js context)");
    }

    console.log(`[pipeline] Pipeline completed. Inserted: ${transactionsInserted}, Failed: ${transactionsFailed}, Duplicates: ${duplicateCount}, Transfers: ${transferCount}`);
    return {
      success: finalStatus !== "failed",
      uploadId,
      companyId,
      transactionsInserted,
      transactionsFailed,
      totalParsed,
      duplicateCount,
      transferCount,
      needReviewCount,
      categorisedCount,
      subscriptionsDetected: detectedSubs.length,
      subscriptionsCreated,
      alertsCreated,
      recommendationsCreated,
      tasksCreated,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error(`[pipeline] Pipeline error: ${message}`);

    // Update upload as failed
    console.error(`[pipeline] Updating upload as failed: ${message}`);
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
      transactionsInserted,
      transactionsFailed,
      totalParsed: 0,
      duplicateCount: 0,
      transferCount: 0,
      needReviewCount: 0,
      categorisedCount: 0,
      subscriptionsDetected: detectedSubs.length,
      subscriptionsCreated,
      alertsCreated,
      recommendationsCreated,
      tasksCreated,
      error: message,
    };
  }
}
