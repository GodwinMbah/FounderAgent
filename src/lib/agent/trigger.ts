import { createAgentTask } from "@/lib/db/agent-tasks";
import { runAgentTask } from "./runner";

export const TASK_TYPE_CONFIG: Record<
  string,
  { title: string; description: string }
> = {
  find_cheaper_alternatives: {
    title: "Find Cheaper Alternatives",
    description:
      "Research lower-cost alternatives to current tools and subscriptions.",
  },
  detect_duplicate_subscriptions: {
    title: "Detect Duplicate Subscriptions",
    description:
      "Find overlapping or duplicate SaaS tools across your stack.",
  },
  flag_wasteful_spending: {
    title: "Flag Wasteful Spending",
    description: "Identify unnecessary or excessive expenses.",
  },
  forecast_runway: {
    title: "Forecast Runway",
    description: "Project cash runway under different scenarios.",
  },
  identify_revenue_growth: {
    title: "Identify Revenue Growth",
    description: "Find opportunities to increase revenue.",
  },
  create_cost_reduction_plan: {
    title: "Create Cost Reduction Plan",
    description: "Generate a structured cost-saving plan.",
  },
  generate_investor_summary: {
    title: "Generate Investor Summary",
    description: "Create board-ready financial summaries.",
  },
  review_renewals: {
    title: "Review Renewals",
    description: "Alert on upcoming subscription renewals.",
  },
  identify_unusual_transactions: {
    title: "Identify Unusual Transactions",
    description: "Flag anomalous spending patterns.",
  },
  suggest_renegotiations: {
    title: "Suggest Renegotiations",
    description: "Recommend vendor contracts to renegotiate.",
  },
  categorise_transactions: {
    title: "Categorise Transactions",
    description: "Auto-categorise uncategorised transactions.",
  },
  generate_report: {
    title: "Generate Report",
    description: "Generate a specific financial report.",
  },
};

export async function triggerAgentTask(
  companyId: string,
  taskType: string,
  title?: string
): Promise<{ taskId: string; started: boolean }> {
  "use server";

  const config = TASK_TYPE_CONFIG[taskType];
  if (!config) throw new Error(`Unknown task type: ${taskType}`);

  const task = await createAgentTask({
    companyId,
    title: title ?? config.title,
    taskType,
    priority: "medium",
    inputData: { triggered_by: "user", config },
  });

  let started = false;
  try {
    await runAgentTask(task.id);
    started = true;
  } catch {
    // Task created but execution failed; remains in failed status
  }

  return { taskId: task.id, started };
}
