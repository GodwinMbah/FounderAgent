"use server";

import { createClient } from "@/lib/supabase/server";
import { requireAuthCompany } from "@/lib/db/company";
import { recordCategoryCorrection } from "@/lib/intelligence/user-corrections";
import { getKpiExclusionReasonForCategory, isKpiExcludedCategory } from "@/lib/kpi-treatment";
import { revalidatePath } from "next/cache";

export async function updateTransactionCategory(
  transactionId: string,
  newCategory: string
): Promise<{ success: boolean; message: string }> {
  const ctx = await requireAuthCompany();
  if (!ctx) {
    return { success: false, message: "Unauthorized" };
  }
  const { companyId } = ctx;
  const supabase = await createClient();

  if (!supabase) {
    return { success: false, message: "Database not available" };
  }

  // 1. Fetch the transaction to verify ownership and get current data
  const { data: tx, error: fetchError } = await supabase
    .from("transactions")
    .select("id, company_id, category, merchant, description, reference, type, metadata")
    .eq("id", transactionId)
    .single();

  if (fetchError || !tx) {
    return { success: false, message: "Transaction not found" };
  }
  if (tx.company_id !== companyId) {
    return { success: false, message: "Unauthorized" };
  }

  const previousCategory = tx.category;
  const kpiExcluded = isKpiExcludedCategory(newCategory);
  const kpiExclusionReason = kpiExcluded ? getKpiExclusionReasonForCategory(newCategory) ?? "non_operating_movement" : null;
  const metadata = {
    ...((tx.metadata as Record<string, unknown> | null) ?? {}),
    previous_category_before_user_correction: previousCategory,
    category_source: "user",
    user_confirmed_category: true,
    user_category_locked: true,
    category_reason: `User confirmed category ${newCategory}.`,
    category_confidence: 100,
    kpi_treatment: kpiExcluded ? "excluded" : "included",
    kpi_excluded: kpiExcluded,
    kpi_exclusion_reason: kpiExclusionReason,
    user_corrected_at: new Date().toISOString(),
  };

  // 2. Update the transaction category
  const { error: updateError } = await supabase
    .from("transactions")
    .update({
      category: newCategory,
      status: "user_confirmed",
      confidence_score: 100,
      kpi_excluded: kpiExcluded,
      kpi_exclusion_reason: kpiExclusionReason,
      metadata,
    })
    .eq("id", transactionId);

  if (updateError) {
    return { success: false, message: updateError.message };
  }

  // 3. Record the correction as a learning rule
  await recordCategoryCorrection(companyId, {
    description: tx.description || tx.merchant || "",
    merchant: tx.merchant,
    reference: tx.reference,
    previousCategory: previousCategory || "",
    newCategory,
    type: tx.type,
  });

  // 4. Revalidate dashboard and transactions pages
  revalidatePath("/dashboard");
  revalidatePath("/transactions");

  return { success: true, message: "Category updated and saved as a rule for future transactions." };
}
