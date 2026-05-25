import { getMonthlyMetrics, getTransactions, requireAuthCompany } from "@/lib/db";
import PLReportClient from "./PLReportClient";

export default async function PLReportPage() {
  const { companyId } = await requireAuthCompany();

  // P&L: current year to date
  const toDate = new Date().toISOString().slice(0, 10);
  const fromDate = new Date(new Date().getFullYear(), 0, 1).toISOString().slice(0, 10);

  const [monthlyMetrics, transactions] = await Promise.all([
    getMonthlyMetrics(companyId, fromDate, toDate),
    getTransactions(companyId, { startDate: fromDate, endDate: toDate, limit: 500 }),
  ]);

  return (
    <PLReportClient monthlyMetrics={monthlyMetrics} transactions={transactions} />
  );
}
