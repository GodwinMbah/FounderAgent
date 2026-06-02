"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import type { WizardPreview, MappingOverrides } from "@/lib/upload/wizard-types";

const EXPIRY_MINUTES = 30;
const EXPIRY_MINUTES_LARGE_FILE = 120; // 2 hours for files > 100 rows

function getExpiryMinutes(rowCount?: number): number {
  if (rowCount && rowCount > 100) return EXPIRY_MINUTES_LARGE_FILE;
  return EXPIRY_MINUTES;
}

export interface UploadSession {
  id: string;
  companyId: string;
  userId: string | null;
  filePath: string;
  fileName: string;
  mimeType: string | null;
  parsedPreview: WizardPreview | null;
  mappingOverrides: MappingOverrides;
  expiresAt: string;
  createdAt: string;
}

function mapRow(row: Record<string, unknown>): UploadSession {
  return {
    id: row.id as string,
    companyId: row.company_id as string,
    userId: row.user_id as string | null,
    filePath: row.file_path as string,
    fileName: row.file_name as string,
    mimeType: row.mime_type as string | null,
    parsedPreview: (row.parsed_preview_json as WizardPreview | null) ?? null,
    mappingOverrides: (row.mapping_overrides_json as MappingOverrides | null) ?? {},
    expiresAt: row.expires_at as string,
    createdAt: row.created_at as string,
  };
}

export async function createUploadSession(data: {
  companyId: string;
  userId: string;
  filePath: string;
  fileName: string;
  mimeType?: string;
  parsedPreview?: WizardPreview;
  mappingOverrides?: MappingOverrides;
}): Promise<UploadSession> {
  const admin = createAdminClient();
  if (!admin) throw new Error("Admin client not available");

  // Store only lightweight metadata, NOT the full preview JSON.
  // The full preview can be 1MB+ for large files, causing query timeouts
  // when getUploadSession does .select("*"). The preview is never read
  // from the session — both applyMappingOverrides and confirmAndProcess
  // re-parse the file from storage.
  const rowCount = data.parsedPreview?.previewRows?.length;
  const expiryMinutes = getExpiryMinutes(rowCount);

  const { data: row, error } = await admin
    .from("upload_sessions")
    .insert({
      company_id: data.companyId,
      user_id: data.userId,
      file_path: data.filePath,
      file_name: data.fileName,
      mime_type: data.mimeType ?? null,
      // Store only metadata summary, not full preview
      parsed_preview_json: {
        row_count: rowCount ?? 0,
        failed_row_count: data.parsedPreview?.failedRows?.length ?? 0,
        provider: data.parsedPreview?.detectedProvider,
        provider_confidence: data.parsedPreview?.providerConfidence,
        source_type: data.parsedPreview?.sourceType,
        detected_currency: data.parsedPreview?.detectedCurrency,
        income_total: data.parsedPreview?.incomeTotal,
        expense_total: data.parsedPreview?.expenseTotal,
      },
      mapping_overrides_json: data.mappingOverrides ?? {},
      expires_at: new Date(Date.now() + expiryMinutes * 60 * 1000).toISOString(),
    })
    .select("*")
    .single();

  if (error || !row) throw new Error(`Failed to create upload session: ${error?.message}`);
  return mapRow(row as Record<string, unknown>);
}

export async function getUploadSession(sessionId: string, companyId: string): Promise<UploadSession | null> {
  const admin = createAdminClient();
  if (!admin) throw new Error("Admin client not available");

  // CRITICAL FIX: Do NOT select parsed_preview_json or mapping_overrides_json.
  // These columns can contain 1MB+ of JSON for large files, causing query
  // timeouts that return null — which the caller interprets as "session expired".
  const { data, error } = await admin
    .from("upload_sessions")
    .select("id, company_id, user_id, file_path, file_name, mime_type, expires_at, created_at")
    .eq("id", sessionId)
    .eq("company_id", companyId)
    .gt("expires_at", new Date().toISOString())
    .single();

  if (error) {
    console.error(`[getUploadSession] DB error for session ${sessionId}:`, error.message);
    return null;
  }
  if (!data) return null;

  return {
    id: data.id as string,
    companyId: data.company_id as string,
    userId: data.user_id as string | null,
    filePath: data.file_path as string,
    fileName: data.file_name as string,
    mimeType: data.mime_type as string | null,
    parsedPreview: null,
    mappingOverrides: {},
    expiresAt: data.expires_at as string,
    createdAt: data.created_at as string,
  };
}

export async function updateUploadSession(
  sessionId: string,
  companyId: string,
  updates: {
    parsedPreview?: WizardPreview;
    mappingOverrides?: MappingOverrides;
  }
): Promise<UploadSession | null> {
  const admin = createAdminClient();
  if (!admin) throw new Error("Admin client not available");

  const dbUpdates: Record<string, unknown> = {};
  // Only store lightweight metadata summary, never the full preview JSON
  if (updates.parsedPreview !== undefined) {
    dbUpdates.parsed_preview_json = {
      row_count: updates.parsedPreview.previewRows?.length ?? 0,
      failed_row_count: updates.parsedPreview.failedRows?.length ?? 0,
      provider: updates.parsedPreview.detectedProvider,
      provider_confidence: updates.parsedPreview.providerConfidence,
      source_type: updates.parsedPreview.sourceType,
      detected_currency: updates.parsedPreview.detectedCurrency,
      income_total: updates.parsedPreview.incomeTotal,
      expense_total: updates.parsedPreview.expenseTotal,
    };
  }
  if (updates.mappingOverrides !== undefined) dbUpdates.mapping_overrides_json = updates.mappingOverrides;

  const rowCount = updates.parsedPreview?.previewRows?.length;
  const expiryMinutes = getExpiryMinutes(rowCount);
  dbUpdates.expires_at = new Date(Date.now() + expiryMinutes * 60 * 1000).toISOString();

  const { data, error } = await admin
    .from("upload_sessions")
    .update(dbUpdates)
    .eq("id", sessionId)
    .eq("company_id", companyId)
    .select("id, company_id, user_id, file_path, file_name, mime_type, expires_at, created_at")
    .single();

  if (error) {
    console.error(`[updateUploadSession] DB error for session ${sessionId}:`, error.message);
    return null;
  }
  if (!data) return null;

  return {
    id: data.id as string,
    companyId: data.company_id as string,
    userId: data.user_id as string | null,
    filePath: data.file_path as string,
    fileName: data.file_name as string,
    mimeType: data.mime_type as string | null,
    parsedPreview: null,
    mappingOverrides: {},
    expiresAt: data.expires_at as string,
    createdAt: data.created_at as string,
  };
}

export async function deleteUploadSession(sessionId: string, companyId: string): Promise<void> {
  const admin = createAdminClient();
  if (!admin) return;

  await admin.from("upload_sessions").delete().eq("id", sessionId).eq("company_id", companyId);
}

/** Refresh session expiry without changing any data. Call this as a heartbeat
 *  while the user is reviewing the preview to prevent timeout. */
export async function refreshUploadSession(sessionId: string, companyId: string): Promise<boolean> {
  const admin = createAdminClient();
  if (!admin) return false;

  const { error } = await admin
    .from("upload_sessions")
    .update({ expires_at: new Date(Date.now() + EXPIRY_MINUTES_LARGE_FILE * 60 * 1000).toISOString() })
    .eq("id", sessionId)
    .eq("company_id", companyId);

  if (error) {
    console.error(`[refreshUploadSession] Failed for ${sessionId}:`, error.message);
    return false;
  }
  return true;
}

/* NOTE: No background cleanup job exists for expired upload_sessions rows.
 * They are filtered out at read time via the expires_at check in getUploadSession,
 * but old rows will accumulate until a periodic cleanup is added.
 */

