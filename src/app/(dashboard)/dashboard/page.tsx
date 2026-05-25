import { getDashboardMetrics, getMonthlyMetrics, getSubscriptions, getAlerts, getTransactions, requireAuthCompany } from "@/lib/db";
import DashboardContent from "./content";

export default async function DashboardPage() {
  const { companyId } = await requireAuthCompany();

  // Default date range: last 90 days for live metrics
  const toDate = new Date().toISOString().slice(0, 10);
  const fromDate = new Date();
  fromDate.setDate(fromDate.getDate() - 90);

  const [metrics, monthlyMetrics, subscriptions, alerts, transactions] = await Promise.all([
    getDashboardMetrics(companyId),
    getMonthlyMetrics(companyId, fromDate.toISOString().slice(0, 10), toDate),
    getSubscriptions(companyId),
    getAlerts(companyId),
    getTransactions(companyId, { startDate: fromDate.toISOString().slice(0, 10), endDate: toDate, limit: 500 }),
  ]);

  // Compute top expenses from transactions (date-filtered)
  const expenseMap = new Map<string, number>();
  transactions
    .filter((t) => t.type === "expense")
    .forEach((t) => {
      expenseMap.set(t.category || "Other", (expenseMap.get(t.category || "Other") || 0) + t.amount);
    });
  const topExpenses = Array.from(expenseMap.entries())
    .map(([name, amount]) => ({ name, amount }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 5);

  return (
    <DashboardContent
      metrics={metrics}
      monthlyMetrics={monthlyMetrics}
      subscriptions={subscriptions}
      alerts={alerts}
      topExpenses={topExpenses}
    />
  );
}
