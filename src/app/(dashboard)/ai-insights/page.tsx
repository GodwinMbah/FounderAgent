import { PageHeader } from "@/components/ui/PageHeader";
import { MetricCard } from "@/components/ui/MetricCard";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { AgentOrb } from "@/components/AgentOrb";
import { SectionCard } from "@/components/ui/SectionCard";
import { getAgentRecommendations, getAgentTasks, requireAuthCompany } from "@/lib/db";
import { getFinancialDataSourceStatus } from "@/lib/db/data-source";
import { ConnectDataSourceState } from "@/components/features/shared/ConnectDataSourceState";
import { getGlobalDateRange } from "@/lib/date-range-server";
import { Lightbulb, AlertTriangle, TrendingUp, BarChart3, FileText } from "lucide-react";

const priorityVariantMap: Record<string, "danger" | "warning" | "success" | "info"> = {
  critical: "danger",
  warning: "warning",
  opportunity: "success",
  info: "info",
};

const priorityLabelMap: Record<string, string> = {
  critical: "Critical",
  warning: "Warning",
  opportunity: "Opportunity",
  info: "Info",
};

export default async function AIInsightsPage({
  searchParams,
}: {
  searchParams?: Promise<{ preset?: string; from?: string; to?: string }>;
}) {
  const { companyId } = await requireAuthCompany();
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const { preset, from, to } = await getGlobalDateRange(resolvedSearchParams);
  const dataSourceStatus = await getFinancialDataSourceStatus(companyId, { from, to });
  if (!dataSourceStatus.hasActiveDataSource) return <ConnectDataSourceState />;

  const [recommendations, tasks] = await Promise.all([
    getAgentRecommendations(companyId),
    getAgentTasks(companyId),
  ]);

  const scopedRecommendations =
    preset === "allTime" ? recommendations : recommendations.filter((rec) => rec.createdAt.slice(0, 10) >= from && rec.createdAt.slice(0, 10) <= to);
  const scopedTasks =
    preset === "allTime" ? tasks : tasks.filter((task) => (task.createdAt ?? "").slice(0, 10) >= from && (task.createdAt ?? "").slice(0, 10) <= to);

  const insights = [
    ...scopedRecommendations.map((rec) => ({
      id: rec.id,
      title: rec.title,
      description: rec.description,
      priority: rec.category === "cost_saving" || rec.category === "growth" ? "opportunity" : rec.category === "efficiency" ? "info" : "info",
      recommendedAction: rec.status === "new" ? "Review recommendation" : undefined,
    })),
    ...scopedTasks.map((task) => ({
      id: task.id,
      title: task.title,
      description: task.resultSummary ?? `Task status: ${task.status}`,
      priority: task.priority === "high" ? "warning" : task.priority === "medium" ? "warning" : "info",
      recommendedAction: task.recommendedActions?.[0],
    })),
  ];

  const total = insights.length;
  const opportunities = insights.filter((i) => i.priority === "opportunity").length;
  const warnings = insights.filter((i) => i.priority === "warning" || i.priority === "critical").length;
  const analysis = insights.filter((i) => i.priority === "info").length;

  return (
    <div className="space-y-8">
      <PageHeader
        title="AI Insights"
        subtitle="FounderAgent continuously monitors your finances and surfaces actionable intelligence."
      />

      {/* Hero Card */}
      <div className="relative overflow-hidden rounded-2xl border border-[var(--highlight)]/10 bg-gradient-to-br from-[#0e0e1c] via-[#0a0a14] to-[#07070f] p-6 md:p-8 shadow-[inset_0_1px_1px_rgba(255,255,255,0.03)]">
        {/* Deep violet ambient glow */}
        <div
          className="absolute -right-20 -top-20 h-64 w-64 rounded-full opacity-40"
          style={{
            background: "radial-gradient(circle, rgba(139,92,246,0.2) 0%, rgba(139,92,246,0.05) 45%, transparent 70%)",
            filter: "blur(40px)",
          }}
        />
        {/* Deep teal ambient glow */}
        <div
          className="absolute -bottom-20 -left-20 h-64 w-64 rounded-full opacity-30"
          style={{
            background: "radial-gradient(circle, rgba(20,184,166,0.12) 0%, rgba(20,184,166,0.03) 45%, transparent 70%)",
            filter: "blur(40px)",
          }}
        />
        {/* Subtle inner edge glow */}
        <div className="absolute inset-0 rounded-2xl shadow-[inset_0_1px_0_rgba(139,92,246,0.06)] pointer-events-none" />
        {/* Top accent line */}
        <div className="absolute top-0 left-6 right-6 h-px bg-gradient-to-r from-transparent via-[var(--highlight)]/20 to-transparent" />
        <div className="flex flex-col items-start gap-6 md:flex-row md:items-center">
          <AgentOrb size={96} animated active />
          <div className="flex-1">
            <h2 className="text-lg font-bold text-[var(--foreground)]">FounderAgent Intelligence Layer</h2>
            <p className="mt-1.5 text-sm leading-relaxed text-[var(--muted-foreground)] max-w-2xl">
              Your AI copilot analyses transactions, detects anomalies, identifies cost-saving
              opportunities, and delivers executive-grade financial intelligence — automatically.
            </p>
          </div>
          <button className="shrink-0 rounded-lg bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-[var(--accent-foreground)] transition-colors hover:bg-[var(--accent)]/90">
            Generate Report
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Opportunities"
          value={String(opportunities)}
          icon={<TrendingUp className="h-5 w-5" />}
          iconColor="#22C55E"
        />
        <MetricCard
          label="Warnings"
          value={String(warnings)}
          icon={<AlertTriangle className="h-5 w-5" />}
          iconColor="#FBBF24"
        />
        <MetricCard
          label="Analysis"
          value={String(analysis)}
          icon={<BarChart3 className="h-5 w-5" />}
          iconColor="#38BDF8"
        />
        <MetricCard
          label="Total Insights"
          value={String(total)}
          icon={<Lightbulb className="h-5 w-5" />}
          iconColor="#8B5CF6"
        />
      </div>

      {/* Insight List */}
      <SectionCard title="Insights" subtitle={`${total} items generated by FounderAgent`}>
        <div className="space-y-4 p-5">
          {insights.map((insight) => (
            <div
              key={insight.id}
              className="rounded-lg border border-[var(--border)] p-5 transition-colors hover:bg-[var(--sidebar-accent)]/50"
            >
              <div className="flex flex-wrap items-center gap-3">
                <StatusBadge variant={priorityVariantMap[insight.priority] ?? "info"}>
                  {priorityLabelMap[insight.priority] ?? insight.priority}
                </StatusBadge>
                <h4 className="text-sm font-bold text-[var(--foreground)]">{insight.title}</h4>
              </div>
              <p className="mt-2.5 text-sm leading-relaxed text-[var(--muted-foreground)]">{insight.description}</p>
              {insight.recommendedAction && (
                <div className="mt-3 flex items-center gap-2 text-xs font-semibold text-[var(--accent)]">
                  <FileText className="h-3.5 w-3.5" />
                  <span>Recommended Action: {insight.recommendedAction}</span>
                </div>
              )}
            </div>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}
