"use server";

import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getActiveCompanyForUser } from "./company";
import type { AgentRecommendation } from "@/lib/types";

function mapRow(row: Record<string, unknown>): AgentRecommendation {
  return {
    id: row.id as string,
    companyId: row.company_id as string,
    taskId: row.task_id as string | undefined,
    title: row.title as string,
    description: row.description as string,
    category: row.category as string | undefined,
    potentialSavings: row.potential_savings ? Number(row.potential_savings) : undefined,
    impactScore: row.impact_score as number | undefined,
    effortScore: row.effort_score as number | undefined,
    status: row.status as string,
    metadata: row.metadata as Record<string, unknown> | undefined,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

export async function getAgentRecommendations(companyId?: string): Promise<AgentRecommendation[]> {
  const ctx = await getActiveCompanyForUser();
  if (!ctx) throw new Error("Unauthorized");
  const effectiveCompanyId = companyId ?? ctx.companyId;
  if (effectiveCompanyId !== ctx.companyId) throw new Error("Forbidden: company mismatch");

  const supabase = await createServerClient();
  if (!supabase) throw new Error("Supabase not configured");

  const { data, error } = await supabase
    .from("agent_recommendations")
    .select("*")
    .eq("company_id", effectiveCompanyId)
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return (data ?? []).map(mapRow);
}

export async function createAgentRecommendation(data: {
  companyId: string;
  taskId?: string;
  title: string;
  description: string;
  category?: string;
  potentialSavings?: number;
  impactScore?: number;
  effortScore?: number;
  status?: string;
  metadata?: Record<string, unknown>;
}): Promise<AgentRecommendation> {
  const ctx = await getActiveCompanyForUser();
  if (!ctx) throw new Error("Unauthorized");
  if (data.companyId !== ctx.companyId) throw new Error("Forbidden: company mismatch");

  const supabase = await createServerClient();
  if (!supabase) throw new Error("Supabase not configured");

  const { data: row, error } = await supabase
    .from("agent_recommendations")
    .insert({
      company_id: data.companyId,
      task_id: data.taskId,
      title: data.title,
      description: data.description,
      category: data.category,
      potential_savings: data.potentialSavings,
      impact_score: data.impactScore,
      effort_score: data.effortScore,
      status: data.status ?? "new",
      metadata: data.metadata ?? {},
    })
    .select("*")
    .single();

  if (error) throw error;
  return mapRow(row as Record<string, unknown>);
}

export async function createAgentRecommendationsBatch(
  items: {
    companyId: string;
    taskId?: string;
    title: string;
    description: string;
    category?: string;
    potentialSavings?: number;
    impactScore?: number;
    effortScore?: number;
    status?: string;
    metadata?: Record<string, unknown>;
  }[]
): Promise<{ count: number; error?: string }> {
  if (items.length === 0) return { count: 0 };

  const admin = createAdminClient();
  if (!admin) throw new Error("Admin client not available");

  const payloads = items.map((data) => ({
    company_id: data.companyId,
    task_id: data.taskId,
    title: data.title,
    description: data.description,
    category: data.category,
    potential_savings: data.potentialSavings,
    impact_score: data.impactScore,
    effort_score: data.effortScore,
    status: data.status ?? "new",
    metadata: data.metadata ?? {},
  }));

  const { error } = await admin.from("agent_recommendations").insert(payloads);

  if (error) {
    return { count: 0, error: error.message };
  }

  return { count: payloads.length };
}

export async function getRecommendationsByCategory(
  companyId: string,
  category: string
): Promise<AgentRecommendation[]> {
  const ctx = await getActiveCompanyForUser();
  if (!ctx) throw new Error("Unauthorized");
  if (companyId !== ctx.companyId)
    throw new Error("Forbidden: company mismatch");

  const supabase = await createServerClient();
  if (!supabase) throw new Error("Supabase not configured");

  const { data, error } = await supabase
    .from("agent_recommendations")
    .select("*")
    .eq("company_id", companyId)
    .eq("category", category)
    .order("created_at", { ascending: false });

  if (error) throw error;

  return (data ?? []).map(mapRow);
}

export async function getRecommendationStats(companyId?: string) {
  const recs = await getAgentRecommendations(companyId);
  return {
    total: recs.length,
    new: recs.filter((r) => r.status === "new").length,
    accepted: recs.filter((r) => r.status === "accepted").length,
    potentialSavings: recs.reduce((s, r) => s + (r.potentialSavings ?? 0), 0),
  };
}
