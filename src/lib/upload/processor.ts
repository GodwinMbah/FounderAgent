"use server";

import { runUploadPipeline } from "./pipeline";

/**
 * Legacy entry point — delegates to the new pipeline orchestrator
 */
export async function processUpload(
  uploadId: string,
  companyId: string
): Promise<void> {
  const result = await runUploadPipeline(uploadId, companyId);
  if (!result.success) {
    throw new Error(result.error ?? "Upload processing failed");
  }
}
