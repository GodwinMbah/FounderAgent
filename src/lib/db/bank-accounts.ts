"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { getActiveCompanyForUser } from "./company";

export interface BankAccount {
  id: string;
  companyId: string;
  name: string;
  type: string;
  currency: string;
  currentBalance: number;
  lastStatementDate?: string;
  isActive: boolean;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

function mapRow(row: Record<string, unknown>): BankAccount {
  return {
    id: row.id as string,
    companyId: row.company_id as string,
    name: row.name as string,
    type: row.type as string,
    currency: row.currency as string,
    currentBalance: Number(row.current_balance) || 0,
    lastStatementDate: row.last_statement_date as string | undefined,
    isActive: row.is_active as boolean,
    metadata: row.metadata as Record<string, unknown> | undefined,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

export async function getOrCreateBankAccount(
  companyId: string,
  name: string,
  currency: string = "GBP"
): Promise<BankAccount> {
  const admin = createAdminClient();
  if (!admin) throw new Error("Admin client not available");

  // Try to find existing
  const { data: existing } = await admin
    .from("bank_accounts")
    .select("*")
    .eq("company_id", companyId)
    .ilike("name", name)
    .maybeSingle();

  if (existing) return mapRow(existing as Record<string, unknown>);

  // Create new
  const { data: row, error } = await admin
    .from("bank_accounts")
    .insert({
      company_id: companyId,
      name,
      type: "bank",
      currency,
      current_balance: 0,
      is_active: true,
    })
    .select("*")
    .single();

  if (error || !row) throw new Error(`Failed to create bank account: ${error?.message}`);
  return mapRow(row as Record<string, unknown>);
}

export async function updateBankAccountBalance(
  accountId: string,
  companyId: string,
  newBalance: number,
  statementDate?: string
): Promise<BankAccount | null> {
  const admin = createAdminClient();
  if (!admin) return null;

  const updates: Record<string, unknown> = {
    current_balance: newBalance,
    updated_at: new Date().toISOString(),
  };
  if (statementDate) updates.last_statement_date = statementDate;

  const { data, error } = await admin
    .from("bank_accounts")
    .update(updates)
    .eq("id", accountId)
    .eq("company_id", companyId)
    .select("*")
    .single();

  if (error || !data) {
    console.error("[bank-accounts] Update failed:", error?.message);
    return null;
  }
  return mapRow(data as Record<string, unknown>);
}

export async function getTotalCashBalance(companyId: string): Promise<number> {
  const ctx = await getActiveCompanyForUser();
  if (!ctx) throw new Error("Unauthorized");
  if (companyId !== ctx.companyId) throw new Error("Forbidden: company mismatch");

  return getTotalCashBalanceForCompany(companyId);
}

export async function getTotalCashBalanceForCompany(companyId: string): Promise<number> {
  const admin = createAdminClient();
  if (!admin) return 0;

  const { data, error } = await admin
    .from("bank_accounts")
    .select("current_balance")
    .eq("company_id", companyId)
    .eq("is_active", true);

  if (error || !data) return 0;
  return data.reduce((sum: number, row: { current_balance: number }) => sum + Number(row.current_balance), 0);
}
