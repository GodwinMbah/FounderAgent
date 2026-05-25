import { triggerAgentTask } from "@/lib/agent/trigger";

export function extractTaskType(message: string): string | null {
  const lower = message.toLowerCase();

  if (lower.includes("find cheaper") || lower.includes("cheaper alternative"))
    return "find_cheaper_alternatives";
  if (
    (lower.includes("review") || lower.includes("renewal")) &&
    lower.includes("subscription")
  )
    return "review_renewals";
  if (lower.includes("detect duplicate")) return "detect_duplicate_subscriptions";
  if (lower.includes("forecast runway")) return "forecast_runway";
  if (lower.includes("flag wasteful")) return "flag_wasteful_spending";
  if (lower.includes("identify revenue")) return "identify_revenue_growth";
  if (lower.includes("cost reduction")) return "create_cost_reduction_plan";
  if (lower.includes("investor summary")) return "generate_investor_summary";
  if (lower.includes("unusual transaction")) return "identify_unusual_transactions";
  if (lower.includes("renegotiation")) return "suggest_renegotiations";
  if (lower.includes("categorise")) return "categorise_transactions";
  if (lower.includes("generate report")) return "generate_report";

  return null;
}

export async function createTaskFromChat(
  companyId: string,
  message: string
): Promise<{ taskId: string; started: boolean } | null> {
  const taskType = extractTaskType(message);
  if (!taskType) return null;
  return triggerAgentTask(companyId, taskType);
}
