"use server";

import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getActiveCompanyForUser } from "./company";
import type { AgentTask } from "@/lib/types";

function mapRow(row: Record<string, unknown>): AgentTask {
  return {
    id: row.id as string,
    companyId: row.company_id as string,
    createdBy: row.created_by as string | undefined,
    title: row.title as string,
    taskType: row.task_type as string,
    status: row.status as string,
    priority: row.priority as string,
    inputData: row.input_data as Record<string, unknown> | undefined,
    resultSummary: row.result_summary as string | undefined,
    recommendedActions: row.recommended_actions as string[] | undefined,
    errorMessage: row.error_message as string | undefined,
    startedAt: row.started_at as string | undefined,
    completedAt: row.completed_at as string | undefined,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

export async function getAgentTasks(companyId?: string): Promise<AgentTask[]> {
  const ctx = await getActiveCompanyForUser();
  if (!ctx) throw new Error("Unauthorized");
  const effectiveCompanyId = companyId ?? ctx.companyId;
  if (effectiveCompanyId !== ctx.companyId) throw new Error("Forbidden: company mismatch");

  const supabase = await createServerClient();
  if (!supabase) throw new Error("Supabase not configured");

  const { data, error } = await supabase
    .from("agent_tasks")
    .select("*")
    .eq("company_id", effectiveCompanyId)
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return (data ?? []).map(mapRow);
}

export async function createAgentTask(data: {
  companyId: string;
  createdBy?: string;
  title: string;
  taskType: string;
  priority?: string;
  inputData?: Record<string, unknown>;
}): Promise<AgentTask> {
  const supabase = await createServerClient();
  if (!supabase) throw new Error("Supabase not configured");

  const { data: row, error } = await supabase
    .from("agent_tasks")
    .insert({
      company_id: data.companyId,
      created_by: data.createdBy,
      title: data.title,
      task_type: data.taskType,
      priority: data.priority ?? "medium",
      input_data: data.inputData ?? {},
    })
    .select("*")
    .single();

  if (error) throw error;
  return mapRow(row as Record<string, unknown>);
}

export async function createAgentTasksBatch(
  items: {
    companyId: string;
    createdBy?: string;
    title: string;
    taskType: string;
    priority?: string;
    inputData?: Record<string, unknown>;
  }[]
): Promise<{ count: number; error?: string }> {
  if (items.length === 0) return { count: 0 };

  const admin = createAdminClient();
  if (!admin) throw new Error("Admin client not available");

  const payloads = items.map((data) => ({
    company_id: data.companyId,
    created_by: data.createdBy,
    title: data.title,
    task_type: data.taskType,
    priority: data.priority ?? "medium",
    input_data: data.inputData ?? {},
  }));

  const { error } = await admin.from("agent_tasks").insert(payloads);

  if (error) {
    return { count: 0, error: error.message };
  }

  return { count: payloads.length };
}

export async function updateAgentTaskStatus(
  id: string,
  companyId: string,
  status: string,
  resultSummary?: string
): Promise<AgentTask> {
  const ctx = await getActiveCompanyForUser();
  if (!ctx) throw new Error("Unauthorized");
  if (companyId !== ctx.companyId) throw new Error("Forbidden: company mismatch");

  const supabase = await createServerClient();
  if (!supabase) throw new Error("Supabase not configured");

  const updates: Record<string, unknown> = { status };
  if (resultSummary !== undefined) updates.result_summary = resultSummary;
  if (status === "running") updates.started_at = new Date().toISOString();
  if (
    status === "completed" ||
    status === "failed" ||
    status === "cancelled"
  ) {
    updates.completed_at = new Date().toISOString();
  }

  const { data: row, error } = await supabase
    .from("agent_tasks")
    .update(updates)
    .eq("id", id)
    .eq("company_id", companyId)
    .select("*")
    .single();

  if (error) throw error;
  return mapRow(row as Record<string, unknown>);
}

export async function getAgentTasksByType(
  companyId: string,
  taskType: string
): Promise<AgentTask[]> {
  const ctx = await getActiveCompanyForUser();
  if (!ctx) throw new Error("Unauthorized");
  if (companyId !== ctx.companyId)
    throw new Error("Forbidden: company mismatch");

  const supabase = await createServerClient();
  if (!supabase) throw new Error("Supabase not configured");

  const { data, error } = await supabase
    .from("agent_tasks")
    .select("*")
    .eq("company_id", companyId)
    .eq("task_type", taskType)
    .order("created_at", { ascending: false });

  if (error) throw error;

  return (data ?? []).map(mapRow);
}

export async function getAgentTaskStats(companyId?: string) {
  const tasks = await getAgentTasks(companyId);
  return {
    total: tasks.length,
    pending: tasks.filter((t) => t.status === "pending").length,
    running: tasks.filter((t) => t.status === "running").length,
    completed: tasks.filter((t) => t.status === "completed").length,
    failed: tasks.filter((t) => t.status === "failed").length,
  };
}
