"use server";

import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { AccountKpiRouting, ConnectedAccountStatus, OpenBankingProviderId, OpenBankingSyncStatus } from "./types";

export interface ConnectedAccountSummary {
  id: string;
  provider: OpenBankingProviderId | string;
  providerAccountId?: string;
  providerInstitutionId?: string;
  institutionId?: string;
  institutionName?: string;
  consentId?: string;
  accountName: string;
  accountType?: string;
  accountSubtype?: string;
  currency: string;
  currentBalance: number;
  availableBalance?: number;
  creditLimit?: number;
  cashBalanceSource: boolean;
  connectionStatus: ConnectedAccountStatus | string;
  syncStatus?: OpenBankingSyncStatus | string;
  syncError?: string;
  consentExpiresAt?: string;
  lastSyncedAt?: string;
  lastSuccessfulSyncAt?: string;
  transactionsSynced: number;
  duplicatesSkipped: number;
  kpiRouting?: AccountKpiRouting;
}

export async function getConnectedAccountSummaries(companyId: string): Promise<ConnectedAccountSummary[]> {
  const supabase = createAdminClient() ?? await createServerClient();
  if (!supabase) throw new Error("Supabase not configured");

  const { data, error } = await supabase
    .from("bank_accounts")
    .select(`
      id,
      name,
      type,
      currency,
      current_balance,
      provider,
      provider_account_id,
      connected_institution_id,
      provider_consent_id,
      account_subtype,
      available_balance,
      credit_limit,
      connection_status,
      consent_expires_at,
      last_synced_at,
      last_successful_sync_at,
      sync_status,
      sync_error,
      kpi_routing,
      metadata,
      updated_at
    `)
    .eq("company_id", companyId)
    .eq("is_active", true)
    .order("name", { ascending: true });

  if (error) throw error;

  const openBankingRows = (data ?? []).filter((row: Record<string, unknown>) => {
    const metadata = (row.metadata as Record<string, unknown> | null) ?? {};
    return row.provider || metadata.source_kind === "open_banking";
  }) as Array<Record<string, unknown>>;

  const institutionIds = Array.from(new Set(openBankingRows.map((row) => row.connected_institution_id).filter(Boolean))) as string[];
  const providerAccountIds = Array.from(new Set(openBankingRows.map((row) => row.provider_account_id).filter(Boolean))) as string[];

  const institutionById = new Map<string, Record<string, unknown>>();
  if (institutionIds.length > 0) {
    const { data: institutions, error: institutionError } = await supabase
      .from("connected_institutions")
      .select("id, provider_institution_id, institution_name")
      .in("id", institutionIds);
    if (institutionError) throw institutionError;
    for (const institution of institutions ?? []) institutionById.set(institution.id as string, institution as Record<string, unknown>);
  }

  const latestSyncJobByProvider = new Map<string, Record<string, unknown>>();
  const providers = Array.from(new Set(openBankingRows.map((row) => row.provider).filter(Boolean))) as string[];
  if (providers.length > 0) {
    const { data: syncJobs, error: syncJobError } = await supabase
      .from("open_banking_sync_jobs")
      .select("provider, connected_institution_id, transactions_seen, transactions_inserted, duplicates_skipped, status, error_message, completed_at, created_at")
      .eq("company_id", companyId)
      .in("provider", providers)
      .order("created_at", { ascending: false })
      .limit(50);
    if (syncJobError) throw syncJobError;
    for (const job of syncJobs ?? []) {
      const key = `${job.provider ?? ""}:${job.connected_institution_id ?? ""}`;
      if (!latestSyncJobByProvider.has(key)) latestSyncJobByProvider.set(key, job as Record<string, unknown>);
    }
  }

  const transactionsByProviderAccount = new Map<string, number>();
  if (providerAccountIds.length > 0) {
    const { data: transactionRows, error: transactionError } = await supabase
      .from("transactions")
      .select("source_account_provider_id, metadata")
      .eq("company_id", companyId)
      .in("source_account_provider_id", providerAccountIds);
    if (transactionError) throw transactionError;
    for (const transaction of transactionRows ?? []) {
      const providerAccountId = transaction.source_account_provider_id as string | undefined;
      if (!providerAccountId) continue;
      transactionsByProviderAccount.set(providerAccountId, (transactionsByProviderAccount.get(providerAccountId) ?? 0) + 1);
    }
  }

  const accounts: ConnectedAccountSummary[] = [];
  for (const row of openBankingRows) {
    const metadata = (row.metadata as Record<string, unknown> | null) ?? {};
    const kpiRouting = (row.kpi_routing as AccountKpiRouting | null) ?? metadata.kpi_routing as AccountKpiRouting | undefined;
    const institution = row.connected_institution_id ? institutionById.get(row.connected_institution_id as string) : undefined;
    const syncJob = latestSyncJobByProvider.get(`${row.provider ?? metadata.provider ?? ""}:${row.connected_institution_id ?? ""}`);
    const providerAccountId = (row.provider_account_id as string | undefined) ?? metadata.provider_account_id as string | undefined;
    accounts.push({
      id: row.id as string,
      provider: (row.provider as string | undefined) ?? (metadata.provider as string | undefined) ?? "unknown",
      providerAccountId,
      providerInstitutionId: (institution?.provider_institution_id as string | undefined) ?? (metadata.provider_institution_id as string | undefined),
      institutionId: row.connected_institution_id as string | undefined,
      institutionName: (institution?.institution_name as string | undefined) ?? (metadata.institution_name as string | undefined) ?? "Connected institution",
      consentId: row.provider_consent_id as string | undefined,
      accountName: (metadata.connected_account_name as string | undefined) ?? (row.name as string),
      accountType: (metadata.connected_account_type as string | undefined) ?? (row.type as string | undefined),
      accountSubtype: (row.account_subtype as string | undefined) ?? (metadata.connected_account_subtype as string | undefined),
      currency: (row.currency as string | undefined) ?? "GBP",
      currentBalance: Number(row.current_balance) || 0,
      availableBalance: row.available_balance === null || row.available_balance === undefined ? undefined : Number(row.available_balance),
      creditLimit: row.credit_limit === null || row.credit_limit === undefined ? undefined : Number(row.credit_limit),
      cashBalanceSource: kpiRouting?.cashBalanceSource ?? (metadata.cash_balance_source !== false),
      connectionStatus: (row.connection_status as string | undefined) ?? (metadata.connection_status as string | undefined) ?? "connected",
      syncStatus: (row.sync_status as string | undefined) ?? (metadata.sync_status as string | undefined),
      syncError: (row.sync_error as string | undefined) ?? (syncJob?.error_message as string | undefined),
      consentExpiresAt: row.consent_expires_at as string | undefined,
      lastSyncedAt: (row.last_synced_at as string | undefined) ?? (metadata.last_synced_at as string | undefined),
      lastSuccessfulSyncAt: (row.last_successful_sync_at as string | undefined) ?? (metadata.last_successful_sync_at as string | undefined) ?? (row.updated_at as string | undefined),
      transactionsSynced: providerAccountId ? transactionsByProviderAccount.get(providerAccountId) ?? 0 : 0,
      duplicatesSkipped: Number(syncJob?.duplicates_skipped ?? 0),
      kpiRouting,
    });
  }

  return accounts;
}
