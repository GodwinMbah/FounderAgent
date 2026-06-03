"use server";

import { requireAuthCompany } from "@/lib/db/company";
import { getCompanySettings } from "@/lib/db/company_settings";
import { getUploads } from "@/lib/db/uploads";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Upload, Transaction } from "@/lib/types";
import { getImportReconciliation, type ImportRowOutcome } from "@/lib/upload/reconciliation";
import { fromDbTransaction } from "@/lib/providers/canonical-model";
import { applyMerchantAndTransferSignals, categoriseCanonicalTransactions } from "@/lib/upload/categorisation-runner";
import { buildCategoryRefreshUpdate, isUserCategoryProtected } from "@/lib/upload/recategorisation";
import { revalidatePath } from "next/cache";

export interface UploadHistoryItem extends Upload {
  reconciliation?: {
    rowsInFile: number;
    rowsParsed: number;
    rowsValid: number;
    rowsInserted: number;
    rowsSkippedDuplicate: number;
    rowsMarkedTransfer: number;
    rowsExcludedFromKpis: number;
    rowsFailed: number;
    rowsNeedingReview: number;
    rowsUncategorised: number;
    rowsAmbiguous: number;
    rowsCategorised: number;
    rowsHighConfidence: number;
    rowsCategorisedByUserRule: number;
    rowsCategorisedBySystemIntelligence: number;
    rowsIncludedInRevenue: number;
    rowsIncludedInExpenses: number;
    rowsIncludedInCashFlow: number;
    rowsLinkedToSubscriptions: number;
    rowsWithFees: number;
    rowsWithRefunds: number;
    rowsWithCreditCardRepaymentTreatment: number;
    reconciliationBalanced: boolean;
    explanation: string;
    subscriptionsDetected: number;
    alertsCreated: number;
    recommendationsCreated: number;
    sourceCurrency: string;
    baseCurrency: string;
  };
}

export async function getUploadHistory(): Promise<{
  success: boolean;
  uploads?: UploadHistoryItem[];
  error?: string;
}> {
  try {
    const { companyId } = await requireAuthCompany();
    const uploads = await getUploads(companyId);

    const enriched = uploads.map((upload) => {
      const meta = upload.metadata || {};
      const rec = getImportReconciliation(meta);
      return {
        ...upload,
        reconciliation: {
          rowsInFile: rec?.rowsInFile ?? (meta.total_rows as number) ?? (meta.total_parsed as number) ?? 0,
          rowsParsed: rec?.rowsParsed ?? (meta.total_parsed as number) ?? 0,
          rowsValid: rec?.rowsValid ?? (meta.total_parsed as number) ?? 0,
          rowsInserted: rec?.rowsInserted ?? upload.transactionCount ?? 0,
          rowsSkippedDuplicate: rec?.rowsSkippedDuplicate ?? (meta.duplicate_count as number) ?? 0,
          rowsMarkedTransfer: rec?.rowsMarkedTransfer ?? (meta.transfer_count as number) ?? 0,
          rowsExcludedFromKpis: rec?.rowsExcludedFromKpis ?? ((meta.transfer_count as number) ?? 0) + ((meta.duplicate_count as number) ?? 0),
          rowsFailed: rec?.rowsFailed ?? (meta.failed_rows as number) ?? 0,
          rowsNeedingReview: rec?.rowsNeedingReview ?? (meta.needs_review_count as number) ?? 0,
          rowsUncategorised: rec?.rowsUncategorised ?? 0,
          rowsAmbiguous: rec?.rowsAmbiguous ?? 0,
          rowsCategorised: rec?.rowsCategorised ?? (meta.categorised_count as number) ?? 0,
          rowsHighConfidence: rec?.rowsHighConfidence ?? 0,
          rowsCategorisedByUserRule: rec?.rowsCategorisedByUserRule ?? 0,
          rowsCategorisedBySystemIntelligence: rec?.rowsCategorisedBySystemIntelligence ?? (meta.categorised_count as number) ?? 0,
          rowsIncludedInRevenue: rec?.rowsIncludedInRevenue ?? 0,
          rowsIncludedInExpenses: rec?.rowsIncludedInExpenses ?? 0,
          rowsIncludedInCashFlow: rec?.rowsIncludedInCashFlow ?? 0,
          rowsLinkedToSubscriptions: rec?.rowsLinkedToSubscriptions ?? 0,
          rowsWithFees: rec?.rowsWithFees ?? 0,
          rowsWithRefunds: rec?.rowsWithRefunds ?? 0,
          rowsWithCreditCardRepaymentTreatment: rec?.rowsWithCreditCardRepaymentTreatment ?? 0,
          reconciliationBalanced: rec?.reconciliationBalanced ?? upload.status === "completed",
          explanation: rec?.explanation ?? "",
          subscriptionsDetected: (meta.subscriptions_detected as number) ?? 0,
          alertsCreated: (meta.alerts_created as number) ?? 0,
          recommendationsCreated: (meta.recommendations_created as number) ?? 0,
          sourceCurrency: (meta.detected_currency as string) ?? "",
          baseCurrency: (meta.detected_currency as string) ?? "",
        },
      };
    });

    return { success: true, uploads: enriched };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load upload history";
    console.error("[getUploadHistory] Error:", message);
    return { success: false, error: message };
  }
}

export async function getUploadTransactions(
  uploadId: string,
  options?: {
    limit?: number;
    offset?: number;
    status?: string;
    category?: string;
    currency?: string;
    duplicateStatus?: "all" | "duplicates" | "not_duplicates";
  }
): Promise<{
  success: boolean;
  transactions?: Transaction[];
  total?: number;
  hasMore?: boolean;
  rowOutcomes?: ImportRowOutcome[];
  error?: string;
}> {
  try {
    const { companyId } = await requireAuthCompany();
    const admin = createAdminClient();
    if (!admin) throw new Error("Admin client not available");

    const limit = options?.limit ?? 100;
    const offset = options?.offset ?? 0;

    const { data: uploadRow } = await admin
      .from("uploads")
      .select("metadata")
      .eq("company_id", companyId)
      .eq("id", uploadId)
      .maybeSingle();
    const rowOutcomes = getImportReconciliation(uploadRow?.metadata as Record<string, unknown> | undefined)?.rowOutcomes ?? [];

    let query = admin
      .from("transactions")
      .select("*", { count: "exact" })
      .eq("company_id", companyId)
      .eq("upload_id", uploadId)
      .order("source_row_number", { ascending: true, nullsFirst: false })
      .range(offset, offset + limit - 1);

    if (options?.status && options.status !== "all") query = query.eq("status", options.status);
    if (options?.category && options.category !== "all") query = query.eq("category", options.category);
    if (options?.currency && options.currency !== "all") query = query.eq("currency", options.currency);
    if (options?.duplicateStatus === "duplicates") query = query.not("duplicate_of_transaction_id", "is", null);
    if (options?.duplicateStatus === "not_duplicates") query = query.is("duplicate_of_transaction_id", null);

    const { data, error, count } = await query;

    if (error) throw error;

    const transactions = (data ?? []).map((t) => {
      const metadata = t.metadata as Record<string, unknown> | undefined;
      return {
        id: t.id as string,
        companyId: t.company_id as string,
        uploadId: t.upload_id as string,
        accountId: t.bank_account_id as string,
        sourceRowNumber: (t.source_row_number as number | undefined) ?? (metadata?.source_row_number as number | undefined),
        externalTransactionId: (t.external_transaction_id as string | undefined) ?? (metadata?.external_transaction_id as string | undefined),
        postedDate: (t.posted_date as string | undefined) ?? (metadata?.posted_date as string | undefined),
        currency: (t.currency as string | undefined) ?? (metadata?.currency as string | undefined),
        sourceProvider: (t.source_provider as string | undefined) ?? (metadata?.source_provider as string | undefined),
        rawRowHash: (t.raw_row_hash as string | undefined) ?? (metadata?.raw_row_hash as string | undefined),
        reference: (t.reference as string | undefined) ?? (metadata?.reference as string | undefined),
        rowStatus: (t.row_status as string | undefined) ?? (metadata?.row_status as string | undefined),
        kpiExcluded: (t.kpi_excluded as boolean | undefined) ?? (metadata?.kpi_excluded as boolean | undefined),
        kpiExclusionReason: (t.kpi_exclusion_reason as string | undefined) ?? (metadata?.kpi_exclusion_reason as string | undefined),
        duplicateOfTransactionId: (t.duplicate_of_transaction_id as string | undefined) ?? (metadata?.duplicate_of_transaction_id as string | undefined),
        originalAmount: metadata?.original_amount as number | undefined,
        originalCurrency: metadata?.original_currency as string | undefined,
        feeAmount: (t.fee_amount as number | undefined) ?? (metadata?.fee_amount as number | undefined),
        feeCurrency: metadata?.fee_currency as string | undefined,
        runningBalance: (t.running_balance as number | undefined) ?? (metadata?.running_balance as number | undefined),
        date: t.date as string,
        merchant: t.merchant as string,
        description: t.description as string,
        category: t.category as string,
        subcategory: metadata?.detected_subcategory as string | undefined,
        categoryReason: metadata?.category_reason as string | undefined,
        categoryConfidence: metadata?.category_confidence as number | undefined,
        groupingConfidence: metadata?.grouping_confidence as number | undefined,
        businessMeaning: metadata?.business_meaning as string | undefined,
        kpiTreatment: metadata?.kpi_treatment as Transaction["kpiTreatment"] | undefined,
        categorySource: metadata?.category_source as Transaction["categorySource"] | undefined,
        userConfirmedCategory: metadata?.user_confirmed_category as boolean | undefined,
        intelligenceGroupId: metadata?.intelligence_group_id as string | undefined,
        intelligenceGroupLabel: metadata?.intelligence_group_label as string | undefined,
        intelligenceGroupReason: metadata?.intelligence_group_reason as string | undefined,
        intelligenceGroupSignals: metadata?.intelligence_group_signals as string[] | undefined,
        isCreditCardRepayment: metadata?.is_credit_card_repayment as boolean | undefined,
        amount: Number(t.amount),
        type: t.type as "income" | "expense",
        status: t.status as string,
        confidenceScore: t.confidence_score as number | undefined,
        metadata,
      };
    });

    return {
      success: true,
      transactions,
      total: count ?? transactions.length,
      hasMore: offset + transactions.length < (count ?? transactions.length),
      rowOutcomes,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load transactions";
    return { success: false, error: message };
  }
}

export async function deleteUploadAndTransactions(uploadId: string): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const { companyId } = await requireAuthCompany();
    const admin = createAdminClient();
    if (!admin) throw new Error("Admin client not available");

    // Delete transactions first (foreign key reference)
    const { error: txError } = await admin
      .from("transactions")
      .delete()
      .eq("company_id", companyId)
      .eq("upload_id", uploadId);

    if (txError) {
      console.error("[deleteUpload] Transaction delete failed:", txError.message);
      return { success: false, error: "Failed to delete transactions" };
    }

    // Delete upload record
    const { error: uploadError } = await admin
      .from("uploads")
      .delete()
      .eq("id", uploadId)
      .eq("company_id", companyId);

    if (uploadError) {
      console.error("[deleteUpload] Upload delete failed:", uploadError.message);
      return { success: false, error: "Failed to delete upload record" };
    }

    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Delete failed";
    return { success: false, error: message };
  }
}

function mapRefreshTransaction(t: Record<string, unknown>): Transaction {
  const metadata = t.metadata as Record<string, unknown> | undefined;
  return {
    id: t.id as string,
    companyId: t.company_id as string,
    uploadId: t.upload_id as string | undefined,
    accountId: t.bank_account_id as string | undefined,
    sourceRowNumber: (t.source_row_number as number | undefined) ?? (metadata?.source_row_number as number | undefined),
    externalTransactionId: (t.external_transaction_id as string | undefined) ?? (metadata?.external_transaction_id as string | undefined),
    postedDate: (t.posted_date as string | undefined) ?? (metadata?.posted_date as string | undefined),
    currency: (t.currency as string | undefined) ?? (metadata?.currency as string | undefined),
    sourceProvider: (t.source_provider as string | undefined) ?? (metadata?.source_provider as string | undefined),
    rawRowHash: (t.raw_row_hash as string | undefined) ?? (metadata?.raw_row_hash as string | undefined),
    reference: (t.reference as string | undefined) ?? (metadata?.reference as string | undefined),
    rowStatus: (t.row_status as string | undefined) ?? (metadata?.row_status as string | undefined),
    kpiExcluded: (t.kpi_excluded as boolean | undefined) ?? (metadata?.kpi_excluded as boolean | undefined),
    kpiExclusionReason: (t.kpi_exclusion_reason as string | undefined) ?? (metadata?.kpi_exclusion_reason as string | undefined),
    duplicateOfTransactionId: (t.duplicate_of_transaction_id as string | undefined) ?? (metadata?.duplicate_of_transaction_id as string | undefined),
    feeAmount: (t.fee_amount as number | undefined) ?? (metadata?.fee_amount as number | undefined),
    runningBalance: (t.running_balance as number | undefined) ?? (metadata?.running_balance as number | undefined),
    date: t.date as string,
    merchant: t.merchant as string | undefined,
    description: t.description as string,
    category: t.category as string | undefined,
    amount: Number(t.amount),
    type: t.type as "income" | "expense",
    status: t.status as string,
    confidenceScore: t.confidence_score as number | undefined,
    tags: t.tags as string[] | undefined,
    notes: t.notes as string | undefined,
    isRecurring: t.is_recurring as boolean | undefined,
    subscriptionId: t.subscription_id as string | undefined,
    metadata,
    createdAt: t.created_at as string,
    updatedAt: t.updated_at as string,
  };
}

export async function refreshUploadCategories(uploadId: string): Promise<{
  success: boolean;
  refreshed?: number;
  protectedRows?: number;
  unchanged?: number;
  error?: string;
}> {
  try {
    const { companyId } = await requireAuthCompany();
    const admin = createAdminClient();
    if (!admin) throw new Error("Admin client not available");

    const { data: upload, error: uploadError } = await admin
      .from("uploads")
      .select("id, company_id, metadata")
      .eq("id", uploadId)
      .eq("company_id", companyId)
      .maybeSingle();

    if (uploadError) throw uploadError;
    if (!upload) throw new Error("Upload not found");

    const { data, error } = await admin
      .from("transactions")
      .select("*")
      .eq("company_id", companyId)
      .eq("upload_id", uploadId)
      .order("source_row_number", { ascending: true, nullsFirst: false });

    if (error) throw error;

    const existing = (data ?? []).map((row) => mapRefreshTransaction(row as Record<string, unknown>));
    if (existing.length === 0) {
      return { success: true, refreshed: 0, protectedRows: 0, unchanged: 0 };
    }

    const settings = await getCompanySettings(companyId);
    const canonical = existing.map(fromDbTransaction);
    applyMerchantAndTransferSignals(canonical);
    categoriseCanonicalTransactions(canonical, settings);

    let refreshed = 0;
    let protectedRows = 0;
    const unchanged = 0;
    const refreshedAt = new Date().toISOString();

    for (let i = 0; i < existing.length; i++) {
      const current = existing[i];
      if (isUserCategoryProtected(current)) {
        protectedRows += 1;
        continue;
      }

      const update = buildCategoryRefreshUpdate(current, canonical[i], refreshedAt);
      if (!update) {
        protectedRows += 1;
        continue;
      }

      const { error: updateError } = await admin
        .from("transactions")
        .update(update)
        .eq("id", current.id)
        .eq("company_id", companyId);

      if (updateError) throw updateError;
      refreshed += 1;
    }

    const existingMeta = (upload.metadata as Record<string, unknown> | null) ?? {};
    const categoryRefreshes = Array.isArray(existingMeta.category_refreshes)
      ? existingMeta.category_refreshes
      : [];
    await admin
      .from("uploads")
      .update({
        metadata: {
          ...existingMeta,
          category_refreshes: [
            ...categoryRefreshes,
            {
              refreshed_at: refreshedAt,
              refreshed,
              protected_rows: protectedRows,
              unchanged,
              engine: "universal_categorisation_intelligence",
            },
          ],
          last_category_refresh_at: refreshedAt,
          last_category_refresh_count: refreshed,
        },
      })
      .eq("id", uploadId)
      .eq("company_id", companyId);

    revalidatePath("/dashboard");
    revalidatePath("/cash-flow");
    revalidatePath("/transactions");
    revalidatePath("/upload-centre");

    return { success: true, refreshed, protectedRows, unchanged };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Category refresh failed";
    return { success: false, error: message };
  }
}
