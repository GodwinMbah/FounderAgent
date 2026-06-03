"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { updateAgentTaskStatus } from "@/lib/db/agent-tasks";
import { createAgentRecommendation } from "@/lib/db/agent-recommendations";
import { getSubscriptions } from "@/lib/db/subscriptions";
import { getCompanyById, requireAuthCompany } from "@/lib/db/company";
import { formatCurrency } from "@/lib/utils/formatters";

export async function runAgentTask(taskId: string): Promise<void> {
  const { companyId: authCompanyId } = await requireAuthCompany();

  const adminClient = createAdminClient();
  if (!adminClient) throw new Error("Admin client not available");

  // 1. Read task record
  const { data: task, error: taskError } = await adminClient
    .from("agent_tasks")
    .select("*")
    .eq("id", taskId)
    .single();

  if (taskError || !task)
    throw new Error(`Task not found: ${taskError?.message}`);

  const companyId = task.company_id as string;
  const taskType = task.task_type as string;

  if (companyId !== authCompanyId) {
    throw new Error("Forbidden: task does not belong to your company");
  }

  const company = await getCompanyById(companyId);
  const currency = company?.currency ?? "GBP";
  const money = (amount: number) => formatCurrency(amount, 2, currency);

  // 2. Update to running
  await updateAgentTaskStatus(taskId, companyId, "running");

  try {
    let resultSummary = "";
    const recommendations: Array<{
      title: string;
      description: string;
      category: string;
      potentialSavings?: number;
      impactScore: number;
      effortScore: number;
    }> = [];

    // 3. Query relevant data and generate findings
    switch (taskType) {
      case "review_renewals": {
        const subs = await getSubscriptions(companyId);
        const now = new Date();
        const in30Days = new Date();
        in30Days.setDate(now.getDate() + 30);

        const upcoming = subs.filter((s) => {
          if (s.status !== "active") return false;
          const d = new Date(s.nextBillingDate);
          return d >= now && d <= in30Days;
        });

        const total = upcoming.reduce((sum, s) => sum + s.amount, 0);
        resultSummary = `${upcoming.length} subscriptions renew in the next 30 days. Total: ${money(total)}.`;

        for (const sub of upcoming) {
          recommendations.push({
            title: `Upcoming renewal: ${sub.name}`,
            description: `${sub.vendor ?? sub.name} renews on ${typeof sub.nextBillingDate === "string" ? sub.nextBillingDate : sub.nextBillingDate.toISOString().slice(0, 10)} for ${money(sub.amount)}/${sub.billingCycle}.`,
            category: "subscription",
            potentialSavings: sub.amount,
            impactScore: 50,
            effortScore: 20,
          });
        }
        break;
      }

      case "find_cheaper_alternatives": {
        const subs = await getSubscriptions(companyId);
        const flagged = subs.filter(
          (s) => s.isFlagged && s.status === "active"
        );

        resultSummary = `Analysed ${flagged.length} flagged subscriptions for alternative options.`;

        for (const sub of flagged) {
          const annual =
            sub.billingCycle === "monthly"
              ? sub.amount * 12
              : sub.billingCycle === "quarterly"
                ? sub.amount * 4
                : sub.amount;
          recommendations.push({
            title: `Find alternative to ${sub.name}`,
            description: `${sub.name} (${money(sub.amount)}/${sub.billingCycle}) is flagged: ${sub.flagReason ?? "Review for cheaper alternatives"}. Potential annual savings up to ${formatCurrency(annual * 0.4, 0, currency)}.`,
            category: "cost_saving",
            potentialSavings: Math.round(annual * 0.4),
            impactScore: 75,
            effortScore: 50,
          });
        }
        break;
      }

      case "detect_duplicate_subscriptions": {
        const subs = await getSubscriptions(companyId);
        const active = subs.filter((s) => s.status === "active");
        const duplicates: Array<[typeof active[0], typeof active[0]]> = [];

        for (let i = 0; i < active.length; i++) {
          for (let j = i + 1; j < active.length; j++) {
            const a = active[i];
            const b = active[j];
            const aName = a.name.toLowerCase();
            const bName = b.name.toLowerCase();
            const aVendor = (a.vendor ?? a.name).toLowerCase();
            const bVendor = (b.vendor ?? b.name).toLowerCase();

            if (
              aName === bName ||
              aVendor === bVendor ||
              aName.includes(bVendor) ||
              bName.includes(aVendor)
            ) {
              duplicates.push([a, b]);
            }
          }
        }

        resultSummary = `Found ${duplicates.length} potential duplicate subscription pairs.`;

        for (const [a, b] of duplicates) {
          recommendations.push({
            title: `Possible duplicate: ${a.name} & ${b.name}`,
            description: `Both ${a.name} (${money(a.amount)}) and ${b.name} (${money(b.amount)}) may serve the same purpose.`,
            category: "efficiency",
            potentialSavings: Math.round((a.amount + b.amount) * 0.5),
            impactScore: 65,
            effortScore: 40,
          });
        }
        break;
      }

      case "flag_wasteful_spending": {
        const subs = await getSubscriptions(companyId);
        const avg =
          subs.length > 0
            ? subs.reduce((s, sub) => s + sub.amount, 0) /
              subs.length
            : 0;
        const wasteful = subs.filter(
          (s) => s.status === "active" && s.amount > avg * 3
        );

        resultSummary = `Identified ${wasteful.length} subscriptions with costs significantly above average (${money(avg)}).`;

        for (const sub of wasteful) {
          recommendations.push({
            title: `High-cost subscription: ${sub.name}`,
            description: `${sub.name} costs ${money(sub.amount)}/${sub.billingCycle}, which is ${Math.round(sub.amount / avg)}x the average subscription cost.`,
            category: "cost_saving",
            potentialSavings: Math.round(sub.amount * 0.3),
            impactScore: 80,
            effortScore: 30,
          });
        }
        break;
      }

      default:
        resultSummary = `Task type "${taskType}" is not yet implemented.`;
    }

    // 4. Update task status
    await updateAgentTaskStatus(taskId, companyId, "completed", resultSummary);

    // 5. Create recommendations
    for (const rec of recommendations) {
      await createAgentRecommendation({
        companyId,
        taskId,
        ...rec,
      });
    }

    // 6. Log activity
    await adminClient.from("agent_activity_logs").insert({
      company_id: companyId,
      task_id: taskId,
      action: "task_completed",
      resource_type: "agent_task",
      resource_id: taskId,
      output_data: {
        result_summary: resultSummary,
        recommendations_created: recommendations.length,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    await updateAgentTaskStatus(taskId, companyId, "failed", message);

    await adminClient.from("agent_activity_logs").insert({
      company_id: companyId,
      task_id: taskId,
      action: "task_failed",
      resource_type: "agent_task",
      resource_id: taskId,
      output_data: { error: message },
    });

    throw err;
  }
}
