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
import { createAlertsBatch } from "@/lib/db/alerts";
import { normalizeAlertCategory } from "@/lib/db/alert-helpers";
import { createAgentRecommendationsBatch } from "@/lib/db/agent-recommendations";
import { createAgentTasksBatch } from "@/lib/db/agent-tasks";
import { getOrCreateBankAccount, updateBankAccountBalance } from "@/lib/db/bank-accounts";
import { recalculateCompanyMetrics } from "@/lib/db/company-metrics";
import { parseCsv } from "@/lib/parser/csv-core";
import { parseUpload } from "@/lib/parser/unified-parser";
import { getCategoryBreakdown } from "@/lib/intelligence/categoriser";
import { detectDuplicate } from "@/lib/intelligence/duplicate-detector-v2";
import { toDbTransaction, type CanonicalTransaction } from "@/lib/providers/canonical-model";
import { applyMerchantAndTransferSignals, categoriseCanonicalTransactions } from "@/lib/upload/categorisation-runner";
import { getKpiExclusionReasonForCategory, isKpiExcludedCategory } from "@/lib/kpi-treatment";
import type { TransactionCategoryType, TransactionStatus } from "@/lib/types";
import type { ImportReconciliation, ImportRowOutcome } from "@/lib/upload/reconciliation";
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
  reconciliation?: ImportReconciliation;
  error?: string;
}

const BUCKET_NAME = "financial_uploads";

function toLocalYMD(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

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

function isKpiIncludedRow(tx: CanonicalTransaction): boolean {
  return !tx.isPossibleDuplicate && !tx.isTransfer && tx.kpiExcluded !== true;
}

function isUncategorisedRow(tx: CanonicalTransaction): boolean {
  return tx.category === "Uncategorised Review";
}

function isAmbiguousRow(tx: CanonicalTransaction): boolean {
  return tx.category === "Ambiguous";
}

function getEvidenceSources(tx: CanonicalTransaction): string[] {
  const sources = new Set<string>();
  for (const evidence of tx.categoryEvidence ?? []) {
    if (evidence.source) sources.add(evidence.source);
  }
  if (tx.categoryReason?.toLowerCase().includes("user override")) sources.add("user_override");
  return [...sources];
}

function isUserRuleCategorised(tx: CanonicalTransaction): boolean {
  return getEvidenceSources(tx).some((source) => source.includes("user_rule") || source.includes("user_override"));
}

function isSystemCategorised(tx: CanonicalTransaction): boolean {
  if (!tx.category || isUncategorisedRow(tx) || isAmbiguousRow(tx)) return false;
  return !isUserRuleCategorised(tx);
}

function isRefundRow(tx: CanonicalTransaction): boolean {
  const text = `${tx.transactionType ?? ""} ${tx.description ?? ""} ${tx.reference ?? ""} ${tx.category ?? ""}`.toLowerCase();
  return text.includes("refund") || text.includes("reversal");
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
  let totalRowsInFile = 0;
  let parsedRowsCount = 0;
  let parseFailedRowsCount = 0;
  let duplicateCountSnapshot = 0;
  let transferCountSnapshot = 0;
  let needReviewCountSnapshot = 0;
  let categorisedCountSnapshot = 0;
  let kpiExcludedCountSnapshot = 0;
  let detectedCurrencySnapshot: string | undefined;

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
    totalRowsInFile = parsed.rows.length;
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
    parsedRowsCount = parseResult.transactions.length;
    parseFailedRowsCount = parseResult.failedRows.length;
    detectedCurrencySnapshot = parseResult.detectedCurrency;

    applyMerchantAndTransferSignals(parseResult.transactions);

    // Detect duplicates against existing transactions
    const { data: existingTxs } = await adminClient
      .from("transactions")
      .select("id, date, amount, type, merchant, metadata, currency, reference, external_transaction_id, source_provider, raw_row_hash, bank_account_id")
      .eq("company_id", companyId)
      .limit(1000);

    const existingForDedup = (existingTxs || []).map((t) => {
      const meta = (t.metadata as Record<string, unknown> | null) || {};
      // DB stores absolute amounts; restore signed amount for hash comparison
      const absAmount = Number(t.amount);
      const signedAmount = t.type === "expense" ? -absAmount : absAmount;
      return {
        id: t.id as string,
        transactionDate: t.date as string,
        amount: signedAmount,
        currency: (t.currency as string | undefined) || (meta.currency as string) || "GBP",
        merchantName: (t.merchant as string) || "",
        reference: (t.reference as string | undefined) || (meta.reference as string) || undefined,
        externalTransactionId: (t.external_transaction_id as string | undefined) || (meta.external_transaction_id as string) || undefined,
        accountName: (meta.account_name as string) || undefined,
        sourceProvider: (t.source_provider as string | undefined) || (meta.source_provider as string) || "unknown",
        sourceFileId: (meta.source_file_id as string) || undefined,
      };
    });

    for (const tx of parseResult.transactions) {
      const dupResult = detectDuplicate(tx, existingForDedup);
      if (dupResult.isDuplicate) {
        tx.isPossibleDuplicate = true;
        tx.duplicateOfTransactionId = dupResult.duplicateTransactionId;
        tx.rowStatus = "duplicate_skipped";
        tx.status = "possible_duplicate";
        tx.reviewReason = dupResult.reason;
        tx.kpiExcluded = true;
        tx.kpiExclusionReason = "duplicate";
      }
    }

    // 5. Categorise rows
    await setPipelineStage(uploadId, companyId, "categorising", 65, parseResult.transactions.length, parseResult.failedRows.length);

    // Primary: v3 with business profile context + v1 fallback for low confidence
    const categorisation = categoriseCanonicalTransactions(parseResult.transactions, companySettings);
    let categorisedRows = categorisation.categorisedRows;
    const categoryBreakdown = getCategoryBreakdown(categorisedRows);

    // Apply user preview category overrides stored in upload metadata
    const categoryOverrides = upload.metadata?.category_overrides as Record<number, string> | undefined;
    if (categoryOverrides && typeof categoryOverrides === "object") {
      for (let i = 0; i < parseResult.transactions.length; i++) {
        const rowNumber = i + 2; // 1-based CSV row, skipping header
        const overrideCategory = categoryOverrides[rowNumber];
        if (overrideCategory) {
          const kpiExcluded = isKpiExcludedCategory(overrideCategory);
          parseResult.transactions[i].category = overrideCategory;
          parseResult.transactions[i].confidenceScore = 100; // User-confirmed
          parseResult.transactions[i].categoryConfidence = 100;
          parseResult.transactions[i].categoryReason = `User override selected ${overrideCategory} in upload preview.`;
          parseResult.transactions[i].kpiExcluded = kpiExcluded;
          parseResult.transactions[i].kpiExclusionReason = kpiExcluded ? getKpiExclusionReasonForCategory(overrideCategory) : undefined;
          parseResult.transactions[i].kpiTreatment = kpiExcluded ? "excluded" : "included";
          parseResult.transactions[i].status = "user_confirmed";
          parseResult.transactions[i].categorySource = "user";
          parseResult.transactions[i].userConfirmedCategory = true;
        }
      }
    }

    // Skip already-detected transfers and duplicates (handled above in canonical flow)
    // Filter out duplicates from insertion
    const deduplicatedRows = categorisedRows.filter((_, i) => !parseResult.transactions[i]?.isPossibleDuplicate);
    categorisedRows = deduplicatedRows;
    duplicateCountSnapshot = parseResult.transactions.filter((tx) => tx.isPossibleDuplicate).length;
    transferCountSnapshot = parseResult.transactions.filter((tx) => tx.isTransfer).length;
    needReviewCountSnapshot = parseResult.transactions.filter((tx) => tx.status === "needs_review" && !tx.isPossibleDuplicate).length;
    categorisedCountSnapshot = parseResult.transactions.filter((tx) => tx.status === "categorised" && !tx.isPossibleDuplicate).length;
    kpiExcludedCountSnapshot = parseResult.transactions.filter((tx) => tx.kpiExcluded || tx.isTransfer || tx.isPossibleDuplicate).length;

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
        if (tx.isTransfer) {
          tx.rowStatus = "transfer";
          tx.kpiExcluded = true;
          tx.kpiExclusionReason = tx.kpiExclusionReason ?? getKpiExclusionReasonForCategory(tx.category) ?? "transfer";
        } else if (tx.status === "needs_review") {
          tx.rowStatus = "needs_review";
          tx.kpiExcluded = tx.kpiExcluded ?? false;
        } else {
          tx.rowStatus = "inserted";
          tx.kpiExcluded = tx.kpiExcluded ?? false;
        }
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
    const insertedByLineage = new Map<string, string>();
    for (const row of insertResult.rows) {
      if (row.sourceRowNumber !== undefined) insertedByLineage.set(`row:${row.sourceRowNumber}`, row.id);
      if (row.rawRowHash) insertedByLineage.set(`hash:${row.rawRowHash}`, row.id);
      if (row.externalTransactionId) insertedByLineage.set(`external:${row.externalTransactionId}`, row.id);
    }

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
            category: (row.category as TransactionCategoryType | null) ?? "Uncategorised Review",
            status: row.status as TransactionStatus,
            confidenceScore: row.confidence_score as number,
            categoryReason: (row.metadata as Record<string, unknown> | null)?.category_reason as string || "historical",
            categoryConfidence: ((row.metadata as Record<string, unknown> | null)?.category_confidence as number | undefined) ?? (row.confidence_score as number) ?? 0,
            groupingConfidence: ((row.metadata as Record<string, unknown> | null)?.grouping_confidence as number | undefined) ?? 0,
            normalisedMerchant: (row.metadata as Record<string, unknown> | null)?.normalised_merchant as string | undefined,
            displayMerchant: (row.metadata as Record<string, unknown> | null)?.display_merchant as string | undefined,
            subcategory: (row.metadata as Record<string, unknown> | null)?.detected_subcategory as string | undefined,
            kpiTreatment: ((row.metadata as Record<string, unknown> | null)?.kpi_treatment as "included" | "excluded" | undefined) ?? "included",
            businessMeaning: (row.metadata as Record<string, unknown> | null)?.business_meaning as string | undefined,
            isCreditCardRepayment: Boolean((row.metadata as Record<string, unknown> | null)?.is_credit_card_repayment),
            isSubscriptionCandidate: Boolean((row.metadata as Record<string, unknown> | null)?.is_subscription_candidate),
            isRecurringCandidate: Boolean((row.metadata as Record<string, unknown> | null)?.is_recurring_candidate),
            categoryEvidence: ((row.metadata as Record<string, unknown> | null)?.category_evidence as []) ?? [],
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
    let rowsLinkedToSubscriptions = 0;
    for (const sub of detectedSubs) {
      try {
        const existing = await findSubscriptionByVendor(companyId, sub.vendor);
        let persistedSubscriptionId: string | undefined;
        if (!existing) {
          const created = await createSubscription({
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
          persistedSubscriptionId = created.id;
          subscriptionsCreated++;
        } else {
          // Update existing subscription with latest data
          const updated = await updateSubscription(existing.id, companyId, {
            amount: sub.amount,
            nextBillingDate: sub.nextBillingDate,
            metadata: {
              ...((existing.metadata || {}) as Record<string, unknown>),
              last_detected_from_upload: uploadId,
              transaction_count: sub.transactionCount,
              updated_at: new Date().toISOString(),
            },
          });
          persistedSubscriptionId = updated?.id ?? existing.id;
        }

        if (persistedSubscriptionId) {
          const { data: linkedRows, error: linkError } = await adminClient
            .from("transactions")
            .update({
              subscription_id: persistedSubscriptionId,
              is_recurring: true,
            })
            .eq("company_id", companyId)
            .eq("upload_id", uploadId)
            .eq("type", "expense")
            .ilike("merchant", `%${sub.vendor}%`)
            .select("id");

          if (linkError) {
            console.error("[pipeline] Subscription transaction linking failed:", linkError.message);
          } else {
            rowsLinkedToSubscriptions += linkedRows?.length ?? 0;
          }
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
    const rowsIncludedInRevenue = parseResult.transactions.filter((tx) => isKpiIncludedRow(tx) && tx.amount >= 0).length;
    const rowsIncludedInExpenses = parseResult.transactions.filter((tx) => isKpiIncludedRow(tx) && tx.amount < 0).length;
    const rowsIncludedInCashFlow = rowsIncludedInRevenue + rowsIncludedInExpenses;
    const rowsExcludedFromKpis = parseResult.transactions.filter((tx) => !isKpiIncludedRow(tx)).length;
    const needReviewCount = parseResult.transactions.filter((tx) => tx.status === "needs_review" && !tx.isPossibleDuplicate).length;
    const rowsUncategorised = parseResult.transactions.filter((tx) => isUncategorisedRow(tx) && !tx.isPossibleDuplicate).length;
    const rowsAmbiguous = parseResult.transactions.filter((tx) => isAmbiguousRow(tx) && !tx.isPossibleDuplicate).length;
    const categorisedCount = parseResult.transactions.filter((tx) =>
      Boolean(tx.category) && !isUncategorisedRow(tx) && !isAmbiguousRow(tx) && !tx.isPossibleDuplicate
    ).length;
    const rowsHighConfidence = parseResult.transactions.filter((tx) =>
      !tx.isPossibleDuplicate &&
      !isUncategorisedRow(tx) &&
      !isAmbiguousRow(tx) &&
      ((tx.categoryConfidence ?? tx.confidenceScore ?? 0) >= 90)
    ).length;
    const rowsCategorisedByUserRule = parseResult.transactions.filter((tx) => !tx.isPossibleDuplicate && isUserRuleCategorised(tx)).length;
    const rowsCategorisedBySystemIntelligence = parseResult.transactions.filter((tx) => !tx.isPossibleDuplicate && isSystemCategorised(tx)).length;
    const rowsWithFees = parseResult.transactions.filter((tx) => (tx.feeAmount ?? 0) > 0).length;
    const rowsWithRefunds = parseResult.transactions.filter((tx) => isRefundRow(tx)).length;
    const rowsWithCreditCardRepaymentTreatment = parseResult.transactions.filter((tx) => tx.isCreditCardRepayment).length;
    duplicateCountSnapshot = duplicateCount;
    transferCountSnapshot = transferCount;
    needReviewCountSnapshot = needReviewCount;
    categorisedCountSnapshot = categorisedCount;
    kpiExcludedCountSnapshot = rowsExcludedFromKpis;
    const rowOutcomes: ImportRowOutcome[] = [
      ...parseResult.transactions.map((tx) => {
        const transactionId =
          (tx.sourceRowNumber !== undefined ? insertedByLineage.get(`row:${tx.sourceRowNumber}`) : undefined) ??
          (tx.rawRowHash ? insertedByLineage.get(`hash:${tx.rawRowHash}`) : undefined) ??
          (tx.externalTransactionId ? insertedByLineage.get(`external:${tx.externalTransactionId}`) : undefined);
        const status: ImportRowOutcome["status"] = tx.isPossibleDuplicate
          ? "duplicate_skipped"
          : tx.isTransfer
          ? "transfer"
          : tx.status === "needs_review"
          ? "needs_review"
          : "inserted";
        const kpiTreatment: ImportRowOutcome["kpiTreatment"] = isKpiIncludedRow(tx) ? "included" : "excluded";
        const direction: ImportRowOutcome["direction"] = tx.amount >= 0 ? "income" : "expense";
        const duplicateStatus: ImportRowOutcome["duplicateStatus"] = tx.isPossibleDuplicate ? "duplicate" : "not_duplicate";
        const signalsUsed = getEvidenceSources(tx);
        return {
          rowNumber: tx.sourceRowNumber ?? 0,
          status,
          transactionId,
          duplicateOfTransactionId: tx.duplicateOfTransactionId,
          externalTransactionId: tx.externalTransactionId,
          rawRowHash: tx.rawRowHash,
          sourceFileName: upload.file_name as string,
          sourceProvider: tx.sourceProvider,
          transactionDate: tx.transactionDate,
          merchant: tx.merchantName,
          description: tx.description,
          reference: tx.reference,
          amount: Math.abs(tx.amount),
          currency: tx.currency,
          originalAmount: tx.originalAmount,
          originalCurrency: tx.originalCurrency,
          feeAmount: tx.feeAmount,
          direction,
          transactionType: tx.transactionType,
          category: tx.category,
          subcategory: tx.subcategory,
          confidence: tx.confidenceScore,
          categoryConfidence: tx.categoryConfidence,
          groupingConfidence: tx.groupingConfidence,
          reviewStatus: tx.status,
          duplicateStatus,
          kpiTreatment,
          kpiExclusionReason: kpiTreatment === "excluded"
            ? tx.kpiExclusionReason ?? (tx.isPossibleDuplicate ? "duplicate" : tx.isTransfer ? "transfer" : "kpi_excluded")
            : undefined,
          categoryReason: tx.categoryReason,
          intelligenceGroupId: tx.intelligenceGroupId,
          intelligenceGroupReason: tx.intelligenceGroupReason,
          signalsUsed,
          reason: tx.reviewReason ?? tx.categoryReason ?? tx.kpiExclusionReason,
        };
      }),
      ...parseResult.failedRows.map((row) => ({
        rowNumber: row.rowNumber,
        status: "failed" as const,
        sourceFileName: upload.file_name as string,
        sourceProvider: parseResult.detectedProvider,
        duplicateStatus: "not_duplicate" as const,
        kpiTreatment: "excluded" as const,
        failureReason: row.errors.join("; "),
        reason: row.errors.join("; "),
      })),
    ].sort((a, b) => a.rowNumber - b.rowNumber);
    const accountedRows = transactionsInserted + duplicateCount + transactionsFailed;
    const reconciliationBalanced = totalRowsInFile === accountedRows;
    const reconciliation: ImportReconciliation = {
      rowsInFile: totalRowsInFile,
      rowsParsed: totalParsed,
      rowsValid: totalParsed,
      rowsInserted: transactionsInserted,
      rowsSkippedDuplicate: duplicateCount,
      rowsMarkedTransfer: transferCount,
      rowsExcludedFromKpis,
      rowsFailed: transactionsFailed,
      rowsNeedingReview: needReviewCount,
      rowsUncategorised,
      rowsAmbiguous,
      rowsCategorised: categorisedCount,
      rowsHighConfidence,
      rowsCategorisedByUserRule,
      rowsCategorisedBySystemIntelligence,
      rowsIncludedInRevenue,
      rowsIncludedInExpenses,
      rowsIncludedInCashFlow,
      rowsLinkedToSubscriptions,
      rowsWithFees,
      rowsWithRefunds,
      rowsWithCreditCardRepaymentTreatment,
      reconciliationBalanced,
      explanation: reconciliationBalanced
        ? `${totalRowsInFile} file rows reconciled: ${transactionsInserted} inserted, ${duplicateCount} duplicate skipped, ${transactionsFailed} failed.`
        : `Reconciliation mismatch: file rows ${totalRowsInFile}, but inserted + duplicate + failed rows accounted for ${accountedRows}.`,
      rowOutcomes,
    };
    const hasFatalErrors = transactionsFailed > 0 && transactionsInserted === 0 && duplicateCount === 0;
    const allDuplicates = totalParsed > 0 && duplicateCount === totalParsed;
    const finalStatus = !reconciliationBalanced || (transactionsInserted === 0 && !allDuplicates) || hasFatalErrors ? "failed" : "completed";

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
      import_reconciliation: reconciliation,
    };
    try {
      await updateUploadStatus(uploadId, companyId, {
        status: finalStatus,
        transactionCount: transactionsInserted,
        totalRowCount: totalRowsInFile,
        processedRowCount: totalParsed + transactionsFailed,
        failedRowCount: transactionsFailed,
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
          totalRowCount: totalRowsInFile,
          processedRowCount: totalParsed + transactionsFailed,
          failedRowCount: transactionsFailed,
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
        const today = toLocalYMD(now);

        await recalculateCompanyMetrics(companyId, "month", toLocalYMD(startOfMonth), today);
        await recalculateCompanyMetrics(companyId, "quarter", toLocalYMD(startOfQuarter), today);
        await recalculateCompanyMetrics(companyId, "year", toLocalYMD(startOfYear), today);
        await recalculateCompanyMetrics(companyId, "all", "1970-01-01", today);

        const thirtyDaysAgo = new Date(now);
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 29);
        await recalculateCompanyMetrics(companyId, "30d", toLocalYMD(thirtyDaysAgo), today);
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
      reconciliation,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error(`[pipeline] Pipeline error: ${message}`);

    // Update upload as failed
    console.error(`[pipeline] Updating upload as failed: ${message}`);
    const failedReconciliation: ImportReconciliation | undefined = totalRowsInFile > 0
      ? {
          rowsInFile: totalRowsInFile,
          rowsParsed: parsedRowsCount,
          rowsValid: parsedRowsCount,
          rowsInserted: transactionsInserted,
          rowsSkippedDuplicate: duplicateCountSnapshot,
          rowsMarkedTransfer: transferCountSnapshot,
          rowsExcludedFromKpis: kpiExcludedCountSnapshot,
          rowsFailed: Math.max(parseFailedRowsCount, totalRowsInFile - transactionsInserted - duplicateCountSnapshot),
          rowsNeedingReview: needReviewCountSnapshot,
          rowsUncategorised: 0,
          rowsAmbiguous: 0,
          rowsCategorised: categorisedCountSnapshot,
          rowsHighConfidence: 0,
          rowsCategorisedByUserRule: 0,
          rowsCategorisedBySystemIntelligence: categorisedCountSnapshot,
          rowsIncludedInRevenue: 0,
          rowsIncludedInExpenses: 0,
          rowsIncludedInCashFlow: 0,
          rowsLinkedToSubscriptions: 0,
          rowsWithFees: 0,
          rowsWithRefunds: 0,
          rowsWithCreditCardRepaymentTreatment: 0,
          reconciliationBalanced: false,
          explanation: `Import stopped before persistence completed: ${message}`,
          rowOutcomes: [],
        }
      : undefined;
    await updateUploadStatus(uploadId, companyId, {
      status: "failed",
      errorMessage: message,
      totalRowCount: totalRowsInFile || undefined,
      processedRowCount: parsedRowsCount || undefined,
      failedRowCount: failedReconciliation?.rowsFailed,
      metadata: {
        pipeline_stage: "failed",
        pipeline_progress: 0,
        detected_currency: detectedCurrencySnapshot,
        total_parsed: parsedRowsCount,
        duplicate_count: duplicateCountSnapshot,
        transfer_count: transferCountSnapshot,
        needs_review_count: needReviewCountSnapshot,
        categorised_count: categorisedCountSnapshot,
        import_reconciliation: failedReconciliation,
      },
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
      totalParsed: parsedRowsCount,
      duplicateCount: duplicateCountSnapshot,
      transferCount: transferCountSnapshot,
      needReviewCount: needReviewCountSnapshot,
      categorisedCount: categorisedCountSnapshot,
      subscriptionsDetected: detectedSubs.length,
      subscriptionsCreated,
      alertsCreated,
      recommendationsCreated,
      tasksCreated,
      reconciliation: failedReconciliation,
      error: message,
    };
  }
}
