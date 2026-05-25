import { getTransactions, getMonthlyMetrics, requireAuthCompany } from "@/lib/db";
import ExpensesContent from "./content";

export default async function ExpensesPage() {
  const { companyId } = await requireAuthCompany();

  // Default: current year to date
  const toDate = new Date().toISOString().slice(0, 10);
  const fromDate = new Date(new Date().getFullYear(), 0, 1).toISOString().slice(0, 10);

  const [transactions, monthlyMetrics] = await Promise.all([
    getTransactions(companyId, { startDate: fromDate, endDate: toDate, limit: 500 }),
    getMonthlyMetrics(companyId, fromDate, toDate),
  ]);

  return <ExpensesContent transactions={transactions} monthlyMetrics={monthlyMetrics} />;
}
