/**
 * Upload Wizard Server Actions
 * Multi-step flow: validate → preview → map → process → summary
 * Uses DB-backed upload_sessions for state persistence (not in-memory)
 */

"use server";

import { requireAuthCompany } from "@/lib/db/company";
import { createUpload } from "@/lib/db/uploads";
import { createUploadSession, getUploadSession, updateUploadSession, deleteUploadSession, refreshUploadSession } from "@/lib/db/upload-sessions";
import { uploadFileToStorage } from "@/lib/upload/storage";
import { validateFile } from "@/lib/upload/validator";
import { smartMapCsv } from "@/lib/upload/smart-mapper";
import { runUploadPipeline } from "@/lib/upload/pipeline";
import { getCompanySettings } from "@/lib/db/company_settings";
import { getDefaultMappingProfile, getMappingProfiles, saveMappingProfile } from "@/lib/db/mapping-profiles";
import type {
  WizardValidation,
  WizardPreview,
  ImportSummary,
  MappingOverrides,
  SourceType,
} from "@/lib/upload/wizard-types";

/* ─── Step 1: Validate & Preview ─── */

export async function validateAndPreview(
  formData: FormData
): Promise<{
  success: boolean;
  sessionId?: string;
  validation?: WizardValidation;
  preview?: WizardPreview;
  error?: string;
}> {
  try {
    const { companyId, userId } = await requireAuthCompany();
    const file = formData.get("file") as File | null;
    const sourceTypeHint = (formData.get("sourceType") as SourceType) || "auto_detect";

    if (!file) return { success: false, error: "No file provided" };

    // Validate file
    const validation = await validateFile(file);
    if (!validation.valid) {
      return { success: false, error: validation.error, validation };
    }

    // Get company settings
    let companyCurrency: string | undefined;
    let companyCountry: string | undefined;
    try {
      const settings = await getCompanySettings(companyId);
      companyCurrency = settings?.currency ?? undefined;
      companyCountry = settings?.country ?? undefined;
    } catch {
      // Settings may not exist
    }

    // Try to load default mapping profile for detected source
    let defaultOverrides: MappingOverrides | undefined;
    try {
      const defaultProfile = await getDefaultMappingProfile(sourceTypeHint === "auto_detect" ? "bank_statement_csv" : sourceTypeHint);
      if (defaultProfile) {
        defaultOverrides = {};
        for (const [field, meta] of Object.entries(defaultProfile.columnMappings)) {
          const key = `${field}Column` as Extract<keyof MappingOverrides, `${string}Column`>;
          defaultOverrides[key] = meta.header;
        }
        if (defaultProfile.dateFormat) {
          defaultOverrides.dateFormat = defaultProfile.dateFormat;
        }
      }
    } catch {
      // No default profile, continue with auto-detect
    }

    // Determine if XLSX
    const ext = file.name.split(".").pop()?.toLowerCase();
    const isXlsx = ext === "xlsx" || ext === "xls";

    let preview: WizardPreview;
    let fileBuffer: ArrayBuffer | string;
    let mimeType = file.type || "text/csv";

    if (isXlsx) {
      const arrayBuffer = await file.arrayBuffer();
      const { parseXlsx } = await import("@/lib/parser/xlsx-adapter");
      const parsed = parseXlsx(arrayBuffer);
      // Convert ParsedCsv to text for storage (CSV format)
      const csvText = [parsed.headers.join(","), ...parsed.rows.map((r) => r.join(","))].join("\n");
      preview = await smartMapCsv(csvText, {
        companyId,
        companyCurrency,
        companyCountry,
        sourceTypeHint,
        overrides: defaultOverrides,
      });
      fileBuffer = csvText;
      mimeType = "text/csv";
    } else {
      const text = await file.text();
      preview = await smartMapCsv(text, {
        companyId,
        companyCurrency,
        companyCountry,
        sourceTypeHint,
        overrides: defaultOverrides,
      });
      fileBuffer = text;
    }

    // Upload to temporary storage
    const tempFile = new File([fileBuffer], file.name, { type: mimeType });
    const { path: filePath } = await uploadFileToStorage(tempFile, companyId, userId);

    // Create upload session in DB
    const session = await createUploadSession({
      companyId,
      userId,
      filePath,
      fileName: file.name,
      mimeType: file.type || "text/csv",
      parsedPreview: preview,
    });

    return { success: true, sessionId: session.id, validation, preview };
  } catch (err) {
    const raw = err instanceof Error ? err.message : "Preview failed";
    const message = translateError(raw);
    console.error("[validateAndPreview] Failed:", raw);
    return { success: false, error: message };
  }
}

function translateError(raw: string): string {
  const lower = raw.toLowerCase();
  if (lower.includes("bucket not found")) {
    return "Secure storage is not configured. Please contact support or try again after setup.";
  }
  if (lower.includes("file size") || lower.includes("too large") || lower.includes("413")) {
    return "This file exceeds the 10 MB limit. Please compress or split the file.";
  }
  if (lower.includes("storage policy") || lower.includes("row level security")) {
    return "You do not have permission to upload files for this workspace.";
  }
  if (lower.includes("upload failed")) {
    return "We could not upload this file. Please check your connection and try again.";
  }
  if (lower.includes("csv") || lower.includes("parse") || lower.includes("read file")) {
    return "We could not read this CSV. Please check the file is not corrupted.";
  }
  return raw;
}

/* ─── Step 2: Apply Mapping Overrides & Re-preview ─── */

export async function applyMappingOverrides(
  sessionId: string,
  overrides: MappingOverrides,
  sourceTypeHint?: SourceType
): Promise<{
  success: boolean;
  preview?: WizardPreview;
  error?: string;
}> {
  try {
    const { companyId } = await requireAuthCompany();
    const session = await getUploadSession(sessionId, companyId);

    if (!session) {
      // Distinguish between genuinely expired and query failure
      // getUploadSession now logs DB errors, so if we reach here it's likely expired
      return { success: false, error: "Session expired. Please upload again." };
    }

    let companyCurrency: string | undefined;
    let companyCountry: string | undefined;
    try {
      const settings = await getCompanySettings(companyId);
      companyCurrency = settings?.currency ?? undefined;
      companyCountry = settings?.country ?? undefined;
    } catch {
      // Settings may not exist
    }

    // Fetch file from storage and re-parse
    const adminClient = await import("@/lib/supabase/admin").then((m) => m.createAdminClient());
    if (!adminClient) throw new Error("Admin client not available");

    const { data: fileData, error: downloadError } = await adminClient.storage
      .from("financial_uploads")
      .download(session.filePath);

    if (downloadError || !fileData) {
      return { success: false, error: "Could not retrieve uploaded file. Please upload again." };
    }

    const text = await fileData.text();

    const preview = await smartMapCsv(text, {
      companyId,
      companyCurrency,
      companyCountry,
      sourceTypeHint,
      overrides,
    });

    // Update session with new preview and overrides
    await updateUploadSession(sessionId, companyId, {
      parsedPreview: preview,
      mappingOverrides: overrides,
    });

    return { success: true, preview };
  } catch (err) {
    const raw = err instanceof Error ? err.message : "Mapping failed";
    console.error("[applyMappingOverrides] Failed:", raw);
    return { success: false, error: translateError(raw) };
  }
}

/* ─── Step 3: Confirm & Process ─── */

export async function confirmAndProcess(
  sessionId: string,
  overrides?: MappingOverrides,
  categoryOverrides?: Record<number, string>
): Promise<{
  success: boolean;
  uploadId?: string;
  summary?: ImportSummary;
  error?: string;
}> {
  try {
    const { companyId, userId } = await requireAuthCompany();
    const session = await getUploadSession(sessionId, companyId);

    if (!session) {
      return { success: false, error: "Session expired. Please upload again." };
    }

    // Fetch file from storage
    const adminClient = await import("@/lib/supabase/admin").then((m) => m.createAdminClient());
    if (!adminClient) throw new Error("Admin client not available");

    const { data: fileData, error: downloadError } = await adminClient.storage
      .from("financial_uploads")
      .download(session.filePath);

    if (downloadError || !fileData) {
      return { success: false, error: "Could not retrieve uploaded file. Please upload again." };
    }

    const text = await fileData.text();

    // Re-parse with final overrides
    let companyCurrency: string | undefined;
    let companyCountry: string | undefined;
    try {
      const settings = await getCompanySettings(companyId);
      companyCurrency = settings?.currency ?? undefined;
      companyCountry = settings?.country ?? undefined;
    } catch {
      // Settings may not exist
    }

    const finalPreview = await smartMapCsv(text, {
      companyId,
      companyCurrency,
      companyCountry,
      overrides,
    });

    // Check if mapping is valid
    if (finalPreview.failedRows.length > 0 && finalPreview.previewRows.length === 0) {
      return {
        success: false,
        error: `No valid rows could be parsed. ${finalPreview.failedRows.length} rows failed. Check your column mapping.`,
      };
    }

    // Create upload record (permanent)
    const upload = await createUpload({
      companyId,
      userId,
      fileName: session.fileName,
      filePath: session.filePath,
      fileSize: new Blob([text]).size,
      mimeType: session.mimeType || "text/csv",
      source: finalPreview.sourceType,
      status: "pending",
      metadata: {
        column_mappings: finalPreview.columnMappings,
        mapping_confidence: finalPreview.mappingConfidence,
        detected_currency: finalPreview.detectedCurrency,
        detected_date_format: finalPreview.detectedDateFormat,
        detected_delimiter: finalPreview.detectedDelimiter,
        detected_provider: finalPreview.detectedProvider,
        provider_confidence: finalPreview.providerConfidence,
        preview_income_total: finalPreview.incomeTotal,
        preview_expense_total: finalPreview.expenseTotal,
        preview_row_count: finalPreview.previewRows.length,
        failed_row_count: finalPreview.failedRows.length,
        category_overrides: categoryOverrides,
      },
    });

    // Run pipeline
    console.log(`[confirmAndProcess] Starting pipeline for upload ${upload.id}`);
    const pipelineResult = await runUploadPipeline(upload.id, companyId);
    console.log(`[confirmAndProcess] Pipeline result: success=${pipelineResult.success}, error=${pipelineResult.error}, inserted=${pipelineResult.transactionsInserted}`);

    // Delete upload session only on success (so user can retry if pipeline fails)
    if (pipelineResult.success) {
      await deleteUploadSession(sessionId, companyId);
    }

    const summary: ImportSummary = {
      success: pipelineResult.success,
      uploadId: upload.id,
      fileName: session.fileName,
      sourceType: finalPreview.sourceType,
      rowsInFile: pipelineResult.reconciliation?.rowsInFile ?? finalPreview.previewRows.length + finalPreview.failedRows.length,
      rowsParsed: pipelineResult.reconciliation?.rowsParsed ?? pipelineResult.totalParsed,
      rowsValid: pipelineResult.reconciliation?.rowsValid ?? pipelineResult.totalParsed,
      rowsImported: pipelineResult.reconciliation?.rowsInserted ?? pipelineResult.transactionsInserted,
      rowsSkipped: pipelineResult.reconciliation?.rowsSkippedDuplicate ?? pipelineResult.duplicateCount,
      rowsFailed: pipelineResult.reconciliation?.rowsFailed ?? pipelineResult.transactionsFailed,
      rowsNeedReview: pipelineResult.needReviewCount,
      rowsUncategorised: pipelineResult.reconciliation?.rowsUncategorised ?? 0,
      rowsAmbiguous: pipelineResult.reconciliation?.rowsAmbiguous ?? 0,
      rowsCategorised: pipelineResult.categorisedCount,
      rowsHighConfidence: pipelineResult.reconciliation?.rowsHighConfidence ?? 0,
      rowsCategorisedByUserRule: pipelineResult.reconciliation?.rowsCategorisedByUserRule ?? 0,
      rowsCategorisedBySystemIntelligence: pipelineResult.reconciliation?.rowsCategorisedBySystemIntelligence ?? pipelineResult.categorisedCount,
      rowsIncludedInRevenue: pipelineResult.reconciliation?.rowsIncludedInRevenue ?? 0,
      rowsIncludedInExpenses: pipelineResult.reconciliation?.rowsIncludedInExpenses ?? 0,
      rowsIncludedInCashFlow: pipelineResult.reconciliation?.rowsIncludedInCashFlow ?? 0,
      rowsTransfer: pipelineResult.transferCount,
      rowsDuplicate: pipelineResult.duplicateCount,
      rowsKpiExcluded: pipelineResult.reconciliation?.rowsExcludedFromKpis ?? pipelineResult.transferCount + pipelineResult.duplicateCount,
      rowsLinkedToSubscriptions: pipelineResult.reconciliation?.rowsLinkedToSubscriptions ?? 0,
      rowsWithFees: pipelineResult.reconciliation?.rowsWithFees ?? 0,
      rowsWithRefunds: pipelineResult.reconciliation?.rowsWithRefunds ?? 0,
      rowsWithCreditCardRepaymentTreatment: pipelineResult.reconciliation?.rowsWithCreditCardRepaymentTreatment ?? 0,
      reconciliationBalanced: pipelineResult.reconciliation?.reconciliationBalanced ?? pipelineResult.success,
      reconciliationExplanation: pipelineResult.reconciliation?.explanation,
      incomeTotal: finalPreview.incomeTotal,
      expenseTotal: finalPreview.expenseTotal,
      sourceCurrency: finalPreview.detectedCurrency,
      baseCurrency: companyCurrency || finalPreview.detectedCurrency,
      subscriptionsDetected: pipelineResult.subscriptionsDetected,
      unknownTransactions: pipelineResult.reconciliation?.rowsUncategorised ?? finalPreview.previewRows.filter((r) => r.category === "Uncategorised Review").length,
      alertsCreated: pipelineResult.alertsCreated,
      recommendationsCreated: pipelineResult.recommendationsCreated,
      error: pipelineResult.error,
    };

    return { success: pipelineResult.success, uploadId: upload.id, summary };
  } catch (err) {
    const raw = err instanceof Error ? err.message : "Processing failed";
    console.error("[confirmAndProcess] Failed:", raw);
    return { success: false, error: raw };
  }
}

/* ─── Mapping Profiles ─── */

export async function loadMappingProfiles(sourceType?: SourceType): Promise<{
  success: boolean;
  profiles?: { id: string; name: string; sourceType: string }[];
  error?: string;
}> {
  try {
    const profiles = await getMappingProfiles(sourceType);
    return {
      success: true,
      profiles: profiles.map((p) => ({ id: p.id, name: p.profileName, sourceType: p.sourceType })),
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load profiles";
    return { success: false, error: message };
  }
}

export async function saveCurrentMappingProfile(
  profileName: string,
  preview: WizardPreview,
  overrides: MappingOverrides,
  isDefault: boolean
): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const columnMappings: Record<string, { header: string; index: number }> = {};
    for (const m of preview.columnMappings) {
      columnMappings[m.field] = { header: m.header, index: m.index };
    }

    await saveMappingProfile({
      sourceType: preview.sourceType,
      profileName,
      columnMappings,
      dateFormat: overrides.dateFormat,
      currency: preview.detectedCurrency,
      delimiter: preview.detectedDelimiter,
      isDefault,
    });

    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to save profile";
    return { success: false, error: message };
  }
}

/* ─── Get Upload Status ─── */

export async function refreshSession(sessionId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { companyId } = await requireAuthCompany();
    const ok = await refreshUploadSession(sessionId, companyId);
    if (!ok) {
      return { success: false, error: "Session refresh failed. The upload session may have expired." };
    }
    return { success: true };
  } catch (err) {
    const raw = err instanceof Error ? err.message : "Refresh failed";
    return { success: false, error: raw };
  }
}

export async function getUploadStatus(uploadId: string): Promise<{
  status: string;
  transactionCount?: number;
  errorMessage?: string;
  pipelineStage?: string;
  pipelineProgress?: number;
  metadata?: Record<string, unknown>;
  fileName?: string;
  source?: string;
  uploadId?: string;
}> {
  try {
    const { companyId } = await requireAuthCompany();

    const { createAdminClient } = await import("@/lib/supabase/admin");
    const admin = createAdminClient();
    if (!admin) throw new Error("Admin client not available");

    const { data, error } = await admin
      .from("uploads")
      .select("status, transaction_count, error_message, pipeline_stage, pipeline_progress, metadata, file_name, source")
      .eq("id", uploadId)
      .eq("company_id", companyId)
      .single();

    if (error || !data) throw new Error("Upload not found");

    return {
      status: data.status,
      transactionCount: data.transaction_count,
      errorMessage: data.error_message,
      pipelineStage: data.pipeline_stage,
      pipelineProgress: data.pipeline_progress,
      metadata: data.metadata as Record<string, unknown>,
      fileName: data.file_name,
      source: data.source,
      uploadId,
    };
  } catch (err) {
    const raw = err instanceof Error ? err.message : "Unknown error";
    console.error("[getUploadStatus] Failed:", raw);
    return { status: "failed", errorMessage: translateError(raw) };
  }
}
