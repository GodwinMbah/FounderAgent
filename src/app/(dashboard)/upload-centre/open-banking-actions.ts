"use server";

import { revalidatePath } from "next/cache";
import { requireAuthCompany } from "@/lib/db/company";
import { runPlaidSandboxSyncForCompany, type OpenBankingSandboxSyncResult } from "@/lib/open-banking/sandbox-sync";

export async function runOpenBankingSandboxSync(): Promise<OpenBankingSandboxSyncResult> {
  const { companyId } = await requireAuthCompany();
  const result = await runPlaidSandboxSyncForCompany(companyId);
  revalidatePath("/upload-centre");
  revalidatePath("/transactions");
  revalidatePath("/dashboard");
  revalidatePath("/cash-flow");
  return result;
}
