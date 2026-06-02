"use server";

import { requireAuthCompany } from "@/lib/db/company";
import { updateCompanySettings } from "@/lib/db/company_settings";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function updateBusinessProfile(
  companyId: string,
  profile: {
    businessModel: string;
    revenueModels: string[];
    costStructure: string[];
  }
) {
  const ctx = await requireAuthCompany();
  if (!ctx || ctx.companyId !== companyId) {
    throw new Error("Unauthorized");
  }

  // Update direct columns (works when migration 013 has been applied)
  await updateCompanySettings(companyId, {
    businessModel: profile.businessModel,
    revenueModels: profile.revenueModels,
    costStructure: profile.costStructure,
  });

  // Fallback: also update onboarding_data for environments where
  // the business intelligence columns haven't been migrated yet.
  // Use admin client to bypass broken RLS (same pattern as getCompanySettings).
  const supabase = createAdminClient() ?? await createServerClient();
  if (supabase) {
    const { data: existing } = await supabase
      .from("company_settings")
      .select("onboarding_data")
      .eq("company_id", companyId)
      .single();

    const mergedOnboarding = {
      ...(existing?.onboarding_data as Record<string, unknown> || {}),
      business_model: profile.businessModel,
      revenue_models: profile.revenueModels,
      cost_structure: profile.costStructure,
    };

    const { error: onboardingError } = await supabase
      .from("company_settings")
      .update({ onboarding_data: mergedOnboarding })
      .eq("company_id", companyId);

    if (onboardingError) {
      console.error(
        "[updateBusinessProfile] onboarding_data fallback failed:",
        onboardingError.message
      );
    }
  }
}
