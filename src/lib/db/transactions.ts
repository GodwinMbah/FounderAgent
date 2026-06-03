"use server";

import { createClient as createServerClient } from "@/lib/supabase/server";
import { getActiveCompanyForUser } from "./company";
import type { Transaction } from "@/lib/types";
import { isIncome, isExpense } from "@/lib/reporting/filters";

function mapRow(row: Record<string, unknown>): Transaction {
  const metadata = row.metadata as Record<string, unknown> | undefined;
  return {
    id: row.id as string,
    companyId: row.company_id as string,
    uploadId: row.upload_id as string | undefined,
    accountId: row.bank_account_id as string | undefined,
    sourceRowNumber: (row.source_row_number as number | undefined) ?? (metadata?.source_row_number as number | undefined),
    externalTransactionId: (row.external_transaction_id as string | undefined) ?? (metadata?.external_transaction_id as string | undefined),
    postedDate: (row.posted_date as string | undefined) ?? (metadata?.posted_date as string | undefined),
    currency: (row.currency as string | undefined) ?? (metadata?.currency as string | undefined),
    sourceProvider: (row.source_provider as string | undefined) ?? (metadata?.source_provider as string | undefined),
    rawRowHash: (row.raw_row_hash as string | undefined) ?? (metadata?.raw_row_hash as string | undefined),
    reference: (row.reference as string | undefined) ?? (metadata?.reference as string | undefined),
    rowStatus: (row.row_status as string | undefined) ?? (metadata?.row_status as string | undefined),
    kpiExcluded: (row.kpi_excluded as boolean | undefined) ?? (metadata?.kpi_excluded as boolean | undefined),
    kpiExclusionReason: (row.kpi_exclusion_reason as string | undefined) ?? (metadata?.kpi_exclusion_reason as string | undefined),
    duplicateOfTransactionId: (row.duplicate_of_transaction_id as string | undefined) ?? (metadata?.duplicate_of_transaction_id as string | undefined),
    originalAmount: metadata?.original_amount as number | undefined,
    originalCurrency: metadata?.original_currency as string | undefined,
    feeAmount: (row.fee_amount as number | undefined) ?? (metadata?.fee_amount as number | undefined),
    feeCurrency: metadata?.fee_currency as string | undefined,
    runningBalance: (row.running_balance as number | undefined) ?? (metadata?.running_balance as number | undefined),
    date: row.date as string,
    merchant: row.merchant as string | undefined,
    description: row.description as string,
    category: row.category as string | undefined,
    subcategory: metadata?.detected_subcategory as string | undefined,
    categoryReason: metadata?.category_reason as string | undefined,
    categoryConfidence: metadata?.category_confidence as number | undefined,
    groupingConfidence: metadata?.grouping_confidence as number | undefined,
    categoryEvidence: metadata?.category_evidence as Transaction["categoryEvidence"] | undefined,
    businessMeaning: metadata?.business_meaning as string | undefined,
    kpiTreatment: metadata?.kpi_treatment as Transaction["kpiTreatment"] | undefined,
    categorySource: metadata?.category_source as Transaction["categorySource"] | undefined,
    userConfirmedCategory: metadata?.user_confirmed_category as boolean | undefined,
    intelligenceGroupId: metadata?.intelligence_group_id as string | undefined,
    intelligenceGroupLabel: metadata?.intelligence_group_label as string | undefined,
    intelligenceGroupReason: metadata?.intelligence_group_reason as string | undefined,
    intelligenceGroupSignals: metadata?.intelligence_group_signals as string[] | undefined,
    isCreditCardRepayment: metadata?.is_credit_card_repayment as boolean | undefined,
    amount: Number(row.amount),
    type: row.type as "income" | "expense",
    status: row.status as string,
    confidenceScore: row.confidence_score as number | undefined,
    tags: row.tags as string[] | undefined,
    notes: row.notes as string | undefined,
    isRecurring: row.is_recurring as boolean | undefined,
    subscriptionId: row.subscription_id as string | undefined,
    metadata,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

export interface GetTransactionsOptions {
  startDate?: string;
  endDate?: string;
  accountId?: string;
  type?: "income" | "expense";
  uploadId?: string;
  category?: string;
  status?: string;
  duplicateStatus?: "all" | "duplicates" | "not_duplicates";
  kpiTreatment?: "all" | "included" | "excluded";
  currency?: string;
  sourceProvider?: string;
  limit?: number;
  offset?: number;
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
    .order("date", { ascending: false })
    .order("source_row_number", { ascending: true, nullsFirst: false })
    .order("id", { ascending: true });

  if (options?.startDate) query = query.gte("date", options.startDate);
  if (options?.endDate) query = query.lte("date", options.endDate);
  if (options?.accountId) query = query.eq("bank_account_id", options.accountId);
  if (options?.type) query = query.eq("type", options.type);
  if (options?.uploadId) query = query.eq("upload_id", options.uploadId);
  if (options?.category) query = query.eq("category", options.category);
  if (options?.status) query = query.eq("status", options.status);
  if (options?.currency) query = query.eq("currency", options.currency);
  if (options?.sourceProvider) query = query.eq("source_provider", options.sourceProvider);
  if (options?.duplicateStatus === "duplicates") query = query.not("duplicate_of_transaction_id", "is", null);
  if (options?.duplicateStatus === "not_duplicates") query = query.is("duplicate_of_transaction_id", null);
  if (options?.kpiTreatment === "excluded") query = query.eq("kpi_excluded", true);
  if (options?.kpiTreatment === "included") query = query.eq("kpi_excluded", false);
  if (options?.offset !== undefined) {
    const limit = options.limit ?? 100;
    query = query.range(options.offset, options.offset + limit - 1);
  } else if (options?.limit) {
    query = query.limit(options.limit);
  }

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  return (data ?? []).map(mapRow);
}

export async function getTransactionsPage(
  companyId?: string,
  options?: GetTransactionsOptions
): Promise<{ transactions: Transaction[]; total: number }> {
  const ctx = await getActiveCompanyForUser();
  if (!ctx) throw new Error("Unauthorized");
  const effectiveCompanyId = companyId ?? ctx.companyId;
  if (effectiveCompanyId !== ctx.companyId) throw new Error("Forbidden: company mismatch");

  const supabase = await createServerClient();
  if (!supabase) throw new Error("Supabase not configured");

  let query = supabase
    .from("transactions")
    .select("*", { count: "exact" })
    .eq("company_id", effectiveCompanyId)
    .order("date", { ascending: false })
    .order("source_row_number", { ascending: true, nullsFirst: false })
    .order("id", { ascending: true });

  if (options?.startDate) query = query.gte("date", options.startDate);
  if (options?.endDate) query = query.lte("date", options.endDate);
  if (options?.accountId) query = query.eq("bank_account_id", options.accountId);
  if (options?.type) query = query.eq("type", options.type);
  if (options?.uploadId) query = query.eq("upload_id", options.uploadId);
  if (options?.category) query = query.eq("category", options.category);
  if (options?.status) query = query.eq("status", options.status);
  if (options?.currency) query = query.eq("currency", options.currency);
  if (options?.sourceProvider) query = query.eq("source_provider", options.sourceProvider);
  if (options?.duplicateStatus === "duplicates") query = query.not("duplicate_of_transaction_id", "is", null);
  if (options?.duplicateStatus === "not_duplicates") query = query.is("duplicate_of_transaction_id", null);
  if (options?.kpiTreatment === "excluded") query = query.eq("kpi_excluded", true);
  if (options?.kpiTreatment === "included") query = query.eq("kpi_excluded", false);

  const limit = options?.limit ?? 500;
  const offset = options?.offset ?? 0;
  query = query.range(offset, offset + limit - 1);

  const { data, error, count } = await query;

  if (error) throw error;

  return {
    transactions: (data ?? []).map(mapRow),
    total: count ?? data?.length ?? 0,
  };
}

export async function getTransactionStats(companyId?: string) {
  const txs = await getTransactions(companyId);
  const total = txs.reduce((s, t) => s + (isIncome(t) ? t.amount : 0), 0);
  const expenses = txs.reduce((s, t) => s + (isExpense(t) ? t.amount : 0), 0);
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
  sourceRowNumber?: number;
  externalTransactionId?: string;
  postedDate?: string;
  currency?: string;
  sourceProvider?: string;
  rawRowHash?: string;
  reference?: string;
  rowStatus?: string;
  kpiExcluded?: boolean;
  kpiExclusionReason?: string;
  duplicateOfTransactionId?: string;
  feeAmount?: number;
  runningBalance?: number;
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
    source_row_number: t.sourceRowNumber,
    external_transaction_id: t.externalTransactionId,
    posted_date: t.postedDate,
    currency: t.currency,
    source_provider: t.sourceProvider,
    raw_row_hash: t.rawRowHash,
    reference: t.reference,
    row_status: t.rowStatus,
    kpi_excluded: t.kpiExcluded ?? false,
    kpi_exclusion_reason: t.kpiExclusionReason,
    duplicate_of_transaction_id: t.duplicateOfTransactionId,
    fee_amount: t.feeAmount,
    running_balance: t.runningBalance,
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

const CHUNK_SIZE = 300;
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 500;
const OPTIONAL_PROOF_COLUMNS = ["posted_date", "fee_amount", "running_balance"];

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isOptionalProofColumnError(message: string): boolean {
  const lower = message.toLowerCase();
  return OPTIONAL_PROOF_COLUMNS.some((column) => lower.includes(column)) &&
    (lower.includes("column") || lower.includes("schema cache"));
}

function stripOptionalProofColumns(row: Record<string, unknown>): Record<string, unknown> {
  const next = { ...row };
  for (const column of OPTIONAL_PROOF_COLUMNS) delete next[column];
  return next;
}

export async function createTransactionsChunked(
  transactions: TransactionInsert[]
): Promise<{
  count: number;
  rows: Array<{
    id: string;
    sourceRowNumber?: number;
    rawRowHash?: string;
    externalTransactionId?: string;
  }>;
  error?: string;
}> {
  if (transactions.length === 0) return { count: 0, rows: [] };

  const admin = createAdminClient();
  if (!admin) throw new Error("Admin client not available");

  let totalInserted = 0;
  const insertedRows: Array<{
    id: string;
    sourceRowNumber?: number;
    rawRowHash?: string;
    externalTransactionId?: string;
  }> = [];

  for (let i = 0; i < transactions.length; i += CHUNK_SIZE) {
    const chunk = transactions.slice(i, i + CHUNK_SIZE).map(toDbRow);
    let chunkForAttempt = chunk;
    let strippedOptionalProofColumns = false;
    let lastError: string | undefined;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      const { data, error } = await admin
        .from("transactions")
        .insert(chunkForAttempt)
        .select("id, source_row_number, raw_row_hash, external_transaction_id");

      if (!error) {
        const rows = data ?? [];
        totalInserted += rows.length;
        insertedRows.push(
          ...rows.map((row) => ({
            id: row.id as string,
            sourceRowNumber: row.source_row_number as number | undefined,
            rawRowHash: row.raw_row_hash as string | undefined,
            externalTransactionId: row.external_transaction_id as string | undefined,
          }))
        );
        lastError = undefined;
        break;
      }

      lastError = error.message;
      if (!strippedOptionalProofColumns && isOptionalProofColumnError(error.message)) {
        console.warn("[createTransactionsChunked] Optional proof columns missing in live schema; falling back to metadata-only for posted_date, fee_amount, running_balance.");
        chunkForAttempt = chunk.map(stripOptionalProofColumns);
        strippedOptionalProofColumns = true;
        continue;
      }

      console.error(`[createTransactionsChunked] Chunk ${i / CHUNK_SIZE + 1} attempt ${attempt} failed: ${error.message}`);

      if (attempt < MAX_RETRIES) {
        await sleep(RETRY_DELAY_MS * attempt);
      }
    }

    if (lastError) {
      return { count: totalInserted, rows: insertedRows, error: lastError };
    }
  }

  return { count: totalInserted, rows: insertedRows };
}
