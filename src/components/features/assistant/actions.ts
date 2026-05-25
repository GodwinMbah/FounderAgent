"use server";

import { requireAuthCompany } from "@/lib/db/company";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { detectIntent } from "@/lib/ai/intent";
import { fetchContextForIntent } from "@/lib/ai/data";
import { createTaskFromChat } from "@/lib/ai/tasks";
import { getLLM } from "@/lib/ai/llm";

export interface AssistantResult {
  response: string;
  taskCreated?: boolean;
  taskId?: string;
}

async function logAssistantInteraction(
  companyId: string,
  userId: string,
  message: string
) {
  const supabase = await createServerClient();
  if (!supabase) return;
  await supabase.from("agent_activity_logs").insert({
    company_id: companyId,
    action: "assistant_interaction",
    resource_type: "chat",
    resource_id: message,
    metadata: { user_id: userId },
  });
}

export async function processAssistantMessage(
  message: string
): Promise<AssistantResult> {
  const ctx = await requireAuthCompany();
  const companyId = ctx.companyId;

  const intent = detectIntent(message);
  const data = await fetchContextForIntent(intent, companyId);

  const llm = getLLM(intent, data, message);
  const response = await llm.generate(message);

  let taskCreated = false;
  let taskId: string | undefined;

  if (intent === "agent_task_request") {
    const taskResult = await createTaskFromChat(companyId, message);
    if (taskResult) {
      taskCreated = true;
      taskId = taskResult.taskId;
    }
  }

  await logAssistantInteraction(companyId, ctx.userId, message);

  return { response, taskCreated, taskId };
}
