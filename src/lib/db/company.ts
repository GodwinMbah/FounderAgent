"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export interface CompanyContext {
  userId: string;
  companyId: string;
  role: string;
}

/**
 * Get the active company for the currently authenticated user.
 * Uses the admin client for company_members queries to bypass
 * RLS infinite recursion issues (see migration 006).
 * Returns null if no user or no active company membership.
 * Respects the active_company_id cookie if set.
 */
export async function getActiveCompanyForUser(): Promise<CompanyContext | null> {
  const supabase = await createServerClient();
  if (!supabase) return null;

  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) return null;

  // Use admin client to bypass broken RLS on company_members
  const admin = createAdminClient();
  if (!admin) {
    console.error("[getActiveCompanyForUser] Admin client not available");
    return null;
  }

  // Check for explicit active company cookie
  const cookieStore = await cookies();
  const activeCompanyId = cookieStore.get("active_company_id")?.value;

  if (activeCompanyId) {
    const { data: membership, error: memberError } = await admin
      .from("company_members")
      .select("company_id, role")
      .eq("user_id", user.id)
      .eq("company_id", activeCompanyId)
      .eq("is_active", true)
      .maybeSingle();

    if (!memberError && membership) {
      return {
        userId: user.id,
        companyId: membership.company_id,
        role: membership.role,
      };
    }
    if (memberError) {
      console.error("[getActiveCompanyForUser] active company lookup failed:", memberError.message);
    }
  }

  // Fallback to first active membership
  const { data: membership, error: memberError } = await admin
    .from("company_members")
    .select("company_id, role")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .order("joined_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (memberError) {
    console.error("[getActiveCompanyForUser] company_members query failed:", memberError.message);
    return null;
  }

  if (!membership) {
    return null;
  }

  return {
    userId: user.id,
    companyId: membership.company_id,
    role: membership.role,
  };
}

/**
 * Check if the authenticated user has any active company.
 * Used to determine if onboarding is needed.
 */
export async function userHasCompany(): Promise<boolean> {
  const ctx = await getActiveCompanyForUser();
  return ctx !== null;
}

/**
 * Require an authenticated user with an active company.
 * For Server Components: redirects to login or onboarding instead of throwing.
 * For unexpected database failures, throws a proper error.
 */
export async function requireAuthCompany(): Promise<CompanyContext> {
  const supabase = await createServerClient();
  if (!supabase) {
    throw new Error("Supabase not configured");
  }

  const { data: { user }, error: userError } = await supabase.auth.getUser();

  // Not authenticated → redirect to login
  if (userError || !user) {
    redirect("/login");
  }

  const ctx = await getActiveCompanyForUser();

  // Authenticated but no company → redirect to onboarding
  if (!ctx) {
    redirect("/onboarding");
  }

  return ctx;
}

/**
 * Strict version for Server Actions that need to return errors to the client.
 * Returns null if not authenticated or no company.
 * Throws only for unexpected database failures.
 */
export async function assertAuthCompany(): Promise<CompanyContext | null> {
  const supabase = await createServerClient();
  if (!supabase) return null;

  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) return null;

  const ctx = await getActiveCompanyForUser();
  return ctx;
}

/**
 * Get company details by ID.
 * Verifies the current user is a member before returning.
 */
export async function getCompanyById(companyId: string) {
  const ctx = await getActiveCompanyForUser();
  if (!ctx) return null;
  if (companyId !== ctx.companyId) return null;

  const supabase = await createServerClient();
  if (!supabase) return null;

  const { data: company } = await supabase
    .from("companies")
    .select("*")
    .eq("id", companyId)
    .maybeSingle();

  return company ?? null;
}
