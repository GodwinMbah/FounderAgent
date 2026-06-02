"use client";

import { PageHeader } from "@/components/ui/PageHeader";
import { MetricCard } from "@/components/ui/MetricCard";
import { ChartCard } from "@/components/ui/ChartCard";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { SectionCard } from "@/components/ui/SectionCard";
import { AgentInsightCard } from "@/components/ui/AgentInsightCard";
import { formatCurrency, formatDate } from "@/lib/utils/formatters";
import { useCompanyCurrency } from "@/lib/hooks/useCompanyCurrency";
import type { Subscription } from "@/lib/types";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  CreditCard,
  Calendar,
  TrendingUp,
  AlertTriangle,
  Scissors,
  Lightbulb,
  BarChart3,
} from "lucide-react";

const PIE_COLORS = ["#14B8A6", "#8B5CF6", "#22C55E", "#FBBF24", "#F43F5E", "#0EA5E9", "#EC4899"];

interface SubscriptionsContentProps {
  subscriptions: Subscription[];
  stats: {
    monthlySpend: number;
    annualized: number;
    flagged: number;
    potentialSavings: number;
    count: number;
  };
}

export default function SubscriptionsContent({ subscriptions, stats }: SubscriptionsContentProps) {
  const { currency } = useCompanyCurrency();
  const categoryMap = new Map<string, number>();
  subscriptions.forEach((s) => {
    categoryMap.set(s.category || "Other", (categoryMap.get(s.category || "Other") || 0) + s.amount);
  });
  const categoryData = Array.from(categoryMap.entries()).map(([name, value]) => ({ name, value }));

  const totalCategorySpend = categoryData.reduce((s, c) => s + c.value, 0);

  const flaggedSubs = subscriptions.filter((s) => s.isFlagged);
  const upcomingRenewals = [...subscriptions]
    .sort((a, b) => new Date(a.nextBillingDate).getTime() - new Date(b.nextBillingDate).getTime())
    .slice(0, 5);

  // Dynamic insights based on real subscription data
  const insights: string[] = [];
  if (flaggedSubs.length > 0) {
    flaggedSubs.slice(0, 3).forEach((sub) => {
      insights.push(
        `Review ${sub.name} — ${sub.flagReason || "flagged for review"}. Potential savings: ${formatCurrency(
          sub.billingCycle === "yearly" ? sub.amount / 12 : sub.billingCycle === "quarterly" ? sub.amount / 3 : sub.amount, 0, currency
        )}/month`
      );
    });
  } else {
    insights.push("No flagged subscriptions. FounderAgent is monitoring for duplicates and unused tools.");
  }

  const topSub = [...subscriptions].sort((a, b) => b.amount - a.amount)[0];
  if (topSub) {
    insights.push(
      `${topSub.name} is your largest subscription at ${formatCurrency(
        topSub.billingCycle === "yearly" ? topSub.amount / 12 : topSub.billingCycle === "quarterly" ? topSub.amount / 3 : topSub.amount, 0, currency
      )}/month`
    );
  }

  insights.push(
    `You have ${stats.count} active subscriptions with a combined monthly spend of ${formatCurrency(stats.monthlySpend, 0, currency)}.`
  );

  return (
    <div className="space-y-8">
      <PageHeader
        title="Subscriptions"
        subtitle="Track recurring software, infrastructure, and service costs."
      />

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <MetricCard
          label="Monthly Spend"
          value={formatCurrency(stats.monthlySpend, 0, currency)}
          change="—"
          changeType="neutral"
          icon={<CreditCard className="h-5 w-5" />}
          iconColor="#14B8A6"
        />
        <MetricCard
          label="Annualized"
          value={formatCurrency(stats.annualized, 0, currency)}
          change="Projected"
          changeType="neutral"
          icon={<Calendar className="h-5 w-5" />}
          iconColor="#8B5CF6"
        />
        <MetricCard
          label="Flagged"
          value={String(flaggedSubs.length)}
          change="Needs review"
          changeType="negative"
          icon={<AlertTriangle className="h-5 w-5" />}
          iconColor="#FBBF24"
        />
        <MetricCard
          label="Potential Savings"
          value={formatCurrency(stats.potentialSavings, 0, currency)}
          change="/ month"
          changeType="positive"
          icon={<Scissors className="h-5 w-5" />}
          iconColor="#22C55E"
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <ChartCard title="Subscription Spend Breakdown" subtitle="By category">
          <div className="h-full flex flex-col">
            {/* Donut */}
            <div className="h-[170px] w-full shrink-0 relative">
              <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 1, height: 1 }}>
                <PieChart>
                  <Pie
                    data={categoryData}
                    cx="50%"
                    cy="50%"
                    innerRadius={56}
                    outerRadius={76}
                    paddingAngle={4}
                    dataKey="value"
                    stroke="none"
                  >
                    {categoryData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value) => value !== undefined ? formatCurrency(Number(value), 0, currency) : ""}
                    contentStyle={{
                      background: "#111827",
                      border: "1px solid rgba(148,163,184,0.16)",
                      borderRadius: "8px",
                      fontSize: "12px",
                      color: "#f1f5f9",
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
              {/* Center label */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="text-center">
                  <p className="text-base font-bold text-[var(--foreground)]">{formatCurrency(totalCategorySpend, 0, currency)}</p>
                  <p className="text-[10px] text-[var(--muted-foreground)]">per month</p>
                </div>
              </div>
            </div>
            {/* Legend */}
            <div className="mt-3 pt-3 border-t border-[var(--border)] shrink-0">
              <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                {categoryData.map((cat, i) => (
                  <div key={cat.name} className="flex items-center gap-2 min-w-0">
                    <div className="h-2 w-2 rounded-full shrink-0" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                    <span className="text-xs text-[var(--muted-foreground)] truncate">{cat.name}</span>
                    <span className="text-xs font-medium text-[var(--foreground)] shrink-0 ml-auto">
                      {Math.round((cat.value / totalCategorySpend) * 100)}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </ChartCard>

        <ChartCard title="Monthly Trend" subtitle="Subscription spend over time">
          <div className="w-full h-full min-h-0 min-w-0 flex items-center justify-center">
            <div className="text-center space-y-3">
              <BarChart3 className="h-10 w-10 text-[var(--muted-foreground)] mx-auto" />
              <p className="text-sm text-[var(--muted-foreground)]">
                Historical subscription spend trend will appear here once multiple billing cycles are recorded.
              </p>
              <p className="text-xs text-[var(--muted-foreground)]">
                Current monthly spend: {formatCurrency(stats.monthlySpend, 0, currency)}
              </p>
            </div>
          </div>
        </ChartCard>
      </div>

      {/* All Subscriptions */}
      <SectionCard title="All Subscriptions" subtitle={`${subscriptions.length} active recurring costs`}>
        <div className="space-y-3">
          {subscriptions.map((sub) => (
            <div
              key={sub.id}
              className="flex items-center justify-between rounded-lg border border-[var(--border)] bg-[#09090B] px-5 py-4"
            >
              <div className="flex items-center gap-4 min-w-0">
                <div
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border"
                  style={{
                    borderColor: "rgba(20,184,166,0.2)",
                    background: "linear-gradient(135deg, rgba(20,184,166,0.12) 0%, rgba(20,184,166,0.04) 100%)",
                  }}
                >
                  <CreditCard className="h-4 w-4 text-[var(--accent)]" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-[var(--foreground)] truncate">{sub.name}</p>
                  <p className="text-xs text-[var(--muted-foreground)]">
                    {sub.vendor} · {sub.billingCycle}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-4 shrink-0 ml-4">
                <div className="text-right hidden sm:block">
                  <p className="text-sm font-bold text-[var(--foreground)]">{formatCurrency(sub.amount, 0, currency)}</p>
                  <p className="text-xs text-[var(--muted-foreground)]">Next: {formatDate(sub.nextBillingDate)}</p>
                </div>
                <StatusBadge variant={sub.isFlagged ? "warning" : "success"}>
                  {sub.isFlagged ? "Flagged" : "Active"}
                </StatusBadge>
              </div>
            </div>
          ))}
        </div>
      </SectionCard>

      {/* Suggested Cuts & Upcoming Renewals */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <SectionCard title="Suggested Cuts" subtitle={`${flaggedSubs.length} flagged subscriptions`}>
          <div className="space-y-3">
            {flaggedSubs.map((sub) => (
              <div
                key={sub.id}
                className="flex items-start gap-4 rounded-lg border border-[var(--border)] bg-[#09090B] px-5 py-4"
              >
                <div
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border"
                  style={{
                    borderColor: "rgba(251,191,36,0.2)",
                    background: "linear-gradient(135deg, rgba(251,191,36,0.12) 0%, rgba(251,191,36,0.04) 100%)",
                  }}
                >
                  <Scissors className="h-4 w-4 text-[#FBBF24]" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-[var(--foreground)]">{sub.name}</p>
                    <p className="text-sm font-bold text-[var(--foreground)]">{formatCurrency(sub.amount, 0, currency)}</p>
                  </div>
                  <p className="text-xs text-[var(--muted-foreground)] mt-0.5">{sub.flagReason}</p>
                </div>
              </div>
            ))}
            {flaggedSubs.length === 0 && (
              <p className="text-sm text-[var(--muted-foreground)] text-center py-6">No flagged subscriptions</p>
            )}
          </div>
        </SectionCard>

        <SectionCard title="Upcoming Renewals" subtitle="Next 5 billing dates">
          <div className="space-y-3">
            {upcomingRenewals.map((sub) => (
              <div
                key={sub.id}
                className="flex items-center justify-between rounded-lg border border-[var(--border)] bg-[#09090B] px-5 py-4"
              >
                <div className="flex items-center gap-4 min-w-0">
                  <div
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border"
                    style={{
                      borderColor: "rgba(139,92,246,0.2)",
                      background: "linear-gradient(135deg, rgba(139,92,246,0.12) 0%, rgba(139,92,246,0.04) 100%)",
                    }}
                  >
                    <Calendar className="h-4 w-4 text-[#8B5CF6]" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-[var(--foreground)] truncate">{sub.name}</p>
                    <p className="text-xs text-[var(--muted-foreground)]">{sub.category}</p>
                  </div>
                </div>
                <div className="text-right shrink-0 ml-4">
                  <p className="text-sm font-bold text-[var(--foreground)]">{formatCurrency(sub.amount, 0, currency)}</p>
                  <p className="text-xs text-[var(--muted-foreground)]">{formatDate(sub.nextBillingDate)}</p>
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>

      {/* Agent Card */}
      <AgentInsightCard title="FounderAgent Subscription Analysis" orbSize={56}>
        <ul className="mt-3 space-y-2">
          {insights.map((insight, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-[var(--muted-foreground)]">
              {i === 0 && flaggedSubs.length > 0 ? (
                <AlertTriangle className="h-4 w-4 text-[#F43F5E] shrink-0 mt-0.5" />
              ) : i === 0 ? (
                <Lightbulb className="h-4 w-4 text-[#FBBF24] shrink-0 mt-0.5" />
              ) : (
                <TrendingUp className="h-4 w-4 text-[var(--accent)] shrink-0 mt-0.5" />
              )}
              {insight}
            </li>
          ))}
        </ul>
      </AgentInsightCard>
    </div>
  );
}
