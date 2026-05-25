"use client";

import { PageHeader } from "@/components/ui/PageHeader";
import { MetricCard } from "@/components/ui/MetricCard";
import { ChartCard } from "@/components/ui/ChartCard";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { SectionCard } from "@/components/ui/SectionCard";
import { DataTable } from "@/components/ui/DataTable";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  FileText,
  Download,
  Clock,
  AlertCircle,
  BarChart3,
  Banknote,
  Receipt,
  Plane,
  Layers,
  FileSpreadsheet,
} from "lucide-react";

const PIE_COLORS = ["#14B8A6", "#8B5CF6", "#22C55E", "#FBBF24", "#F43F5E", "#0EA5E9", "#EC4899"];

interface ReportItem {
  id: string;
  name: string;
  type: string;
  status: "ready" | "generating";
  generatedAt: string;
  size: string;
}

interface Props {
  reportsData: ReportItem[];
}

export default function ReportsClient({ reportsData }: Props) {
  const reportsGenerated = reportsData.length;
  const readyToExport = reportsData.filter((r) => r.status === "ready").length;
  const scheduled = reportsData.filter((r) => r.status === "generating").length;
  const needsReview = 0;

  const typeDistribution = (() => {
    const map = new Map<string, number>();
    reportsData.forEach((r) => {
      map.set(r.type, (map.get(r.type) || 0) + 1);
    });
    return Array.from(map.entries()).map(([name, value]) => ({ name, value }));
  })();

  const reportTypeCards = [
    { name: "P&L", icon: <BarChart3 className="h-5 w-5" />, color: "#14B8A6", desc: "Profit & Loss" },
    { name: "Cash Flow", icon: <Banknote className="h-5 w-5" />, color: "#8B5CF6", desc: "Inflow & outflow" },
    { name: "Expense", icon: <Receipt className="h-5 w-5" />, color: "#F43F5E", desc: "Spend analysis" },
    { name: "Runway", icon: <Plane className="h-5 w-5" />, color: "#FBBF24", desc: "Forecast models" },
    { name: "Revenue", icon: <Layers className="h-5 w-5" />, color: "#22C55E", desc: "Breakdown by source" },
    { name: "Summary", icon: <FileSpreadsheet className="h-5 w-5" />, color: "#0EA5E9", desc: "Executive summary" },
  ];

  const columns = [
    { key: "name", header: "Report", width: "35%" },
    { key: "type", header: "Type", width: "15%" },
    {
      key: "status",
      header: "Status",
      width: "15%",
      render: (row: ReportItem) => (
        <StatusBadge variant={row.status === "ready" ? "success" : "warning"}>{row.status}</StatusBadge>
      ),
    },
    { key: "generatedAt", header: "Generated", width: "20%" },
    { key: "size", header: "Size", width: "15%", align: "right" as const },
  ];

  return (
    <div className="space-y-8">
      <PageHeader
        title="Reports"
        subtitle="Generate financial reports and export executive summaries."
      />

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <MetricCard
          label="Reports Generated"
          value={String(reportsGenerated)}
          change="All time"
          changeType="neutral"
          icon={<FileText className="h-5 w-5" />}
          iconColor="#14B8A6"
        />
        <MetricCard
          label="Ready to Export"
          value={String(readyToExport)}
          change="Available now"
          changeType="positive"
          icon={<Download className="h-5 w-5" />}
          iconColor="#22C55E"
        />
        <MetricCard
          label="Scheduled"
          value={String(scheduled)}
          change="In progress"
          changeType="neutral"
          icon={<Clock className="h-5 w-5" />}
          iconColor="#8B5CF6"
        />
        <MetricCard
          label="Needs Review"
          value={String(needsReview)}
          change="Action required"
          changeType={needsReview > 0 ? "negative" : "positive"}
          icon={<AlertCircle className="h-5 w-5" />}
          iconColor={needsReview > 0 ? "#F43F5E" : "#22C55E"}
        />
      </div>

      {/* Chart */}
      <ChartCard title="Report Type Distribution" subtitle="Breakdown by report category">
        <div className="w-full h-full min-h-0 min-w-0">
          <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 1, height: 1 }}>
            <PieChart>
              <Pie
                data={typeDistribution}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={90}
                paddingAngle={4}
                dataKey="value"
                stroke="none"
              >
                {typeDistribution.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
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

      {/* Report Type Cards */}
      <SectionCard title="Report Types" subtitle="Choose a template to generate">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          {reportTypeCards.map((rt) => (
            <button
              key={rt.name}
              className="group flex flex-col items-center justify-center gap-3 rounded-xl border border-[var(--border)] bg-[#09090B] p-5 transition-all duration-300 hover:border-[var(--accent)]/15"
            >
              <div
                className="flex h-11 w-11 items-center justify-center rounded-lg border transition-all duration-300 group-hover:scale-105"
                style={{
                  borderColor: `${rt.color}25`,
                  background: `linear-gradient(135deg, ${rt.color}12 0%, ${rt.color}04 100%)`,
                  boxShadow: `0 0 12px ${rt.color}08`,
                }}
              >
                <span style={{ color: rt.color }}>{rt.icon}</span>
              </div>
              <div className="text-center">
                <p className="text-sm font-semibold text-[#F1F5F9]">{rt.name}</p>
                <p className="text-[11px] text-[#94A3B8] mt-0.5">{rt.desc}</p>
              </div>
            </button>
          ))}
        </div>
      </SectionCard>

      {/* Recent Reports Table */}
      <SectionCard title="Recent Reports" subtitle="Latest generated outputs">
        <DataTable
          columns={columns}
          data={reportsData}
          keyExtractor={(row: ReportItem) => row.id}
        />
      </SectionCard>
    </div>
  );
}
