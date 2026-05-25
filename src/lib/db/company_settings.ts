"use server";

import { createClient as createServerClient } from "@/lib/supabase/server";
import { getActiveCompanyForUser } from "./company";

export interface CompanySettings {
  id: string;
  companyId: string;
  industry?: string;
  businessStage?: string;
  country?: string;
  currency?: string;
  fiscalYearStart?: string;
  timezone?: string;
  primaryGoal?: string;
  revenueModel?: string;
  monthlyRecurringRevenue?: number;
  oneTimeRevenue?: number;
  averageMonthlyRevenue?: number;
  topRevenueChannels: string[];
  paymentTools: string[];
  averageMonthlyExpenses?: number;
  biggestCostCategory?: string;
  activeSubscriptionCount?: number;
  toolsUsed: string[];
  payrollSpend?: number;
  advertisingSpend?: number;
  cloudSpend?: number;
  agentFocus: string[];
  alertSensitivity?: string;
  weeklyDigestEnabled: boolean;
  agentAutonomyLevel?: string;
  createdAt: string;
  updatedAt?: string;
}

function mapRow(row: Record<string, unknown>): CompanySettings {
  return {
    id: row.id as string,
    companyId: row.company_id as string,
    industry: row.industry as string | undefined,
    businessStage: row.business_stage as string | undefined,
    country: row.country as string | undefined,
    currency: row.currency as string | undefined,
    fiscalYearStart: row.fiscal_year_start as string | undefined,
    timezone: row.timezone as string | undefined,
    primaryGoal: row.primary_goal as string | undefined,
    revenueModel: row.revenue_model as string | undefined,
    monthlyRecurringRevenue: row.monthly_recurring_revenue ? Number(row.monthly_recurring_revenue) : undefined,
    oneTimeRevenue: row.one_time_revenue ? Number(row.one_time_revenue) : undefined,
    averageMonthlyRevenue: row.average_monthly_revenue ? Number(row.average_monthly_revenue) : undefined,
    topRevenueChannels: (row.top_revenue_channels as string[] | null) ?? [],
    paymentTools: (row.payment_tools as string[] | null) ?? [],
    averageMonthlyExpenses: row.average_monthly_expenses ? Number(row.average_monthly_expenses) : undefined,
    biggestCostCategory: row.biggest_cost_category as string | undefined,
    activeSubscriptionCount: row.active_subscription_count ? Number(row.active_subscription_count) : undefined,
    toolsUsed: (row.tools_used as string[] | null) ?? [],
    payrollSpend: row.payroll_spend ? Number(row.payroll_spend) : undefined,
    advertisingSpend: row.advertising_spend ? Number(row.advertising_spend) : undefined,
    cloudSpend: row.cloud_spend ? Number(row.cloud_spend) : undefined,
    agentFocus: (row.agent_focus as string[] | null) ?? [],
    alertSensitivity: row.alert_sensitivity as string | undefined,
    weeklyDigestEnabled: (row.weekly_digest_enabled as boolean) ?? true,
    agentAutonomyLevel: row.agent_autonomy_level as string | undefined,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string | undefined,
  };
}

export async function getCompanySettings(companyId: string): Promise<CompanySettings | null> {
  const ctx = await getActiveCompanyForUser();
  if (!ctx) throw new Error("Unauthorized");
  if (companyId !== ctx.companyId) throw new Error("Forbidden: company mismatch");

  const supabase = await createServerClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("company_settings")
    .select("*")
    .eq("company_id", companyId)
    .maybeSingle();

  if (error) {
    console.error("[getCompanySettings] Query failed:", error.message);
    return null;
  }

  return data ? mapRow(data as Record<string, unknown>) : null;
}

export async function createCompanySettings(
  companyId: string,
  settings: Partial<Omit<CompanySettings, "id" | "companyId" | "createdAt" | "updatedAt">>
): Promise<CompanySettings | null> {
  const ctx = await getActiveCompanyForUser();
  if (!ctx) throw new Error("Unauthorized");
  if (companyId !== ctx.companyId) throw new Error("Forbidden: company mismatch");

  const supabase = await createServerClient();
  if (!supabase) return null;

  const { data: row, error } = await supabase
    .from("company_settings")
    .insert({
      company_id: companyId,
      industry: settings.industry,
      business_stage: settings.businessStage,
      country: settings.country,
      currency: settings.currency,
      fiscal_year_start: settings.fiscalYearStart,
      timezone: settings.timezone,
      primary_goal: settings.primaryGoal,
      revenue_model: settings.revenueModel,
      monthly_recurring_revenue: settings.monthlyRecurringRevenue,
      one_time_revenue: settings.oneTimeRevenue,
      average_monthly_revenue: settings.averageMonthlyRevenue,
      top_revenue_channels: settings.topRevenueChannels,
      payment_tools: settings.paymentTools,
      average_monthly_expenses: settings.averageMonthlyExpenses,
      biggest_cost_category: settings.biggestCostCategory,
      active_subscription_count: settings.activeSubscriptionCount,
      tools_used: settings.toolsUsed,
      payroll_spend: settings.payrollSpend,
      advertising_spend: settings.advertisingSpend,
      cloud_spend: settings.cloudSpend,
      agent_focus: settings.agentFocus,
      alert_sensitivity: settings.alertSensitivity,
      weekly_digest_enabled: settings.weeklyDigestEnabled ?? true,
      agent_autonomy_level: settings.agentAutonomyLevel,
    })
    .select("*")
    .single();

  if (error) {
    console.error("[createCompanySettings] Failed:", error.message);
    return null;
  }

  return mapRow(row as Record<string, unknown>);
}

export async function updateCompanySettings(
  companyId: string,
  settings: Partial<Omit<CompanySettings, "id" | "companyId" | "createdAt" | "updatedAt">>
): Promise<CompanySettings | null> {
  const ctx = await getActiveCompanyForUser();
  if (!ctx) throw new Error("Unauthorized");
  if (companyId !== ctx.companyId) throw new Error("Forbidden: company mismatch");

  const supabase = await createServerClient();
  if (!supabase) return null;

  const { data: row, error } = await supabase
    .from("company_settings")
    .update({
      industry: settings.industry,
      business_stage: settings.businessStage,
      country: settings.country,
      currency: settings.currency,
      fiscal_year_start: settings.fiscalYearStart,
      timezone: settings.timezone,
      primary_goal: settings.primaryGoal,
      revenue_model: settings.revenueModel,
      monthly_recurring_revenue: settings.monthlyRecurringRevenue,
      one_time_revenue: settings.oneTimeRevenue,
      average_monthly_revenue: settings.averageMonthlyRevenue,
      top_revenue_channels: settings.topRevenueChannels,
      payment_tools: settings.paymentTools,
      average_monthly_expenses: settings.averageMonthlyExpenses,
      biggest_cost_category: settings.biggestCostCategory,
      active_subscription_count: settings.activeSubscriptionCount,
      tools_used: settings.toolsUsed,
      payroll_spend: settings.payrollSpend,
      advertising_spend: settings.advertisingSpend,
      cloud_spend: settings.cloudSpend,
      agent_focus: settings.agentFocus,
      alert_sensitivity: settings.alertSensitivity,
      weekly_digest_enabled: settings.weeklyDigestEnabled,
      agent_autonomy_level: settings.agentAutonomyLevel,
    })
    .eq("company_id", companyId)
    .select("*")
    .single();

  if (error) {
    console.error("[updateCompanySettings] Failed:", error.message);
    return null;
  }

  return mapRow(row as Record<string, unknown>);
}
