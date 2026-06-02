"use server";

import { createClient as createServerClient } from "@/lib/supabase/server";
import { getActiveCompanyForUser } from "./company";
import { isExpense } from "@/lib/reporting/filters";
import type { Budget } from "@/lib/types";

function mapRow(row: Record<string, unknown>): Budget {
  return {
    id: row.id as string,
    companyId: row.company_id as string,
    category: row.category as string,
    amount: Number(row.amount),
    period: row.period as string,
    startDate: row.start_date as string,
    endDate: row.end_date as string | undefined,
    alertThreshold: Number(row.alert_threshold),
    isActive: row.is_active as boolean,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

export async function getBudgets(companyId?: string): Promise<Budget[]> {
  const ctx = await getActiveCompanyForUser();
  if (!ctx) throw new Error("Unauthorized");
  const effectiveCompanyId = companyId ?? ctx.companyId;
  if (effectiveCompanyId !== ctx.companyId) throw new Error("Forbidden: company mismatch");

  const supabase = await createServerClient();
  if (!supabase) throw new Error("Supabase not configured");

  const { data, error } = await supabase
    .from("budgets")
    .select("*")
    .eq("company_id", effectiveCompanyId)
    .eq("is_active", true)
    .order("category");

  if (error) {
    throw error;
  }

  return (data ?? []).map(mapRow);
}

export async function getBudgetStats(
  companyId?: string,
  transactions: { category?: string; amount: number; type: string }[] = []
) {
  const ctx = await getActiveCompanyForUser();
  if (!ctx) throw new Error("Unauthorized");
  const effectiveCompanyId = companyId ?? ctx.companyId;
  if (effectiveCompanyId !== ctx.companyId) throw new Error("Forbidden: company mismatch");

  const budgets = await getBudgets(effectiveCompanyId);
  let totalBudget = 0;
  let totalSpent = 0;
  let overBudgetCount = 0;
  const categories = budgets.map((b) => {
    const spent = transactions
      .filter((t) => isExpense(t) && t.category === b.category)
      .reduce((s, t) => s + t.amount, 0);
    const percentUsed = b.amount > 0 ? (spent / b.amount) * 100 : 0;
    totalBudget += b.amount;
    totalSpent += spent;
    if (percentUsed > 100) overBudgetCount++;
    return { ...b, spent, percentUsed, remaining: b.amount - spent };
  });
  return { totalBudget, totalSpent, overBudgetCount, categories, percentUsed: totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0 };
}
