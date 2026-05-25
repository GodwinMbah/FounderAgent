import { getMonthlyMetrics, getTransactions, requireAuthCompany } from "@/lib/db";
import CashFlowClient from "./CashFlowClient";

export default async function CashFlowPage() {
  const { companyId } = await requireAuthCompany();

  // Default: last 12 months
  const toDate = new Date().toISOString().slice(0, 10);
  const fromDate = new Date();
  fromDate.setMonth(fromDate.getMonth() - 12);

  const [monthlyMetrics, transactions] = await Promise.all([
    getMonthlyMetrics(companyId, fromDate.toISOString().slice(0, 10), toDate),
    getTransactions(companyId, { startDate: fromDate.toISOString().slice(0, 10), endDate: toDate, limit: 500 }),
  ]);

  return (
    <CashFlowClient
      monthlyMetrics={monthlyMetrics}
      transactions={transactions}
    />
  );
}
