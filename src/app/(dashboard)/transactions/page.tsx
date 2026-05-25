import { getTransactions, getTransactionStats, requireAuthCompany } from "@/lib/db";
import TransactionsContent from "./content";

export default async function TransactionsPage() {
  const { companyId } = await requireAuthCompany();

  // Default: last 6 months, limited to 500 rows
  const toDate = new Date().toISOString().slice(0, 10);
  const fromDate = new Date();
  fromDate.setMonth(fromDate.getMonth() - 6);

  const [transactions, stats] = await Promise.all([
    getTransactions(companyId, { startDate: fromDate.toISOString().slice(0, 10), endDate: toDate, limit: 500 }),
    getTransactionStats(companyId),
  ]);

  return <TransactionsContent transactions={transactions} stats={stats} />;
}
