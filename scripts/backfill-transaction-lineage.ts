#!/usr/bin/env tsx
/**
 * Safely promote historical transaction lineage fields from metadata into
 * top-level columns after schema promotion migrations have been applied.
 *
 * Dry run:
 *   npx tsx scripts/backfill-transaction-lineage.ts --company-id <uuid>
 *
 * Apply:
 *   npx tsx scripts/backfill-transaction-lineage.ts --company-id <uuid> --apply
 */

import { createClient } from "@supabase/supabase-js";
import { getRequiredSupabaseScriptConfig } from "./supabase-env";

type DbRow = Record<string, unknown> & {
  id: string;
  company_id: string;
  metadata?: Record<string, unknown> | null;
};

type FieldSpec = {
  column: string;
  metadataKeys: string[];
  coerce: (value: unknown) => unknown;
};

const FIELD_SPECS: FieldSpec[] = [
  { column: "posted_date", metadataKeys: ["posted_date", "postedDate"], coerce: coerceDate },
  { column: "fee_amount", metadataKeys: ["fee_amount", "feeAmount"], coerce: coerceNumber },
  { column: "running_balance", metadataKeys: ["running_balance", "runningBalance"], coerce: coerceNumber },
  { column: "currency", metadataKeys: ["currency"], coerce: coerceCurrency },
  { column: "reference", metadataKeys: ["reference"], coerce: coerceString },
  { column: "external_transaction_id", metadataKeys: ["external_transaction_id", "external_id", "externalTransactionId"], coerce: coerceString },
  { column: "source_provider", metadataKeys: ["source_provider", "sourceProvider"], coerce: coerceString },
  { column: "raw_row_hash", metadataKeys: ["raw_row_hash", "rawRowHash"], coerce: coerceString },
  { column: "source_row_number", metadataKeys: ["source_row_number", "sourceRowNumber"], coerce: coerceInteger },
  { column: "row_status", metadataKeys: ["row_status", "rowStatus"], coerce: coerceString },
  { column: "kpi_excluded", metadataKeys: ["kpi_excluded", "kpiExcluded"], coerce: coerceBoolean },
  { column: "kpi_exclusion_reason", metadataKeys: ["kpi_exclusion_reason", "kpiExclusionReason"], coerce: coerceString },
];

function getArg(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  if (index === -1) return undefined;
  return process.argv[index + 1];
}

function hasFlag(name: string): boolean {
  return process.argv.includes(name);
}

function isMissing(value: unknown): boolean {
  return value === null || value === undefined || value === "";
}

function coerceString(value: unknown): string | undefined {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed ? trimmed : undefined;
  }
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return undefined;
}

function coerceCurrency(value: unknown): string | undefined {
  const text = coerceString(value);
  if (!text) return undefined;
  const upper = text.toUpperCase();
  return /^[A-Z]{3}$/.test(upper) ? upper : undefined;
}

function coerceDate(value: unknown): string | undefined {
  const text = coerceString(value);
  if (!text) return undefined;
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) return undefined;
  return parsed.toISOString().slice(0, 10);
}

function coerceNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return undefined;
  const cleaned = value.replace(/[£$€,\s]/g, "").replace(/^\((.*)\)$/, "-$1");
  if (!cleaned) return undefined;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function coerceInteger(value: unknown): number | undefined {
  const parsed = coerceNumber(value);
  if (parsed === undefined) return undefined;
  return Number.isInteger(parsed) ? parsed : Math.trunc(parsed);
}

function coerceBoolean(value: unknown): boolean | undefined {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const lower = value.trim().toLowerCase();
    if (["true", "yes", "1", "excluded"].includes(lower)) return true;
    if (["false", "no", "0", "included"].includes(lower)) return false;
  }
  return undefined;
}

function firstMetadataValue(metadata: Record<string, unknown>, keys: string[]): unknown {
  for (const key of keys) {
    const value = metadata[key];
    if (!isMissing(value)) return value;
  }
  const rawData = metadata.raw_data;
  if (rawData && typeof rawData === "object") {
    const raw = rawData as Record<string, unknown>;
    for (const key of keys) {
      const value = raw[key] ?? raw[key.replace(/_/g, " ")];
      if (!isMissing(value)) return value;
    }
  }
  return undefined;
}

function buildPatch(row: DbRow): Record<string, unknown> {
  const metadata = row.metadata ?? {};
  const patch: Record<string, unknown> = {};

  for (const spec of FIELD_SPECS) {
    if (!isMissing(row[spec.column])) continue;
    const metadataValue = firstMetadataValue(metadata, spec.metadataKeys);
    const value = spec.coerce(metadataValue);
    if (!isMissing(value)) patch[spec.column] = value;
  }

  return patch;
}

async function main() {
  const companyId = getArg("--company-id");
  const uploadId = getArg("--upload-id");
  const limit = Number(getArg("--limit") ?? "5000");
  const apply = hasFlag("--apply");

  if (!companyId) {
    throw new Error("Missing required --company-id <uuid>");
  }
  if (!Number.isInteger(limit) || limit <= 0 || limit > 20000) {
    throw new Error("--limit must be an integer between 1 and 20000");
  }

  const { url, secretKey } = getRequiredSupabaseScriptConfig();
  const supabase = createClient(url, secretKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  let query = supabase
    .from("transactions")
    .select("*")
    .eq("company_id", companyId)
    .order("created_at", { ascending: true })
    .limit(limit);

  if (uploadId) {
    query = query.eq("upload_id", uploadId);
  }

  const { data, error } = await query;
  if (error) throw new Error(`Failed to read transactions: ${error.message}`);

  const rows = (data ?? []) as DbRow[];
  const candidates = rows
    .map((row) => ({ row, patch: buildPatch(row) }))
    .filter(({ patch }) => Object.keys(patch).length > 0);

  const fieldCounts: Record<string, number> = {};
  for (const { patch } of candidates) {
    for (const field of Object.keys(patch)) fieldCounts[field] = (fieldCounts[field] ?? 0) + 1;
  }

  console.log(JSON.stringify({
    mode: apply ? "apply" : "dry_run",
    companyId,
    uploadId,
    rowsRead: rows.length,
    rowsBackfillable: candidates.length,
    fieldCounts,
    sample: candidates.slice(0, 10).map(({ row, patch }) => ({
      id: row.id,
      fields: Object.keys(patch),
    })),
  }, null, 2));

  if (!apply || candidates.length === 0) return;

  let updated = 0;
  for (const { row, patch } of candidates) {
    const { error: updateError } = await supabase
      .from("transactions")
      .update(patch)
      .eq("company_id", companyId)
      .eq("id", row.id);

    if (updateError) {
      throw new Error(`Failed to update transaction ${row.id}: ${updateError.message}`);
    }
    updated++;
  }

  console.log(JSON.stringify({ mode: "apply", updated }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
