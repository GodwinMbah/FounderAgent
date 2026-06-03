#!/usr/bin/env tsx
/**
 * FounderAgent legacy derived data cleanup.
 *
 * Dry-run by default:
 *   npx tsx scripts/legacy-derived-data-cleanup.ts --company-id <uuid>
 *
 * Mark stale metadata without deleting:
 *   npx tsx scripts/legacy-derived-data-cleanup.ts --company-id <uuid> --apply --mark-stale
 *
 * Normalize clearly user-created rows so source filters keep them:
 *   npx tsx scripts/legacy-derived-data-cleanup.ts --company-id <uuid> --apply --mark-manual
 *
 * Delete only generated, unbacked alerts/recommendations/tasks:
 *   npx tsx scripts/legacy-derived-data-cleanup.ts --company-id <uuid> --apply --delete-safe --confirm-delete-generated-legacy
 */

import { createClient } from "@supabase/supabase-js";
import { getRequiredSupabaseScriptConfig } from "./supabase-env";

type Json = Record<string, unknown>;

interface Args {
  companyId?: string;
  apply: boolean;
  markStale: boolean;
  markManual: boolean;
  deleteSafe: boolean;
  confirmDeleteGeneratedLegacy: boolean;
}

interface Finding {
  table: string;
  id: string;
  companyId: string;
  reason: string;
  recommendedAction: "mark_stale" | "mark_manual" | "delete_generated_legacy" | "review";
  title?: string;
}

const { url, secretKey } = getRequiredSupabaseScriptConfig();
const supabase = createClient(url, secretKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function parseArgs(): Args {
  const args = process.argv.slice(2);
  const readValue = (name: string) => {
    const idx = args.indexOf(name);
    return idx >= 0 ? args[idx + 1] : undefined;
  };
  return {
    companyId: readValue("--company-id"),
    apply: args.includes("--apply"),
    markStale: args.includes("--mark-stale"),
    markManual: args.includes("--mark-manual"),
    deleteSafe: args.includes("--delete-safe"),
    confirmDeleteGeneratedLegacy: args.includes("--confirm-delete-generated-legacy"),
  };
}

function metadata(row: { metadata?: unknown }): Json {
  return row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)
    ? (row.metadata as Json)
    : {};
}

function inputData(row: { input_data?: unknown }): Json {
  return row.input_data && typeof row.input_data === "object" && !Array.isArray(row.input_data)
    ? (row.input_data as Json)
    : {};
}

function hasUploadReference(meta: Json): boolean {
  return typeof meta.upload_id === "string" || typeof meta.source_upload_id === "string" || typeof meta.detected_from_upload === "string";
}

function uploadReferences(meta: Json): string[] {
  return [
    meta.upload_id,
    meta.source_upload_id,
    meta.detected_from_upload,
    meta.last_detected_from_upload,
  ].filter((value): value is string => typeof value === "string" && value.length > 0);
}

function looksManual(meta: Json): boolean {
  return meta.source === "manual" || meta.created_by === "user" || meta.user_created === true || meta.manual === true;
}

function needsManualMarker(meta: Json): boolean {
  return looksManual(meta) && meta.source !== "manual";
}

function looksGenerated(meta: Json): boolean {
  return (
    meta.generated_by === "upload_pipeline" ||
    meta.detected_from_upload !== undefined ||
    meta.last_detected_from_upload !== undefined ||
    meta.confidence !== undefined ||
    meta.transaction_count !== undefined ||
    meta.upload_id !== undefined ||
    meta.source_upload_id !== undefined
  );
}

async function selectRows<T extends Record<string, unknown>>(table: string, columns: string, companyId?: string): Promise<T[]> {
  let query = supabase.from(table).select(columns);
  if (companyId) query = query.eq("company_id", companyId);
  const { data, error } = await query.limit(5000);
  if (error) throw new Error(`${table}: ${error.message}`);
  return (data ?? []) as T[];
}

async function activeUploadIds(companyId?: string): Promise<Set<string>> {
  const rows = await selectRows<{ id: string; status: string }>("uploads", "id,status", companyId);
  return new Set(rows.filter((row) => ["completed", "processing", "pending"].includes(row.status)).map((row) => row.id));
}

function summarise(findings: Finding[]) {
  const byTable = findings.reduce<Record<string, number>>((acc, finding) => {
    acc[finding.table] = (acc[finding.table] ?? 0) + 1;
    return acc;
  }, {});
  const byAction = findings.reduce<Record<string, number>>((acc, finding) => {
    acc[finding.recommendedAction] = (acc[finding.recommendedAction] ?? 0) + 1;
    return acc;
  }, {});
  return { total: findings.length, byTable, byAction };
}

async function collectFindings(companyId?: string): Promise<Finding[]> {
  const activeUploads = await activeUploadIds(companyId);
  const findings: Finding[] = [];

  const alerts = await selectRows<{ id: string; company_id: string; title?: string; metadata?: unknown }>(
    "alerts",
    "id,company_id,title,metadata",
    companyId
  );
  for (const row of alerts) {
    const meta = metadata(row);
    if (looksManual(meta)) {
      if (needsManualMarker(meta)) {
        findings.push({
          table: "alerts",
          id: row.id,
          companyId: row.company_id,
          title: row.title,
          reason: "clearly user-created but missing normalized manual source marker",
          recommendedAction: "mark_manual",
        });
      }
      continue;
    }
    const uploadId = typeof meta.upload_id === "string" ? meta.upload_id : undefined;
    if (!uploadId || !activeUploads.has(uploadId)) {
      findings.push({
        table: "alerts",
        id: row.id,
        companyId: row.company_id,
        title: row.title,
        reason: uploadId ? `references inactive upload ${uploadId}` : "missing source upload lineage",
        recommendedAction: "delete_generated_legacy",
      });
    }
  }

  const recommendations = await selectRows<{ id: string; company_id: string; title?: string; metadata?: unknown }>(
    "agent_recommendations",
    "id,company_id,title,metadata",
    companyId
  );
  for (const row of recommendations) {
    const meta = metadata(row);
    if (looksManual(meta)) {
      if (needsManualMarker(meta)) {
        findings.push({
          table: "agent_recommendations",
          id: row.id,
          companyId: row.company_id,
          title: row.title,
          reason: "clearly user-created but missing normalized manual source marker",
          recommendedAction: "mark_manual",
        });
      }
      continue;
    }
    const uploadId = typeof meta.upload_id === "string" ? meta.upload_id : undefined;
    if (!uploadId || !activeUploads.has(uploadId)) {
      findings.push({
        table: "agent_recommendations",
        id: row.id,
        companyId: row.company_id,
        title: row.title,
        reason: uploadId ? `references inactive upload ${uploadId}` : "missing source upload lineage",
        recommendedAction: "delete_generated_legacy",
      });
    }
  }

  const tasks = await selectRows<{ id: string; company_id: string; title?: string; input_data?: unknown }>(
    "agent_tasks",
    "id,company_id,title,input_data",
    companyId
  );
  for (const row of tasks) {
    const data = inputData(row);
    if (looksManual(data)) {
      if (needsManualMarker(data)) {
        findings.push({
          table: "agent_tasks",
          id: row.id,
          companyId: row.company_id,
          title: row.title,
          reason: "clearly user-created but missing normalized manual source marker",
          recommendedAction: "mark_manual",
        });
      }
      continue;
    }
    const uploadId = typeof data.upload_id === "string" ? data.upload_id : undefined;
    if (!uploadId || !activeUploads.has(uploadId)) {
      findings.push({
        table: "agent_tasks",
        id: row.id,
        companyId: row.company_id,
        title: row.title,
        reason: uploadId ? `references inactive upload ${uploadId}` : "missing source upload lineage",
        recommendedAction: "delete_generated_legacy",
      });
    }
  }

  const subscriptions = await selectRows<{ id: string; company_id: string; name?: string; vendor?: string; metadata?: unknown }>(
    "subscriptions",
    "id,company_id,name,vendor,metadata",
    companyId
  );
  for (const row of subscriptions) {
    const meta = metadata(row);
    if (looksManual(meta)) {
      if (needsManualMarker(meta)) {
        findings.push({
          table: "subscriptions",
          id: row.id,
          companyId: row.company_id,
          title: row.name ?? row.vendor,
          reason: "clearly user-created but missing normalized manual source marker",
          recommendedAction: "mark_manual",
        });
      }
      continue;
    }
    if (!looksGenerated(meta)) continue;
    const uploadIds = uploadReferences(meta);
    if (uploadIds.length > 0 && !uploadIds.some((uploadId) => activeUploads.has(uploadId))) {
      findings.push({
        table: "subscriptions",
        id: row.id,
        companyId: row.company_id,
        title: row.name ?? row.vendor,
        reason: `looks upload-generated but references inactive upload(s): ${uploadIds.join(", ")}`,
        recommendedAction: "mark_stale",
      });
    } else if (!hasUploadReference(meta)) {
      findings.push({
        table: "subscriptions",
        id: row.id,
        companyId: row.company_id,
        title: row.name ?? row.vendor,
        reason: "looks upload-generated but has no source upload lineage",
        recommendedAction: "mark_stale",
      });
    }
  }

  const metrics = await selectRows<{ id: string; company_id: string; updated_at?: string; metadata?: unknown }>(
    "company_metrics",
    "id,company_id,updated_at,metadata",
    companyId
  );
  for (const row of metrics) {
    const meta = metadata(row);
    if (meta.source_dependency_checked_at) continue;
    findings.push({
      table: "company_metrics",
      id: row.id,
      companyId: row.company_id,
      reason: "metrics cache should be recalculated after source cleanup",
      recommendedAction: "mark_stale",
    });
  }

  const transactions = await selectRows<{
    id: string;
    company_id: string;
    upload_id?: string | null;
    source_provider?: string | null;
    source_row_number?: number | null;
    raw_row_hash?: string | null;
    metadata?: unknown;
  }>("transactions", "id,company_id,upload_id,source_provider,source_row_number,raw_row_hash,metadata", companyId);
  for (const row of transactions) {
    const meta = metadata(row);
    const hasProof =
      row.source_provider ||
      row.source_row_number ||
      row.raw_row_hash ||
      meta.source_provider ||
      meta.source_row_number ||
      meta.raw_row_hash;
    if (!row.upload_id && hasProof && !looksManual(meta)) {
      findings.push({
        table: "transactions",
        id: row.id,
        companyId: row.company_id,
        reason: "has imported-row proof fields but no upload_id",
        recommendedAction: "review",
      });
    }
  }

  return findings;
}

async function markStale(finding: Finding) {
  const stalePatch = {
    legacy_cleanup: {
      status: "stale",
      reason: finding.reason,
      checked_at: new Date().toISOString(),
      recommended_action: finding.recommendedAction,
    },
  };

  if (finding.table === "agent_tasks") {
    const { data } = await supabase.from("agent_tasks").select("input_data").eq("id", finding.id).single();
    const nextInput = { ...inputData(data ?? {}), ...stalePatch };
    return supabase.from("agent_tasks").update({ input_data: nextInput }).eq("id", finding.id);
  }

  const { data } = await supabase.from(finding.table).select("metadata").eq("id", finding.id).single();
  const nextMetadata = { ...metadata(data ?? {}), ...stalePatch };
  return supabase.from(finding.table).update({ metadata: nextMetadata }).eq("id", finding.id);
}

async function markManual(finding: Finding) {
  const manualPatch = {
    source: "manual",
    legacy_cleanup: {
      status: "manual_confirmed",
      reason: finding.reason,
      checked_at: new Date().toISOString(),
      recommended_action: finding.recommendedAction,
    },
  };

  if (finding.table === "agent_tasks") {
    const { data } = await supabase.from("agent_tasks").select("input_data").eq("id", finding.id).single();
    const nextInput = { ...inputData(data ?? {}), ...manualPatch };
    return supabase.from("agent_tasks").update({ input_data: nextInput }).eq("id", finding.id);
  }

  const { data } = await supabase.from(finding.table).select("metadata").eq("id", finding.id).single();
  const nextMetadata = { ...metadata(data ?? {}), ...manualPatch };
  return supabase.from(finding.table).update({ metadata: nextMetadata }).eq("id", finding.id);
}

async function deleteGeneratedLegacy(finding: Finding) {
  return supabase.from(finding.table).delete().eq("id", finding.id);
}

async function main() {
  const args = parseArgs();
  if ((args.markStale || args.markManual || args.deleteSafe) && !args.apply) {
    throw new Error("Use --apply with --mark-stale, --mark-manual, or --delete-safe. Dry run is the default.");
  }
  if (args.deleteSafe && !args.confirmDeleteGeneratedLegacy) {
    throw new Error("Destructive cleanup requires --confirm-delete-generated-legacy.");
  }

  const findings = await collectFindings(args.companyId);
  const sample = findings.slice(0, 50);

  const mutations: Array<{ id: string; table: string; action: string; ok: boolean; error?: string }> = [];
  if (args.apply && args.markStale) {
    for (const finding of findings.filter((item) => item.recommendedAction === "mark_stale")) {
      const result = await markStale(finding);
      mutations.push({ id: finding.id, table: finding.table, action: "mark_stale", ok: !result.error, error: result.error?.message });
    }
  }
  if (args.apply && args.markManual) {
    for (const finding of findings.filter((item) => item.recommendedAction === "mark_manual")) {
      const result = await markManual(finding);
      mutations.push({ id: finding.id, table: finding.table, action: "mark_manual", ok: !result.error, error: result.error?.message });
    }
  }
  if (args.apply && args.deleteSafe) {
    for (const finding of findings.filter((item) => item.recommendedAction === "delete_generated_legacy")) {
      const result = await deleteGeneratedLegacy(finding);
      mutations.push({ id: finding.id, table: finding.table, action: "delete_generated_legacy", ok: !result.error, error: result.error?.message });
    }
  }

  const output = {
    ok: mutations.every((mutation) => mutation.ok),
    mode: args.apply ? "apply" : "dry_run",
    companyId: args.companyId ?? "all",
    summary: summarise(findings),
    sample,
    mutations,
    safety: {
      deletesRequireExplicitConfirmation: true,
      deletesManualRecords: false,
      deletesUserRules: false,
      deletesCompanySettings: false,
      subscriptionsAreMarkedStaleNotDeleted: true,
      manualRecordsAreOnlyNormalizedWhenClearlyMarked: true,
      transactionsAreReviewOnly: true,
    },
  };

  console.log(JSON.stringify(output, null, 2));
  if (!output.ok) process.exit(1);
}

main().catch((error) => {
  console.error(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : String(error) }, null, 2));
  process.exit(1);
});
