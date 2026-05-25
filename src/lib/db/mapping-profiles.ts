"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { getActiveCompanyForUser } from "./company";

export interface MappingProfile {
  id: string;
  companyId: string;
  sourceType: string;
  profileName: string;
  columnMappings: Record<string, { header: string; index: number }>;
  dateFormat?: string;
  currency?: string;
  delimiter?: string;
  isDefault: boolean;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
}

function mapRow(row: Record<string, unknown>): MappingProfile {
  return {
    id: row.id as string,
    companyId: row.company_id as string,
    sourceType: row.source_type as string,
    profileName: row.profile_name as string,
    columnMappings: (row.column_mappings as Record<string, { header: string; index: number }>) ?? {},
    dateFormat: row.date_format as string | undefined,
    currency: row.currency as string | undefined,
    delimiter: row.delimiter as string | undefined,
    isDefault: row.is_default as boolean,
    createdBy: row.created_by as string | undefined,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

export async function getMappingProfiles(
  sourceType?: string
): Promise<MappingProfile[]> {
  const ctx = await getActiveCompanyForUser();
  if (!ctx) throw new Error("Unauthorized");

  const admin = createAdminClient();
  if (!admin) throw new Error("Admin client not available");

  let query = admin
    .from("csv_mapping_profiles")
    .select("*")
    .eq("company_id", ctx.companyId);

  if (sourceType) {
    query = query.eq("source_type", sourceType);
  }

  const { data, error } = await query.order("updated_at", { ascending: false });

  if (error) throw error;
  return (data ?? []).map(mapRow);
}

export async function getDefaultMappingProfile(
  sourceType: string
): Promise<MappingProfile | null> {
  const ctx = await getActiveCompanyForUser();
  if (!ctx) return null;

  const admin = createAdminClient();
  if (!admin) return null;

  const { data, error } = await admin
    .from("csv_mapping_profiles")
    .select("*")
    .eq("company_id", ctx.companyId)
    .eq("source_type", sourceType)
    .eq("is_default", true)
    .maybeSingle();

  if (error || !data) return null;
  return mapRow(data as Record<string, unknown>);
}

export async function saveMappingProfile(data: {
  sourceType: string;
  profileName: string;
  columnMappings: Record<string, { header: string; index: number }>;
  dateFormat?: string;
  currency?: string;
  delimiter?: string;
  isDefault?: boolean;
}): Promise<MappingProfile> {
  const ctx = await getActiveCompanyForUser();
  if (!ctx) throw new Error("Unauthorized");

  const admin = createAdminClient();
  if (!admin) throw new Error("Admin client not available");

  // If setting as default, unset other defaults for this source
  if (data.isDefault) {
    await admin
      .from("csv_mapping_profiles")
      .update({ is_default: false })
      .eq("company_id", ctx.companyId)
      .eq("source_type", data.sourceType);
  }

  const { data: row, error } = await admin
    .from("csv_mapping_profiles")
    .upsert(
      {
        company_id: ctx.companyId,
        source_type: data.sourceType,
        profile_name: data.profileName,
        column_mappings: data.columnMappings,
        date_format: data.dateFormat,
        currency: data.currency,
        delimiter: data.delimiter,
        is_default: data.isDefault ?? false,
        created_by: ctx.userId,
      },
      { onConflict: "company_id,source_type,profile_name" }
    )
    .select("*")
    .single();

  if (error || !row) throw new Error(`Failed to save mapping profile: ${error?.message}`);
  return mapRow(row as Record<string, unknown>);
}
