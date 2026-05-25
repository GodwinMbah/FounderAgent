export type IntentType =
  | "cash_flow_query"
  | "subscription_query"
  | "budget_query"
  | "transaction_query"
  | "runway_query"
  | "revenue_query"
  | "agent_task_request"
  | "general_help"
  | "greeting";

export function detectIntent(message: string): IntentType {
  const lower = message.toLowerCase();

  if (/\b(hello|hi|hey|howdy)\b/.test(lower)) {
    return "greeting";
  }

  if (
    lower.includes("find cheaper") ||
    lower.includes("review renewals") ||
    lower.includes("detect duplicates") ||
    lower.includes("forecast runway") ||
    lower.includes("flag wasteful") ||
    lower.includes("identify revenue") ||
    lower.includes("cost reduction") ||
    lower.includes("investor summary") ||
    lower.includes("unusual transactions") ||
    lower.includes("suggest renegotiations") ||
    lower.includes("categorise transactions") ||
    lower.includes("generate report")
  ) {
    return "agent_task_request";
  }

  if (/\b(cash|burn|balance)\b/.test(lower)) {
    return "cash_flow_query";
  }

  if (/\b(runway)\b/.test(lower)) {
    return "runway_query";
  }

  if (/\b(subscription|saas|software cost)\b/.test(lower)) {
    return "subscription_query";
  }

  if (/\b(budget|overspend|over budget)\b/.test(lower)) {
    return "budget_query";
  }

  if (/\b(transaction|expense|spend|spending)\b/.test(lower)) {
    return "transaction_query";
  }

  if (/\b(revenue|income|mrr|arr)\b/.test(lower)) {
    return "revenue_query";
  }

  return "general_help";
}
