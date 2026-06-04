"use server";

import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { AccountKpiRouting, ConnectedAccountStatus, OpenBankingProviderId, OpenBankingSyncStatus } from "./types";

export interface ConnectedAccountSummary {
  id: string;
  provider: OpenBankingProviderId | string;
  providerAccountId?: string;
  accountName: string;
  accountType?: string;
  currency: string;
  currentBalance: number;
  cashBalanceSource: boolean;
  connectionStatus: ConnectedAccountStatus | string;
  syncStatus?: OpenBankingSyncStatus | string;
  lastSyncedAt?: string;
  lastSuccessfulSyncAt?: string;
  kpiRouting?: AccountKpiRouting;
}

export async function getConnectedAccountSummaries(companyId: string): Promise<ConnectedAccountSummary[]> {
  const supabase = createAdminClient() ?? await createServerClient();
  if (!supabase) throw new Error("Supabase not configured");

  const { data, error } = await supabase
    .from("bank_accounts")
    .select("id, name, type, currency, current_balance, metadata, updated_at")
    .eq("company_id", companyId)
    .eq("is_active", true)
    .order("name", { ascending: true });

  if (error) throw error;

  const accounts: ConnectedAccountSummary[] = [];
  for (const row of data ?? []) {
    const metadata = (row.metadata as Record<string, unknown> | null) ?? {};
    if (metadata.source_kind !== "open_banking") continue;
    const kpiRouting = metadata.kpi_routing as AccountKpiRouting | undefined;
    accounts.push({
      id: row.id as string,
      provider: (metadata.provider as string | undefined) ?? "unknown",
      providerAccountId: metadata.provider_account_id as string | undefined,
      accountName: (metadata.connected_account_name as string | undefined) ?? (row.name as string),
      accountType: (metadata.connected_account_type as string | undefined) ?? (row.type as string | undefined),
      currency: (row.currency as string | undefined) ?? "GBP",
      currentBalance: Number(row.current_balance) || 0,
      cashBalanceSource: kpiRouting?.cashBalanceSource ?? (metadata.cash_balance_source !== false),
      connectionStatus: (metadata.connection_status as string | undefined) ?? "connected",
      syncStatus: metadata.sync_status as string | undefined,
      lastSyncedAt: metadata.last_synced_at as string | undefined,
      lastSuccessfulSyncAt: (metadata.last_successful_sync_at as string | undefined) ?? (row.updated_at as string | undefined),
      kpiRouting,
    });
  }

  return accounts;
}
