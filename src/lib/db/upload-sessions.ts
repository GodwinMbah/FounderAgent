"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import type { WizardPreview, MappingOverrides } from "@/lib/upload/wizard-types";

const EXPIRY_MINUTES = 30;

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

  const { data: row, error } = await admin
    .from("upload_sessions")
    .insert({
      company_id: data.companyId,
      user_id: data.userId,
      file_path: data.filePath,
      file_name: data.fileName,
      mime_type: data.mimeType ?? null,
      parsed_preview_json: data.parsedPreview ?? {},
      mapping_overrides_json: data.mappingOverrides ?? {},
      expires_at: new Date(Date.now() + EXPIRY_MINUTES * 60 * 1000).toISOString(),
    })
    .select("*")
    .single();

  if (error || !row) throw new Error(`Failed to create upload session: ${error?.message}`);
  return mapRow(row as Record<string, unknown>);
}

export async function getUploadSession(sessionId: string, companyId: string): Promise<UploadSession | null> {
  const admin = createAdminClient();
  if (!admin) throw new Error("Admin client not available");

  const { data, error } = await admin
    .from("upload_sessions")
    .select("*")
    .eq("id", sessionId)
    .eq("company_id", companyId)
    .gt("expires_at", new Date().toISOString())
    .single();

  if (error || !data) return null;
  return mapRow(data as Record<string, unknown>);
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
  if (updates.parsedPreview !== undefined) dbUpdates.parsed_preview_json = updates.parsedPreview;
  if (updates.mappingOverrides !== undefined) dbUpdates.mapping_overrides_json = updates.mappingOverrides;
  dbUpdates.expires_at = new Date(Date.now() + EXPIRY_MINUTES * 60 * 1000).toISOString();

  const { data, error } = await admin
    .from("upload_sessions")
    .update(dbUpdates)
    .eq("id", sessionId)
    .eq("company_id", companyId)
    .select("*")
    .single();

  if (error || !data) return null;
  return mapRow(data as Record<string, unknown>);
}

export async function deleteUploadSession(sessionId: string, companyId: string): Promise<void> {
  const admin = createAdminClient();
  if (!admin) return;

  await admin.from("upload_sessions").delete().eq("id", sessionId).eq("company_id", companyId);
}

export async function cleanupExpiredSessions(): Promise<number> {
  const admin = createAdminClient();
  if (!admin) return 0;

  const { error } = await admin
    .from("upload_sessions")
    .delete()
    .lt("expires_at", new Date().toISOString());

  if (error) {
    console.error("[upload-sessions] cleanup failed:", error.message);
    return 0;
  }

  // Supabase delete doesn't return count in JS client, return optimistic
  return 0;
}
