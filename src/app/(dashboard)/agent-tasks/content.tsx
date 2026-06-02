"use client";

import { useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { MetricCard } from "@/components/ui/MetricCard";
import { Badge } from "@/components/ui/Badge";
import { AgentOrb } from "@/components/AgentOrb";
import { useAssistant } from "@/components/layout/AssistantContext";
import type { AgentTask } from "@/lib/types";
import {
  Bot, Clock, CheckCircle2, Loader2,
  Sparkles, Zap, TrendingDown, TrendingUp, ShieldAlert,
  FileText, Search, RefreshCw, ChevronRight
} from "lucide-react";

const TASK_TYPE_ICONS: Record<string, React.ElementType> = {
  find_cheaper_alternatives: Search,
  detect_duplicate_subscriptions: RefreshCw,
  flag_wasteful_spending: TrendingDown,
  forecast_runway: TrendingUp,
  identify_revenue_growth: TrendingUp,
  create_cost_reduction_plan: Zap,
  generate_investor_summary: FileText,
  review_renewals: Clock,
  identify_unusual_transactions: ShieldAlert,
  suggest_renegotiations: Sparkles,
  categorise_transactions: CheckCircle2,
  generate_report: FileText,
};

const TASK_TYPE_LABELS: Record<string, string> = {
  find_cheaper_alternatives: "Find Cheaper Alternatives",
  detect_duplicate_subscriptions: "Detect Duplicates",
  flag_wasteful_spending: "Flag Wasteful Spend",
  forecast_runway: "Forecast Runway",
  identify_revenue_growth: "Identify Growth",
  create_cost_reduction_plan: "Cost Reduction Plan",
  generate_investor_summary: "Investor Summary",
  review_renewals: "Review Renewals",
  identify_unusual_transactions: "Find Anomalies",
  suggest_renegotiations: "Renegotiation Tips",
  categorise_transactions: "Auto-Categorise",
  generate_report: "Generate Report",
};

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  queued: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  running: "bg-[var(--accent)]/10 text-[var(--accent)] border-[var(--accent)]/20",
  completed: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  failed: "bg-red-500/10 text-red-400 border-red-500/20",
  cancelled: "bg-[var(--muted-foreground)]/10 text-[var(--muted-foreground)] border-[var(--muted-foreground)]/20",
};

const PRIORITY_STYLES: Record<string, string> = {
  low: "text-[var(--muted-foreground)]",
  medium: "text-[var(--warning)]",
  high: "text-[var(--danger)]",
  urgent: "text-red-400 animate-pulse",
};

interface AgentTasksContentProps {
  tasks: AgentTask[];
  stats: {
    total: number;
    pending: number;
    running: number;
    completed: number;
    failed: number;
  };
}

export default function AgentTasksContent({ tasks, stats }: AgentTasksContentProps) {
  const [filter, setFilter] = useState<string>("all");
  const { setOpen } = useAssistant();

  const filteredTasks = filter === "all"
    ? tasks
    : tasks.filter((t) => t.status === filter);

  const suggestedTasks = [
    { type: "find_cheaper_alternatives", label: "Find cheaper alternatives", icon: Search },
    { type: "detect_duplicate_subscriptions", label: "Detect duplicates", icon: RefreshCw },
    { type: "forecast_runway", label: "Forecast runway", icon: TrendingUp },
    { type: "flag_wasteful_spending", label: "Flag wasteful spend", icon: TrendingDown },
    { type: "generate_investor_summary", label: "Investor summary", icon: FileText },
    { type: "review_renewals", label: "Review renewals", icon: Clock },
  ];

  return (
    <div className="space-y-8">
      <PageHeader
        title="Agent Tasks"
        subtitle="FounderAgent autonomously monitors, detects, and acts on your financial data."
        action={
          <button
            onClick={() => setOpen(true)}
            className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-[var(--highlight)] to-[#7c3aed] px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-[var(--highlight)]/20 hover:shadow-[var(--highlight)]/30 transition-all"
          >
            <Sparkles className="h-4 w-4" />
            New Task
          </button>
        }
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard label="Total Tasks" value={stats.total.toString()} icon={<Bot className="h-5 w-5" />} />
        <MetricCard label="Running" value={stats.running.toString()} icon={<Loader2 className="h-5 w-5" />} />
        <MetricCard label="Completed" value={stats.completed.toString()} icon={<CheckCircle2 className="h-5 w-5" />} />
        <MetricCard label="Pending" value={stats.pending.toString()} icon={<Clock className="h-5 w-5" />} />
      </div>

      {/* Suggested Actions */}
      <div className="rounded-2xl border border-[var(--border)] bg-gradient-to-b from-[#111827] to-[#0c0c14] p-6 relative overflow-hidden">
        <div className="absolute top-0 left-4 right-4 h-px bg-gradient-to-r from-transparent via-[var(--highlight)]/30 to-transparent" />
        <div className="flex items-center gap-3 mb-4">
          <AgentOrb size={40} animated active showGlow />
          <div>
            <h3 className="text-sm font-semibold text-[var(--foreground)]">What should FounderAgent do next?</h3>
            <p className="text-xs text-[var(--muted-foreground)]">Select a task to run autonomously</p>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {suggestedTasks.map((task) => {
            const Icon = task.icon;
            return (
              <button
                key={task.type}
                className="flex items-center gap-3 rounded-xl border border-[var(--border)] bg-[#0a0a12] px-4 py-3 text-left hover:border-[var(--highlight)]/30 hover:bg-[var(--highlight)]/5 transition-all group"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--highlight)]/10 text-[var(--soft-lilac)] group-hover:bg-[var(--highlight)]/20 transition-colors">
                  <Icon className="h-4 w-4" />
                </div>
                <span className="text-xs font-medium text-[var(--foreground)]">{task.label}</span>
                <ChevronRight className="h-3.5 w-3.5 ml-auto text-[var(--muted-foreground)] opacity-0 group-hover:opacity-100 transition-opacity" />
              </button>
            );
          })}
        </div>
      </div>

      {/* Task List */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          {["all", "pending", "running", "completed", "failed"].map((s) => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium capitalize transition-colors ${
                filter === s
                  ? "bg-[var(--accent)]/10 text-[var(--accent)] border border-[var(--accent)]/20"
                  : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
              }`}
            >
              {s}
            </button>
          ))}
        </div>

        {filteredTasks.length === 0 ? (
          <div className="rounded-2xl border border-[var(--border)] bg-[#0c0c14] p-12 text-center">
            <AgentOrb size={56} animated showGlow className="mx-auto mb-4" />
            <p className="text-sm text-[var(--foreground)] font-medium">No tasks found</p>
            <p className="text-xs text-[var(--muted-foreground)] mt-1">Create a new task to get started</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredTasks.map((task) => {
              const TypeIcon = TASK_TYPE_ICONS[task.taskType] || Bot;
              const statusClass = STATUS_STYLES[task.status] || STATUS_STYLES.pending;
              const priorityClass = PRIORITY_STYLES[task.priority] || PRIORITY_STYLES.medium;

              return (
                <div
                  key={task.id}
                  className="group rounded-2xl border border-[var(--border)] bg-gradient-to-b from-[#111827] to-[#0c0c14] p-5 hover:border-[var(--highlight)]/20 transition-all"
                >
                  <div className="flex items-start gap-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--highlight)]/8 text-[var(--soft-lilac)] border border-[var(--highlight)]/15 shrink-0">
                      <TypeIcon className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="text-sm font-semibold text-[var(--foreground)] truncate">{task.title}</h4>
                        <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${statusClass}`}>
                          {task.status}
                        </span>
                        <span className={`text-[10px] font-bold uppercase tracking-wider ${priorityClass}`}>
                          {task.priority}
                        </span>
                      </div>
                      <p className="text-xs text-[var(--muted-foreground)] mb-2">
                        {TASK_TYPE_LABELS[task.taskType] || task.taskType}
                      </p>
                      {task.resultSummary && (
                        <p className="text-xs text-[var(--soft-lilac)]/80 bg-[var(--highlight)]/5 rounded-lg px-3 py-2 border border-[var(--highlight)]/10">
                          {task.resultSummary}
                        </p>
                      )}
                      {task.recommendedActions && task.recommendedActions.length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-2">
                          {task.recommendedActions.map((action, i) => (
                            <Badge key={i} variant="outline" className="text-[10px]">
                              {action}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-[11px] text-[var(--muted-foreground)]">
                        {task.createdAt ? new Date(task.createdAt).toLocaleDateString() : "—"}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
