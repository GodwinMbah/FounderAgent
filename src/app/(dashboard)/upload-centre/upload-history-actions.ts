"use server";

import { requireAuthCompany } from "@/lib/db/company";
import { getUploads } from "@/lib/db/uploads";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Upload, Transaction } from "@/lib/types";

export interface UploadHistoryItem extends Upload {
  reconciliation?: {
    totalParsed: number;
    duplicateCount: number;
    transferCount: number;
    needReviewCount: number;
    categorisedCount: number;
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
      return {
        ...upload,
        reconciliation: {
          totalParsed: (meta.total_parsed as number) ?? 0,
          duplicateCount: (meta.duplicate_count as number) ?? 0,
          transferCount: (meta.transfer_count as number) ?? 0,
          needReviewCount: (meta.needs_review_count as number) ?? 0,
          categorisedCount: (meta.categorised_count as number) ?? 0,
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

export async function getUploadTransactions(uploadId: string): Promise<{
  success: boolean;
  transactions?: Transaction[];
  error?: string;
}> {
  try {
    const { companyId } = await requireAuthCompany();
    const admin = createAdminClient();
    if (!admin) throw new Error("Admin client not available");

    const { data, error } = await admin
      .from("transactions")
      .select("*")
      .eq("company_id", companyId)
      .eq("upload_id", uploadId)
      .order("date", { ascending: false })
      .limit(500);

    if (error) throw error;

    const transactions = (data ?? []).map((t) => ({
      id: t.id as string,
      companyId: t.company_id as string,
      uploadId: t.upload_id as string,
      accountId: t.bank_account_id as string,
      date: t.date as string,
      merchant: t.merchant as string,
      description: t.description as string,
      category: t.category as string,
      amount: Number(t.amount),
      type: t.type as "income" | "expense",
      status: t.status as string,
      confidenceScore: t.confidence_score as number | undefined,
      metadata: t.metadata as Record<string, unknown> | undefined,
    }));

    return { success: true, transactions };
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
