"use server";

import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { FinancialDataSourceStatus } from "./data-source-shared";

export type { FinancialDataSourceStatus } from "./data-source-shared";

type SupabaseLike = Awaited<ReturnType<typeof createServerClient>> | ReturnType<typeof createAdminClient>;

const ACTIVE_UPLOAD_STATUSES = ["completed", "processing", "pending"];

function normalizeDate(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  return value.slice(0, 10);
}

function sortDates(dates: string[]): string[] {
  return [...dates].sort((a, b) => a.localeCompare(b));
}

export async function getActiveUploadIdsForCompany(
  companyId: string,
  client?: SupabaseLike
): Promise<string[]> {
  const supabase = client ?? createAdminClient();
  if (!supabase) throw new Error("Supabase not configured");

  const { data, error } = await supabase
    .from("uploads")
    .select("id")
    .eq("company_id", companyId)
    .in("status", ACTIVE_UPLOAD_STATUSES);

  if (error) throw error;
  return (data ?? []).map((row: { id: string }) => row.id);
}

export async function getFinancialDataSourceStatus(
  companyId: string,
  range?: { from?: string; to?: string }
): Promise<FinancialDataSourceStatus> {
  const supabase = createAdminClient() ?? await createServerClient();
  if (!supabase) throw new Error("Supabase not configured");

  const activeUploadIds = await getActiveUploadIdsForCompany(companyId, supabase);

  const sourceRows: Array<{ date?: string; upload_id?: string | null; source_provider?: string | null }> = [];

  if (activeUploadIds.length > 0) {
    const { data, error } = await supabase
      .from("transactions")
      .select("date, upload_id, source_provider")
      .eq("company_id", companyId)
      .in("upload_id", activeUploadIds);
    if (error) throw error;
    sourceRows.push(...((data ?? []) as Array<{ date?: string; upload_id?: string | null; source_provider?: string | null }>));
  }

  const { data: manualRows, error: manualError } = await supabase
    .from("transactions")
    .select("date, upload_id, source_provider")
    .eq("company_id", companyId)
    .is("upload_id", null);

  if (manualError) throw manualError;
  sourceRows.push(...((manualRows ?? []) as Array<{ date?: string; upload_id?: string | null; source_provider?: string | null }>));

  const dates = sourceRows.map((row) => normalizeDate(row.date)).filter(Boolean) as string[];
  const sortedDates = sortDates(dates);
  const selectedRows =
    range?.from && range?.to
      ? sourceRows.filter((row) => {
          const date = normalizeDate(row.date);
          return Boolean(date && date >= range.from! && date <= range.to!);
        })
      : undefined;

  const connectedProviders = new Set(["plaid", "truelayer", "yapily", "tink", "gocardless_bank_account_data", "enable_banking", "sandbox"]);
  const connectedTransactionCount = sourceRows.filter((row) => !row.upload_id && connectedProviders.has((row.source_provider ?? "").toLowerCase())).length;
  const manualTransactionCount = sourceRows.filter((row) => !row.upload_id && !connectedProviders.has((row.source_provider ?? "").toLowerCase())).length;
  const activeUploadTransactionCount = sourceRows.filter((row) => Boolean(row.upload_id)).length;

  const { data: connectedAccounts } = await supabase
    .from("bank_accounts")
    .select("id, metadata")
    .eq("company_id", companyId)
    .eq("is_active", true);
  const connectedAccountCount = (connectedAccounts ?? []).filter((row: { metadata?: Record<string, unknown> | null }) =>
    row.metadata?.source_kind === "open_banking"
  ).length;

  return {
    hasActiveDataSource: activeUploadIds.length > 0 || manualTransactionCount > 0 || connectedTransactionCount > 0 || connectedAccountCount > 0,
    activeUploadCount: activeUploadIds.length,
    activeTransactionCount: sourceRows.length,
    manualTransactionCount,
    activeUploadTransactionCount,
    connectedAccountCount,
    connectedTransactionCount,
    selectedTransactionCount: selectedRows?.length,
    earliestTransactionDate: sortedDates[0],
    latestTransactionDate: sortedDates[sortedDates.length - 1],
    selectedFrom: range?.from,
    selectedTo: range?.to,
  };
}
