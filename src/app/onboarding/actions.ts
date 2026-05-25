"use server";

import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

/* ─── Validation helpers ─── */

function safeNumber(val: FormDataEntryValue | null): number | null {
  if (!val) return null;
  const n = Number(val);
  return Number.isFinite(n) ? n : null;
}

function safeString(val: FormDataEntryValue | null): string | null {
  if (!val) return null;
  const s = String(val).trim();
  return s.length > 0 ? s : null;
}

function safeJsonArray(val: FormDataEntryValue | null): string[] {
  if (!val) return [];
  try {
    const parsed = JSON.parse(String(val));
    return Array.isArray(parsed) ? parsed.filter((v) => typeof v === "string") : [];
  } catch {
    return [];
  }
}

function generateSlug(name: string): string {
  const base = name
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
  const suffix = Math.random().toString(36).substring(2, 6);
  return `${base}-${suffix}`;
}

/* ─── Types ─── */

export interface OnboardingPayload {
  fullName: string;
  role: string;
  companyName: string;
  industry: string;
  businessStage: string;
  country: string;
  currency: string;
  fiscalYearStart: string;
  timezone: string;
  primaryGoal: string;
  revenueModels: string[];
  monthlyRecurringRevenue: string;
  oneTimeRevenue: string;
  revenueRange: string;
  topRevenueChannels: string[];
  paymentTools: string[];
  averageMonthlyExpenses: string;
  biggestCostCategory?: string;
  activeSubscriptionCount: string;
  toolsUsed: string[];
  payrollSpend: string;
  advertisingSpend: string;
  cloudSpend: string;
  agentFocus: string[];
  alertSensitivity?: string;
  weeklyDigestEnabled: boolean;
  agentAutonomyLevel?: string;
}

export interface OnboardingResult {
  success?: boolean;
  error?: string;
  step?: string;
}

/* ─── Main action ─── */

export async function submitOnboarding(formData: FormData): Promise<OnboardingResult> {
  /* 1. Get authenticated user from Supabase Auth */
  const supabase = await createServerClient();
  if (!supabase) {
    return { error: "Supabase not configured", step: "auth" };
  }

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return { error: "You must be signed in to complete onboarding.", step: "auth" };
  }

  const userId = user.id;
  const email = user.email ?? "";

  /* 2. Parse and validate form data */
  const payload: OnboardingPayload = {
    fullName: safeString(formData.get("fullName")) ?? "",
    role: safeString(formData.get("role")) ?? "Founder",
    companyName: safeString(formData.get("companyName")) ?? "",
    industry: safeString(formData.get("industry")) ?? "",
    businessStage: safeString(formData.get("businessStage")) ?? "",
    country: safeString(formData.get("country")) ?? "",
    currency: safeString(formData.get("currency")) ?? "USD",
    fiscalYearStart: safeString(formData.get("fiscalYearStart")) ?? "1",
    timezone: safeString(formData.get("timezone")) ?? "UTC",
    primaryGoal: safeString(formData.get("primaryGoal")) ?? "",
    revenueModels: safeJsonArray(formData.get("revenueModels")),
    monthlyRecurringRevenue: safeString(formData.get("monthlyRecurringRevenue")) ?? "",
    oneTimeRevenue: safeString(formData.get("oneTimeRevenue")) ?? "",
    revenueRange: safeString(formData.get("revenueRange")) ?? "",
    topRevenueChannels: safeJsonArray(formData.get("topRevenueChannels")),
    paymentTools: safeJsonArray(formData.get("paymentTools")),
    averageMonthlyExpenses: safeString(formData.get("averageMonthlyExpenses")) ?? "",
    biggestCostCategory: safeString(formData.get("biggestCostCategory")) ?? undefined,
    activeSubscriptionCount: safeString(formData.get("activeSubscriptionCount")) ?? "",
    toolsUsed: safeJsonArray(formData.get("toolsUsed")),
    payrollSpend: safeString(formData.get("payrollSpend")) ?? "",
    advertisingSpend: safeString(formData.get("advertisingSpend")) ?? "",
    cloudSpend: safeString(formData.get("cloudSpend")) ?? "",
    agentFocus: safeJsonArray(formData.get("agentFocus")),
    alertSensitivity: safeString(formData.get("alertSensitivity")) ?? undefined,
    weeklyDigestEnabled: formData.get("weeklyDigestEnabled") === "true",
    agentAutonomyLevel: safeString(formData.get("agentAutonomyLevel")) ?? undefined,
  };

  /* 3. Validate required fields */
  const missing: string[] = [];
  if (!payload.fullName) missing.push("Full name");
  if (!payload.companyName) missing.push("Company name");
  if (!payload.industry) missing.push("Industry");
  if (!payload.businessStage) missing.push("Business stage");
  if (!payload.currency) missing.push("Currency");
  if (!payload.timezone) missing.push("Timezone");
  if (!payload.primaryGoal) missing.push("Primary goal");

  if (missing.length > 0) {
    return { error: `Please complete all required fields: ${missing.join(", ")}`, step: "validation" };
  }

  /* 4. Create company, profile, membership, settings via admin client */
  const admin = createAdminClient();
  if (!admin) {
    return { error: "Server configuration error. Please try again.", step: "config" };
  }

  // 4a. Check if user already has a company membership
  const { data: existingMembership } = await admin
    .from("company_members")
    .select("company_id")
    .eq("user_id", userId)
    .eq("is_active", true)
    .maybeSingle();

  let companyId: string;

  if (existingMembership?.company_id) {
    // User already has a company — reuse it and update
    companyId = existingMembership.company_id;

    const { error: updateError } = await admin
      .from("companies")
      .update({
        name: payload.companyName,
        industry: payload.industry,
        currency: payload.currency,
        fiscal_year_start: Number(payload.fiscalYearStart) || 1,
        timezone: payload.timezone,
        settings: {},
      })
      .eq("id", companyId);

    if (updateError) {
      console.error("[submitOnboarding] Company update failed:", updateError.message);
      return { error: `We could not update your workspace: ${updateError.message}`, step: "company_update" };
    }
  } else {
    // Create new company with collision-resistant slug
    const slug = generateSlug(payload.companyName);

    const { data: company, error: companyError } = await admin
      .from("companies")
      .insert({
        name: payload.companyName,
        slug,
        industry: payload.industry,
        currency: payload.currency,
        fiscal_year_start: Number(payload.fiscalYearStart) || 1,
        timezone: payload.timezone,
        settings: {},
      })
      .select("id")
      .single();

    if (companyError || !company) {
      console.error("[submitOnboarding] Company creation failed:", companyError?.message);
      return {
        error: `We could not create your workspace: ${companyError?.message ?? "Unknown database error"}`,
        step: "company_create",
      };
    }

    companyId = company.id;
  }

  // 4b. Upsert profile
  const { error: profileError } = await admin
    .from("profiles")
    .upsert({
      id: userId,
      email,
      full_name: payload.fullName,
      timezone: payload.timezone,
    }, { onConflict: "id" });

  if (profileError) {
    console.error("[submitOnboarding] Profile upsert failed:", profileError.message);
    return {
      error: `We could not save your profile: ${profileError.message}`,
      step: "profile",
    };
  }

  // 4c. Upsert company membership
  const { error: memberError } = await admin
    .from("company_members")
    .upsert({
      company_id: companyId,
      user_id: userId,
      role: "owner",
      is_active: true,
    }, { onConflict: "company_id, user_id" });

  if (memberError) {
    console.error("[submitOnboarding] Membership upsert failed:", memberError.message);
    return {
      error: `We could not link you to your workspace: ${memberError.message}`,
      step: "membership",
    };
  }

  // 4d. Upsert company settings
  const { error: settingsError } = await admin
    .from("company_settings")
    .upsert({
      company_id: companyId,
      industry: payload.industry,
      business_stage: payload.businessStage,
      country: payload.country,
      currency: payload.currency,
      fiscal_year_start: payload.fiscalYearStart,
      timezone: payload.timezone,
      primary_goal: payload.primaryGoal,
      revenue_model: payload.revenueModels.join(", ") || null,
      monthly_recurring_revenue: safeNumber(formData.get("monthlyRecurringRevenue")),
      one_time_revenue: safeNumber(formData.get("oneTimeRevenue")),
      average_monthly_revenue: safeNumber(formData.get("revenueRange")),
      top_revenue_channels: payload.topRevenueChannels,
      payment_tools: payload.paymentTools,
      average_monthly_expenses: safeNumber(formData.get("averageMonthlyExpenses")),
      biggest_cost_category: payload.biggestCostCategory,
      active_subscription_count: safeNumber(formData.get("activeSubscriptionCount")),
      tools_used: payload.toolsUsed,
      payroll_spend: safeNumber(formData.get("payrollSpend")),
      advertising_spend: safeNumber(formData.get("advertisingSpend")),
      cloud_spend: safeNumber(formData.get("cloudSpend")),
      agent_focus: payload.agentFocus,
      alert_sensitivity: payload.alertSensitivity,
      weekly_digest_enabled: payload.weeklyDigestEnabled,
      agent_autonomy_level: payload.agentAutonomyLevel,
      onboarding_completed_at: new Date().toISOString(),
      onboarding_data: {
        revenue_range_label: payload.revenueRange,
        expense_range_label: payload.averageMonthlyExpenses,
        subscription_count_range: payload.activeSubscriptionCount,
        payroll_range: payload.payrollSpend,
        advertising_range: payload.advertisingSpend,
        cloud_range: payload.cloudSpend,
        revenue_models: payload.revenueModels,
      },
    }, { onConflict: "company_id" });

  if (settingsError) {
    console.error("[submitOnboarding] Settings upsert failed:", settingsError.message);
    // Non-fatal: settings are optional for core functionality, but log it
  }

  // 4e. Set cookies
  const cookieStore = await cookies();
  cookieStore.set("fa_has_company", "true", {
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
  });
  cookieStore.set("active_company_id", companyId, {
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
  });

  // 4f. Redirect to dashboard
  redirect("/dashboard");
}
