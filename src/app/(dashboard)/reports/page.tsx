import { getReports, requireAuthCompany } from "@/lib/db";
import ReportsClient from "./ReportsClient";

function formatFileSize(bytes?: number): string {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function mapReportType(type: string): string {
  const map: Record<string, string> = {
    p_and_l: "P&L",
    board_summary: "Summary",
    subscription_audit: "Subscription",
    runway_analysis: "Runway",
    budget_variance: "Budget",
    cash_flow: "Cash Flow",
    balance_sheet: "Balance Sheet",
    revenue: "Revenue",
    expense: "Expense",
  };
  return map[type] || type;
}

export default async function ReportsPage() {
  const { companyId } = await requireAuthCompany();
  const reports = await getReports(companyId);

  const reportsData = reports.map((r) => ({
    id: r.id,
    name: r.name,
    type: mapReportType(r.type),
    status: r.status as "ready" | "generating",
    generatedAt: r.createdAt.slice(0, 10),
    size: formatFileSize(r.fileSize),
  }));

  return <ReportsClient reportsData={reportsData} />;
}
