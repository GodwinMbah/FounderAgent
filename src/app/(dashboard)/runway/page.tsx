import { getDashboardMetrics, getMonthlyMetrics, requireAuthCompany } from "@/lib/db";
import RunwayClient from "./RunwayClient";

export default async function RunwayPage() {
  const { companyId } = await requireAuthCompany();

  // Runway uses real-time cached metrics (all-time for cash/burn)
  // Chart shows last 12 months
  const toDate = new Date().toISOString().slice(0, 10);
  const fromDate = new Date();
  fromDate.setMonth(fromDate.getMonth() - 12);

  const [metrics, monthlyMetrics] = await Promise.all([
    getDashboardMetrics(companyId),
    getMonthlyMetrics(companyId, fromDate.toISOString().slice(0, 10), toDate),
  ]);

  return (
    <RunwayClient metrics={metrics} monthlyMetrics={monthlyMetrics} />
  );
}
