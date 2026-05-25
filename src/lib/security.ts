"use server";

import { createClient as createServerClient } from "@/lib/supabase/server";
import { getActiveCompanyForUser } from "./db/company";

/**
 * Assert that the current user has access to the given company.
 * Throws if unauthorized or company mismatch.
 */
export async function assertCompanyAccess(companyId: string) {
  const ctx = await getActiveCompanyForUser();
  if (!ctx) throw new Error("Unauthorized");
  if (companyId !== ctx.companyId) throw new Error("Forbidden: company mismatch");
}

/**
 * Assert that the current user has one of the allowed roles for the given company.
 * Throws if unauthorized, company mismatch, or role not allowed.
 */
export async function assertRole(companyId: string, allowedRoles: string[]) {
  await assertCompanyAccess(companyId);
  const ctx = await getActiveCompanyForUser();
  if (!ctx) throw new Error("Unauthorized");
  if (!allowedRoles.includes(ctx.role)) {
    throw new Error(`Forbidden: requires role in [${allowedRoles.join(", ")}]`);
  }
}

/**
 * Basic XSS prevention: escape HTML entities.
 */
export function sanitizeInput(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;")
    .replace(/\//g, "&#x2F;");
}

/**
 * Write an audit log entry to agent_activity_logs.
 * Derives company_id from the active company context.
 */
export async function auditLog(
  action: string,
  resourceType: string,
  resourceId: string
) {
  const supabase = await createServerClient();
  if (!supabase) return;

  const ctx = await getActiveCompanyForUser();
  if (!ctx) return;

  await supabase.from("agent_activity_logs").insert({
    company_id: ctx.companyId,
    action,
    resource_type: resourceType,
    resource_id: resourceId,
    metadata: { user_id: ctx.userId },
  });
}
