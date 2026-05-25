"use server";

import { createClient as createServerClient } from "@/lib/supabase/server";
import { getActiveCompanyForUser } from "./company";
import type { Report } from "@/lib/types";

function mapRow(row: Record<string, unknown>): Report {
  return {
    id: row.id as string,
    companyId: row.company_id as string,
    name: row.name as string,
    type: row.type as string,
    status: row.status as string,
    filePath: row.file_path as string | undefined,
    fileSize: row.file_size as number | undefined,
    periodStart: row.period_start as string | undefined,
    periodEnd: row.period_end as string | undefined,
    metadata: row.metadata as Record<string, unknown> | undefined,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

export async function getReports(companyId?: string): Promise<Report[]> {
  const ctx = await getActiveCompanyForUser();
  if (!ctx) throw new Error("Unauthorized");
  const effectiveCompanyId = companyId ?? ctx.companyId;
  if (effectiveCompanyId !== ctx.companyId) throw new Error("Forbidden: company mismatch");

  const supabase = await createServerClient();
  if (!supabase) throw new Error("Supabase not configured");

  const { data, error } = await supabase
    .from("reports")
    .select("*")
    .eq("company_id", effectiveCompanyId)
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return (data ?? []).map(mapRow);
}

export async function getReportStats(companyId?: string) {
  const reports = await getReports(companyId);
  return {
    total: reports.length,
    ready: reports.filter((r) => r.status === "ready").length,
    generating: reports.filter((r) => r.status === "generating").length,
    draft: reports.filter((r) => r.status === "draft").length,
  };
}
