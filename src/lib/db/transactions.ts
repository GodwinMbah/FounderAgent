"use server";

import { createClient as createServerClient } from "@/lib/supabase/server";
import { getActiveCompanyForUser } from "./company";
import type { Transaction } from "@/lib/types";

function mapRow(row: Record<string, unknown>): Transaction {
  return {
    id: row.id as string,
    companyId: row.company_id as string,
    uploadId: row.upload_id as string | undefined,
    accountId: row.bank_account_id as string | undefined,
    date: row.date as string,
    merchant: row.merchant as string | undefined,
    description: row.description as string,
    category: row.category as string | undefined,
    amount: Number(row.amount),
    type: row.type as "income" | "expense",
    status: row.status as string,
    confidenceScore: row.confidence_score as number | undefined,
    tags: row.tags as string[] | undefined,
    notes: row.notes as string | undefined,
    isRecurring: row.is_recurring as boolean | undefined,
    subscriptionId: row.subscription_id as string | undefined,
    metadata: row.metadata as Record<string, unknown> | undefined,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

export interface GetTransactionsOptions {
  startDate?: string;
  endDate?: string;
  accountId?: string;
  limit?: number;
}

export async function getTransactions(
  companyId?: string,
  options?: GetTransactionsOptions
): Promise<Transaction[]> {
  const ctx = await getActiveCompanyForUser();
  if (!ctx) throw new Error("Unauthorized");
  const effectiveCompanyId = companyId ?? ctx.companyId;
  if (effectiveCompanyId !== ctx.companyId) throw new Error("Forbidden: company mismatch");

  const supabase = await createServerClient();
  if (!supabase) throw new Error("Supabase not configured");

  let query = supabase
    .from("transactions")
    .select("*")
    .eq("company_id", effectiveCompanyId)
    .order("date", { ascending: false });

  if (options?.startDate) query = query.gte("date", options.startDate);
  if (options?.endDate) query = query.lte("date", options.endDate);
  if (options?.accountId) query = query.eq("bank_account_id", options.accountId);
  if (options?.limit) query = query.limit(options.limit);

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  return (data ?? []).map(mapRow);
}

export async function getTransactionStats(companyId?: string) {
  const txs = await getTransactions(companyId);
  const total = txs.reduce((s, t) => s + (t.type === "income" ? t.amount : 0), 0);
  const expenses = txs.reduce((s, t) => s + (t.type === "expense" ? t.amount : 0), 0);
  const categorized = txs.filter((t) => t.status === "categorised").length;
  const needsReview = txs.filter((t) => t.status === "needs_review").length;
  return { total, expenses, count: txs.length, categorized, needsReview };
}

/* ─── Write helpers (admin client — server-only) ─── */

import { createAdminClient } from "@/lib/supabase/admin";

export interface TransactionInsert {
  companyId: string;
  uploadId?: string;
  bankAccountId?: string;
  date: string;
  merchant?: string;
  description: string;
  category?: string;
  amount: number;
  type: "income" | "expense";
  status?: string;
  confidenceScore?: number;
  tags?: string[];
  notes?: string;
  isRecurring?: boolean;
  subscriptionId?: string;
  metadata?: Record<string, unknown>;
}

function toDbRow(t: TransactionInsert): Record<string, unknown> {
  return {
    company_id: t.companyId,
    upload_id: t.uploadId,
    bank_account_id: t.bankAccountId,
    date: t.date,
    merchant: t.merchant,
    description: t.description,
    category: t.category,
    amount: t.amount,
    type: t.type,
    status: t.status ?? "needs_review",
    confidence_score: t.confidenceScore,
    tags: t.tags ?? [],
    notes: t.notes,
    is_recurring: t.isRecurring ?? false,
    subscription_id: t.subscriptionId,
    metadata: t.metadata ?? {},
  };
}

export async function createTransactions(
  transactions: TransactionInsert[]
): Promise<{ count: number; data?: Transaction[]; error?: string }> {
  if (transactions.length === 0) return { count: 0 };

  const admin = createAdminClient();
  if (!admin) throw new Error("Admin client not available");

  const rows = transactions.map(toDbRow);
  const { data, error } = await admin.from("transactions").insert(rows).select("*");

  if (error) {
    return { count: 0, error: error.message };
  }

  return { count: data?.length ?? 0, data: (data ?? []).map(mapRow) };
}

const CHUNK_SIZE = 500;

export async function createTransactionsChunked(
  transactions: TransactionInsert[]
): Promise<{ count: number; error?: string }> {
  if (transactions.length === 0) return { count: 0 };

  const admin = createAdminClient();
  if (!admin) throw new Error("Admin client not available");

  let totalInserted = 0;

  for (let i = 0; i < transactions.length; i += CHUNK_SIZE) {
    const chunk = transactions.slice(i, i + CHUNK_SIZE).map(toDbRow);
    const { error } = await admin.from("transactions").insert(chunk);

    if (error) {
      return { count: totalInserted, error: error.message };
    }

    totalInserted += chunk.length;
  }

  return { count: totalInserted };
}
