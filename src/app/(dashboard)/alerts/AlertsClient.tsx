"use client";

import { useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { MetricCard } from "@/components/ui/MetricCard";
import { ChartCard } from "@/components/ui/ChartCard";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { SectionCard } from "@/components/ui/SectionCard";
import { DataTable } from "@/components/ui/DataTable";
import { AgentInsightCard } from "@/components/ui/AgentInsightCard";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import {
  ShieldAlert,
  AlertTriangle,
  Info,
  CheckCircle2,
  Bell,
  Mail,
  MessageSquare,
} from "lucide-react";

const SEVERITY_COLORS = {
  critical: "#F43F5E",
  warning: "#FBBF24",
  info: "#14B8A6",
};

interface AlertItem {
  id: string;
  title: string;
  description: string;
  severity: "critical" | "warning" | "info" | "resolved";
  category: string;
  date: string;
  status: "open" | "resolved";
}

interface Props {
  alertsData: AlertItem[];
  criticalCount: number;
  warningCount: number;
  infoCount: number;
  resolvedCount: number;
}

export default function AlertsClient({
  alertsData,
  criticalCount,
  warningCount,
  infoCount,
  resolvedCount,
}: Props) {
  const severityCounts = [
    { name: "Critical", value: criticalCount },
    { name: "Warning", value: warningCount },
    { name: "Info", value: infoCount },
  ];

  const [emailAlerts, setEmailAlerts] = useState(true);
  const [slackAlerts, setSlackAlerts] = useState(false);
  const [pushAlerts, setPushAlerts] = useState(true);

  const columns = [
    { key: "title", header: "Alert", width: "30%" },
    { key: "category", header: "Category", width: "15%" },
    {
      key: "severity",
      header: "Severity",
      width: "12%",
      render: (row: AlertItem) => (
        <StatusBadge
          variant={
            row.severity === "critical"
              ? "danger"
              : row.severity === "warning"
              ? "warning"
              : "info"
          }
        >
          {row.severity}
        </StatusBadge>
      ),
    },
    {
      key: "status",
      header: "Status",
      width: "12%",
      render: (row: AlertItem) => (
        <StatusBadge variant={row.status === "resolved" ? "success" : "neutral"}>
          {row.status}
        </StatusBadge>
      ),
    },
    { key: "date", header: "Date", width: "18%" },
    {
      key: "description",
      header: "Description",
      width: "33%",
      render: (row: AlertItem) => (
        <span className="text-xs text-[var(--muted-foreground)] line-clamp-1">{row.description}</span>
      ),
    },
  ];

  return (
    <div className="space-y-8">
      <PageHeader
        title="Alerts"
        subtitle="Monitor critical signals, warnings, and intelligence from FounderAgent."
      />

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <MetricCard
          label="Critical"
          value={String(criticalCount)}
          change="Immediate action"
          changeType="negative"
          icon={<ShieldAlert className="h-5 w-5" />}
          iconColor="#F43F5E"
        />
        <MetricCard
          label="Warnings"
          value={String(warningCount)}
          change="Review soon"
          changeType="neutral"
          icon={<AlertTriangle className="h-5 w-5" />}
          iconColor="#FBBF24"
        />
        <MetricCard
          label="Info"
          value={String(infoCount)}
          change="For awareness"
          changeType="neutral"
          icon={<Info className="h-5 w-5" />}
          iconColor="#14B8A6"
        />
        <MetricCard
          label="Resolved"
          value={String(resolvedCount)}
          change="Total resolved"
          changeType="positive"
          icon={<CheckCircle2 className="h-5 w-5" />}
          iconColor="#22C55E"
        />
      </div>

      {/* Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <ChartCard title="Alert Severity Distribution" subtitle="By severity level">
          <div className="w-full h-full min-h-0 min-w-0">
            <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 1, height: 1 }}>
              <PieChart>
                <Pie
                  data={severityCounts}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={90}
                  paddingAngle={4}
                  dataKey="value"
                  stroke="none"
                >
                  {severityCounts.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={
                        entry.name === "Critical"
                          ? SEVERITY_COLORS.critical
                          : entry.name === "Warning"
                          ? SEVERITY_COLORS.warning
                          : SEVERITY_COLORS.info
                      }
                    />
                  ))}
                </Pie>
                <Tooltip
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
          </div>
        </ChartCard>

        <ChartCard title="Alerts by Severity" subtitle="Count comparison">
          <div className="w-full h-full min-h-0 min-w-0">
            <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 1, height: 1 }}>
              <BarChart data={severityCounts} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.12)" />
                <XAxis dataKey="name" tick={{ fill: "#94A3B8", fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis
                  tick={{ fill: "#94A3B8", fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                  allowDecimals={false}
                />
                <Tooltip
                  contentStyle={{
                    background: "#111827",
                    border: "1px solid rgba(148,163,184,0.16)",
                    borderRadius: "8px",
                    fontSize: "12px",
                    color: "#f1f5f9",
                  }}
                />
                <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                  {severityCounts.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={
                        entry.name === "Critical"
                          ? SEVERITY_COLORS.critical
                          : entry.name === "Warning"
                          ? SEVERITY_COLORS.warning
                          : SEVERITY_COLORS.info
                      }
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>
      </div>

      {/* Alert Feed */}
      <SectionCard title="Alert Feed" subtitle="All alerts from FounderAgent">
        {/* Desktop Table */}
        <div className="hidden sm:block">
          <DataTable columns={columns} data={alertsData} keyExtractor={(row: AlertItem) => row.id} />
        </div>

        {/* Mobile Cards */}
        <div className="sm:hidden space-y-3">
          {alertsData.map((alert) => (
            <div key={alert.id} className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
              <div className="flex items-start gap-3">
                <div
                  className="mt-0.5 h-2 w-2 rounded-full shrink-0"
                  style={{
                    background:
                      alert.severity === "critical"
                        ? SEVERITY_COLORS.critical
                        : alert.severity === "warning"
                        ? SEVERITY_COLORS.warning
                        : SEVERITY_COLORS.info,
                  }}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium text-[var(--foreground)] truncate">{alert.title}</p>
                    <StatusBadge
                      variant={
                        alert.severity === "critical"
                          ? "danger"
                          : alert.severity === "warning"
                          ? "warning"
                          : "info"
                      }
                    >
                      {alert.severity}
                    </StatusBadge>
                  </div>
                  <p className="text-xs text-[var(--muted-foreground)] mt-0.5 line-clamp-2">{alert.description}</p>
                  <div className="flex items-center gap-2 mt-1.5">
                    <span className="text-[11px] text-[var(--muted-foreground)] bg-[var(--secondary)] px-1.5 py-0.5 rounded">{alert.category}</span>
                    <StatusBadge variant={alert.status === "resolved" ? "success" : "neutral"}>
                      {alert.status}
                    </StatusBadge>
                  </div>
                </div>
              </div>
            </div>
          ))}
          {alertsData.length === 0 && (
            <p className="text-center text-[var(--muted-foreground)] text-sm py-10">No alerts found</p>
          )}
        </div>
      </SectionCard>

      {/* Monitoring Card & Settings */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <AgentInsightCard title="FounderAgent Alert Monitoring" orbSize={56}>
          <p className="mt-2 text-sm text-[var(--muted-foreground)] leading-relaxed">
            FounderAgent continuously scans your transactions, subscriptions, and budgets for
            anomalies, cost-saving opportunities, and runway risks. New intelligence is
            surfaced here in real time.
          </p>
          <div className="mt-4 flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#22C55E] opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#22C55E]" />
            </span>
            <span className="text-xs font-semibold text-[#22C55E]">Monitoring active</span>
          </div>
        </AgentInsightCard>

        <SectionCard title="Alert Settings" subtitle="Choose how you want to be notified">
          <div className="space-y-4">
            {[
              {
                label: "Email Alerts",
                description: "Receive daily digest and critical alerts via email",
                icon: <Mail className="h-4 w-4" />,
                enabled: emailAlerts,
                onChange: setEmailAlerts,
                color: "#8B5CF6",
              },
              {
                label: "Slack Notifications",
                description: "Push alerts to your connected Slack workspace",
                icon: <MessageSquare className="h-4 w-4" />,
                enabled: slackAlerts,
                onChange: setSlackAlerts,
                color: "#14B8A6",
              },
              {
                label: "Push Notifications",
                description: "Browser push for real-time critical alerts",
                icon: <Bell className="h-4 w-4" />,
                enabled: pushAlerts,
                onChange: setPushAlerts,
                color: "#FBBF24",
              },
            ].map((setting) => (
              <div
                key={setting.label}
                className="flex items-center justify-between rounded-lg border border-[var(--border)] bg-[#09090B] px-5 py-4"
              >
                <div className="flex items-center gap-4">
                  <div
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border"
                    style={{
                      borderColor: `${setting.color}25`,
                      background: `linear-gradient(135deg, ${setting.color}12 0%, ${setting.color}04 100%)`,
                    }}
                  >
                    <span style={{ color: setting.color }}>{setting.icon}</span>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-[var(--foreground)]">{setting.label}</p>
                    <p className="text-xs text-[var(--muted-foreground)]">{setting.description}</p>
                  </div>
                </div>
                <button
                  onClick={() => setting.onChange(!setting.enabled)}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    setting.enabled ? "bg-[#14B8A6]" : "bg-[#1F2937]"
                  }`}
                  role="switch"
                  aria-checked={setting.enabled}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                      setting.enabled ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
