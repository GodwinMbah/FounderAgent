import { getAgentTasks, getAgentTaskStats, requireAuthCompany } from "@/lib/db";
import AgentTasksContent from "./content";

export default async function AgentTasksPage() {
  const { companyId } = await requireAuthCompany();
  const [tasks, stats] = await Promise.all([
    getAgentTasks(companyId),
    getAgentTaskStats(companyId),
  ]);

  return <AgentTasksContent tasks={tasks} stats={stats} />;
}
