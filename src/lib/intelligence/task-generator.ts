/**
 * Generates actionable agent tasks from upload recommendations and findings
 */

import type { UploadRecommendation } from "./recommendation-engine";
import type { DetectedSubscription } from "./subscription-detector";

export interface GeneratedTask {
  taskType: string;
  title: string;
  description: string;
  priority: "low" | "medium" | "high" | "urgent";
  estimatedSaving?: number;
  inputData: Record<string, unknown>;
}

export function generateTasksFromRecommendations(
  recommendations: UploadRecommendation[]
): GeneratedTask[] {
  const tasks: GeneratedTask[] = [];
  const seenTitles = new Set<string>();

  for (const rec of recommendations) {
    // Skip info-level recommendations for tasks (too many noise)
    if (rec.severity === "info" && rec.category !== "categorisation") continue;

    const key = `${rec.category}-${rec.title}`;
    if (seenTitles.has(key)) continue;
    seenTitles.add(key);

    const task = recommendationToTask(rec);
    if (task) tasks.push(task);
  }

  return tasks;
}

export function generateTasksFromSubscriptions(
  subscriptions: DetectedSubscription[]
): GeneratedTask[] {
  const tasks: GeneratedTask[] = [];

  if (subscriptions.length >= 3) {
    const totalSpend = subscriptions.reduce((s, sub) => s + sub.amount, 0);
    tasks.push({
      taskType: "review_renewals",
      title: "Review software subscriptions",
      description: `You have ${subscriptions.length} detected subscriptions with estimated monthly spend of £${totalSpend.toFixed(2)}. Review for duplicates and unnecessary tools.`,
      priority: "medium",
      estimatedSaving: Math.round(totalSpend * 0.2),
      inputData: { subscription_count: subscriptions.length, total_monthly_spend: totalSpend },
    });
  }

  return tasks;
}

function recommendationToTask(rec: UploadRecommendation): GeneratedTask | null {
  const priorityMap: Record<string, "low" | "medium" | "high" | "urgent"> = {
    critical: "high",
    warning: "medium",
    info: "low",
  };

  switch (rec.category) {
    case "cost_reduction":
      return {
        taskType: "create_cost_reduction_plan",
        title: rec.title,
        description: rec.description,
        priority: priorityMap[rec.severity] ?? "medium",
        estimatedSaving: rec.potentialSavings,
        inputData: { recommendation: rec },
      };

    case "duplicate_subscription":
      return {
        taskType: "detect_duplicate_subscriptions",
        title: rec.title,
        description: rec.description,
        priority: "medium",
        estimatedSaving: rec.potentialSavings,
        inputData: { recommendation: rec },
      };

    case "categorisation":
      return {
        taskType: "categorise_transactions",
        title: rec.title,
        description: rec.description,
        priority: "low",
        inputData: { recommendation: rec },
      };

    case "spending":
      return {
        taskType: "flag_wasteful_spending",
        title: rec.title,
        description: rec.description,
        priority: priorityMap[rec.severity] ?? "medium",
        estimatedSaving: rec.potentialSavings,
        inputData: { recommendation: rec },
      };

    case "cash_flow":
      return {
        taskType: "forecast_runway",
        title: rec.title,
        description: rec.description,
        priority: priorityMap[rec.severity] ?? "medium",
        inputData: { recommendation: rec },
      };

    case "subscription":
      return {
        taskType: "review_renewals",
        title: rec.title,
        description: rec.description,
        priority: "low",
        inputData: { recommendation: rec },
      };

    default:
      return {
        taskType: "generate_report",
        title: rec.title,
        description: rec.description,
        priority: priorityMap[rec.severity] ?? "low",
        inputData: { recommendation: rec },
      };
  }
}
