"use server";

import { getTransactionsPage, requireAuthCompany } from "@/lib/db";
import type { Transaction } from "@/lib/types";

export async function loadTransactionsPage(input: {
  from: string;
  to: string;
  limit: number;
  offset: number;
  type?: string;
  uploadId?: string;
  category?: string;
  status?: string;
  duplicateStatus?: "all" | "duplicates" | "not_duplicates";
  kpiTreatment?: "all" | "included" | "excluded";
  currency?: string;
  sourceProvider?: string;
}): Promise<{ success: boolean; transactions?: Transaction[]; total?: number; error?: string }> {
  try {
    const { companyId } = await requireAuthCompany();
    const result = await getTransactionsPage(companyId, {
      startDate: input.from,
      endDate: input.to,
      limit: input.limit,
      offset: input.offset,
      type: input.type === "income" || input.type === "expense" ? input.type : undefined,
      uploadId: input.uploadId && input.uploadId !== "all" ? input.uploadId : undefined,
      category: input.category && input.category !== "all" ? input.category : undefined,
      status: input.status && input.status !== "all" ? input.status : undefined,
      duplicateStatus: input.duplicateStatus,
      kpiTreatment: input.kpiTreatment,
      currency: input.currency && input.currency !== "all" ? input.currency : undefined,
      sourceProvider: input.sourceProvider && input.sourceProvider !== "all" ? input.sourceProvider : undefined,
    });

    return { success: true, transactions: result.transactions, total: result.total };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load transactions";
    return { success: false, error: message };
  }
}
