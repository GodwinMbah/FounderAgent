"use server";

import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getActiveCompanyForUser } from "./company";
import type { Upload, UploadStatus } from "@/lib/types";

function mapRow(row: Record<string, unknown>): Upload {
  return {
    id: row.id as string,
    companyId: row.company_id as string,
    userId: row.user_id as string | undefined,
    fileName: row.file_name as string,
    filePath: row.file_path as string | undefined,
    fileSize: row.file_size as number,
    mimeType: row.mime_type as string | undefined,
    source: row.source as string,
    status: row.status as import("@/lib/types").UploadStatus,
    transactionCount: row.transaction_count as number | undefined,
    errorMessage: row.error_message as string | undefined,
    metadata: row.metadata as Record<string, unknown> | undefined,
    uploadedAt: row.uploaded_at as string,
    processedAt: row.processed_at as string | undefined,
    updatedAt: row.updated_at as string,
  };
}

export async function getUploads(companyId?: string): Promise<Upload[]> {
  const ctx = await getActiveCompanyForUser();
  if (!ctx) throw new Error("Unauthorized");
  const effectiveCompanyId = companyId ?? ctx.companyId;
  if (effectiveCompanyId !== ctx.companyId) throw new Error("Forbidden: company mismatch");

  const supabase = await createServerClient();
  if (!supabase) throw new Error("Supabase not configured");

  const { data, error } = await supabase
    .from("uploads")
    .select("*")
    .eq("company_id", effectiveCompanyId)
    .order("uploaded_at", { ascending: false });

  if (error) {
    throw error;
  }

  return (data ?? []).map(mapRow);
}

/* ─── Write helpers (admin client — server-only) ─── */

export async function createUpload(data: {
  companyId: string;
  userId: string;
  fileName: string;
  filePath: string;
  fileSize: number;
  mimeType?: string;
  source?: string;
  status?: UploadStatus;
  metadata?: Record<string, unknown>;
}): Promise<Upload> {
  const admin = createAdminClient();
  if (!admin) throw new Error("Admin client not available");

  const { data: row, error } = await admin
    .from("uploads")
    .insert({
      company_id: data.companyId,
      user_id: data.userId,
      file_name: data.fileName,
      file_path: data.filePath,
      file_size: data.fileSize,
      mime_type: data.mimeType,
      source: data.source ?? "manual_csv",
      status: data.status ?? "pending",
      metadata: data.metadata ?? {},
    })
    .select("*")
    .single();

  if (error || !row) throw new Error(`Failed to create upload: ${error?.message}`);
  return mapRow(row as Record<string, unknown>);
}

export async function updateUploadStatus(
  uploadId: string,
  companyId: string,
  updates: {
    status?: UploadStatus;
    transactionCount?: number;
    processedRowCount?: number;
    failedRowCount?: number;
    errorMessage?: string | null;
    metadata?: Record<string, unknown>;
    processedAt?: string;
    providerDetected?: string;
    providerConfidence?: number;
  }
): Promise<Upload> {
  const admin = createAdminClient();
  if (!admin) throw new Error("Admin client not available");

  const dbUpdates: Record<string, unknown> = {};
  if (updates.status !== undefined) dbUpdates.status = updates.status;
  if (updates.transactionCount !== undefined) dbUpdates.transaction_count = updates.transactionCount;
  if (updates.processedRowCount !== undefined) {
    dbUpdates.metadata = {
      ...((await getUploadMetadata(uploadId)) ?? {}),
      processed_row_count: updates.processedRowCount,
    };
  }
  if (updates.failedRowCount !== undefined) {
    dbUpdates.metadata = {
      ...((await getUploadMetadata(uploadId)) ?? {}),
      failed_row_count: updates.failedRowCount,
    };
  }
  if (updates.errorMessage !== undefined) dbUpdates.error_message = updates.errorMessage;
  if (updates.processedAt !== undefined) dbUpdates.processed_at = updates.processedAt;

  // Always merge provider info into metadata
  const existingMeta = (await getUploadMetadata(uploadId)) ?? {};
  const mergedMetadata: Record<string, unknown> = {
    ...existingMeta,
    ...(updates.metadata ?? {}),
    ...(updates.providerDetected !== undefined && { provider_detected: updates.providerDetected }),
    ...(updates.providerConfidence !== undefined && { provider_confidence: updates.providerConfidence }),
  };
  dbUpdates.metadata = mergedMetadata;

  // Try to also set dedicated columns if they exist
  if (updates.providerDetected !== undefined) dbUpdates.provider_detected = updates.providerDetected;
  if (updates.providerConfidence !== undefined) dbUpdates.provider_confidence = updates.providerConfidence;

  let result = await admin
    .from("uploads")
    .update(dbUpdates)
    .eq("id", uploadId)
    .eq("company_id", companyId)
    .select("*")
    .single();

  if (result.error) {
    const errMsg = result.error.message || "";
    if (errMsg.includes("column") || errMsg.includes("schema")) {
      // Retry without dedicated provider columns
      delete dbUpdates.provider_detected;
      delete dbUpdates.provider_confidence;
      result = await admin
        .from("uploads")
        .update(dbUpdates)
        .eq("id", uploadId)
        .eq("company_id", companyId)
        .select("*")
        .single();
    }
  }

  if (result.error || !result.data) throw new Error(`Failed to update upload: ${result.error?.message}`);
  return mapRow(result.data as Record<string, unknown>);
}

async function getUploadMetadata(uploadId: string): Promise<Record<string, unknown> | null> {
  const admin = createAdminClient();
  if (!admin) return null;
  const { data } = await admin.from("uploads").select("metadata").eq("id", uploadId).maybeSingle();
  return (data?.metadata as Record<string, unknown>) ?? null;
}
