"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { randomUUID } from "crypto";

const BUCKET_NAME = "financial_uploads";

function getExtension(filename: string): string {
  const parts = filename.split(".");
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : "bin";
}

function sanitiseFileName(name: string): string {
  return name
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/_{2,}/g, "_")
    .substring(0, 100);
}

function buildStoragePath(
  fileName: string,
  companyId: string,
  _userId: string
): string {
  const ext = getExtension(fileName);
  const safeName = sanitiseFileName(fileName.replace(/\.[^.]+$/, ""));
  const uniqueId = randomUUID().split("-")[0];
  return `${companyId}/${uniqueId}/${safeName}_${uniqueId}.${ext}`;
}

export async function uploadFileToStorage(
  file: File,
  companyId: string,
  userId: string
): Promise<{ path: string }> {
  const adminClient = createAdminClient();
  if (!adminClient) throw new Error("Storage admin client not available");

  const path = buildStoragePath(file.name, companyId, userId);

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  const { error: uploadError } = await adminClient.storage
    .from(BUCKET_NAME)
    .upload(path, buffer, {
      contentType: file.type || "application/octet-stream",
      upsert: false,
    });

  if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`);

  return { path };
}

export async function getSignedFileUrl(path: string, expiresInSeconds = 3600): Promise<string> {
  const adminClient = createAdminClient();
  if (!adminClient) throw new Error("Storage admin client not available");

  const { data, error } = await adminClient.storage
    .from(BUCKET_NAME)
    .createSignedUrl(path, expiresInSeconds);

  if (error || !data) throw new Error(`Could not create signed URL: ${error?.message}`);
  return data.signedUrl;
}

export async function deleteFileFromStorage(path: string): Promise<void> {
  const adminClient = createAdminClient();
  if (!adminClient) throw new Error("Storage admin client not available");

  const { error } = await adminClient.storage.from(BUCKET_NAME).remove([path]);
  if (error) throw new Error(`Delete failed: ${error.message}`);
}
