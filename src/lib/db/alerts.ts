"use server";

import { createClient as createServerClient } from "@/lib/supabase/server";
import { getActiveCompanyForUser } from "./company";
import { normalizeAlertCategory } from "./alert-helpers";
import type { Alert } from "@/lib/types";
import { getActiveUploadIdsForCompany } from "./data-source";
import { hasActiveAlertSource } from "./source-filters";

function mapRow(row: Record<string, unknown>): Alert {
  return {
    id: row.id as string,
    companyId: row.company_id as string,
    title: row.title as string,
    description: row.description as string,
    severity: row.severity as import("@/lib/types").AlertSeverity,
    category: row.category as string,
    resourceType: row.resource_type as string | undefined,
    resourceId: row.resource_id as string | undefined,
    isRead: row.is_read as boolean,
    isDismissed: row.is_dismissed as boolean,
    status: (row.status as string) || undefined,
    metadata: row.metadata as Record<string, unknown> | undefined,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

export async function getAlerts(companyId?: string): Promise<Alert[]> {
  const ctx = await getActiveCompanyForUser();
  if (!ctx) throw new Error("Unauthorized");
  const effectiveCompanyId = companyId ?? ctx.companyId;
  if (effectiveCompanyId !== ctx.companyId) throw new Error("Forbidden: company mismatch");

  const supabase = await createServerClient();
  if (!supabase) throw new Error("Supabase not configured");
  const activeUploadIds = await getActiveUploadIdsForCompany(effectiveCompanyId, supabase);

  const { data, error } = await supabase
    .from("alerts")
    .select("*")
    .eq("company_id", effectiveCompanyId)
    .eq("is_dismissed", false)
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return (data ?? []).map(mapRow).filter((alert) => hasActiveAlertSource(alert, activeUploadIds));
}

export async function getAlertStats(companyId?: string) {
  const alerts = await getAlerts(companyId);
  return {
    critical: alerts.filter((a) => a.severity === "critical").length,
    warning: alerts.filter((a) => a.severity === "warning").length,
    info: alerts.filter((a) => a.severity === "info").length,
    resolved: alerts.filter((a) => a.severity === "resolved").length,
    total: alerts.length,
  };
}

/* ─── Write helpers (admin client — server-only) ─── */

import { createAdminClient } from "@/lib/supabase/admin";

export interface AlertInsert {
  companyId: string;
  title: string;
  description: string;
  severity?: import("@/lib/types").AlertSeverity;
  category?: string;
  resourceType?: string;
  resourceId?: string;
  metadata?: Record<string, unknown>;
}

export async function createAlert(data: AlertInsert): Promise<Alert> {
  const admin = createAdminClient();
  if (!admin) throw new Error("Admin client not available");

  const category = normalizeAlertCategory(data.category ?? "spending");
  const VALID_SEVERITIES = ["critical", "warning", "info", "resolved"];
  const severity = VALID_SEVERITIES.includes(data.severity ?? "") ? data.severity! : "info";

  const insertPayload = {
    company_id: data.companyId,
    title: data.title,
    description: data.description,
    severity,
    category,
    status: "open",
    resource_type: data.resourceType,
    resource_id: data.resourceId,
    metadata: data.metadata ?? {},
  };

  let { data: row, error } = await admin
    .from("alerts")
    .insert(insertPayload)
    .select("*")
    .single();

  // Retry with fallback category on enum violation
  if (error && !row) {
    const msg = error.message?.toLowerCase?.() ?? "";
    if (msg.includes("enum") || msg.includes("check constraint") || msg.includes("invalid input value")) {
      console.warn(`[createAlert] Enum violation for category "${category}", retrying with "spending"`);
      const fallback = { ...insertPayload, category: "spending" };
      const retry = await admin.from("alerts").insert(fallback).select("*").single();
      row = retry.data;
      error = retry.error;
    }
  }

  if (error || !row) throw new Error(`Failed to create alert: ${error?.message}`);
  return mapRow(row as Record<string, unknown>);
}

export async function createAlertsBatch(
  items: AlertInsert[]
): Promise<{ count: number; error?: string }> {
  if (items.length === 0) return { count: 0 };

  const admin = createAdminClient();
  if (!admin) throw new Error("Admin client not available");

  const payloads = items.map((data) => ({
    company_id: data.companyId,
    title: data.title,
    description: data.description,
    severity: (data.severity ?? "info") as string,
    category: normalizeAlertCategory(data.category ?? "spending"),
    status: "open",
    resource_type: data.resourceType,
    resource_id: data.resourceId,
    metadata: data.metadata ?? {},
  }));

  const { error } = await admin.from("alerts").insert(payloads);

  if (error) {
    return { count: 0, error: error.message };
  }

  return { count: payloads.length };
}
