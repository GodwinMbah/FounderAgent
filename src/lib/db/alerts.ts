"use server";

import { createClient as createServerClient } from "@/lib/supabase/server";
import { getActiveCompanyForUser } from "./company";
import type { Alert } from "@/lib/types";

function mapRow(row: Record<string, unknown>): Alert {
  return {
    id: row.id as string,
    companyId: row.company_id as string,
    title: row.title as string,
    description: row.description as string,
    severity: row.severity as string,
    category: row.category as string,
    resourceType: row.resource_type as string | undefined,
    resourceId: row.resource_id as string | undefined,
    isRead: row.is_read as boolean,
    isDismissed: row.is_dismissed as boolean,
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

  const { data, error } = await supabase
    .from("alerts")
    .select("*")
    .eq("company_id", effectiveCompanyId)
    .eq("is_dismissed", false)
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return (data ?? []).map(mapRow);
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
  severity?: string;
  category?: string;
  resourceType?: string;
  resourceId?: string;
  metadata?: Record<string, unknown>;
}

export async function createAlert(data: AlertInsert): Promise<Alert> {
  const admin = createAdminClient();
  if (!admin) throw new Error("Admin client not available");

  const { data: row, error } = await admin
    .from("alerts")
    .insert({
      company_id: data.companyId,
      title: data.title,
      description: data.description,
      severity: data.severity ?? "info",
      category: data.category ?? "spending",
      resource_type: data.resourceType,
      resource_id: data.resourceId,
      metadata: data.metadata ?? {},
    })
    .select("*")
    .single();

  if (error || !row) throw new Error(`Failed to create alert: ${error?.message}`);
  return mapRow(row as Record<string, unknown>);
}
