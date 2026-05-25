/**
 * Upload-aware categorisation engine
 * Wraps the existing merchant-pattern categoriser and applies it to normalised CSV rows
 */

import { suggestTransactionCategory } from "@/lib/categorisation";
import type { Transaction, TransactionCategoryType, TransactionStatus } from "@/lib/types";
import type { NormalisedRow } from "@/lib/parser/adapters/generic-csv";

export interface CategorisedRow extends NormalisedRow {
  category: TransactionCategoryType;
  status: TransactionStatus;
  confidenceScore: number;
  categoryReason: string;
}

export function categoriseRows(rows: NormalisedRow[]): CategorisedRow[] {
  return rows.map((row) => {
    // Build a minimal Transaction for the existing categoriser
    const tx: Transaction = {
      id: `temp-${row.rowNumber}`,
      companyId: "",
      date: row.date,
      merchant: row.merchant,
      description: row.description,
      amount: row.amount,
      type: row.type,
      status: row.status,
    };

    const suggestion = suggestTransactionCategory(tx);

    return {
      ...row,
      category: suggestion.suggestedCategory,
      status: suggestion.status,
      confidenceScore: suggestion.confidenceScore,
      categoryReason: suggestion.reason,
    };
  });
}

export function getCategoryBreakdown(rows: CategorisedRow[]) {
  const map = new Map<TransactionCategoryType, { count: number; amount: number }>();

  for (const row of rows) {
    const existing = map.get(row.category) || { count: 0, amount: 0 };
    existing.count++;
    existing.amount += row.amount;
    map.set(row.category, existing);
  }

  return Array.from(map.entries())
    .map(([category, data]) => ({ category, ...data }))
    .sort((a, b) => b.amount - a.amount);
}
