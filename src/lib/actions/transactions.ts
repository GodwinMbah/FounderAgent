"use server";

import { createClient } from "@/lib/supabase/server";
import { requireAuthCompany } from "@/lib/db/company";
import { recordCategoryCorrection } from "@/lib/intelligence/user-corrections";
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
    .select("id, company_id, category, merchant, description, reference, type")
    .eq("id", transactionId)
    .single();

  if (fetchError || !tx) {
    return { success: false, message: "Transaction not found" };
  }
  if (tx.company_id !== companyId) {
    return { success: false, message: "Unauthorized" };
  }

  const previousCategory = tx.category;

  // 2. Update the transaction category
  const { error: updateError } = await supabase
    .from("transactions")
    .update({ category: newCategory })
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
