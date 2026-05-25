import { getBudgets, getBudgetStats, getTransactions, requireAuthCompany } from "@/lib/db";
import BudgetsClient from "./BudgetsClient";

export default async function BudgetsPage() {
  const { companyId } = await requireAuthCompany();

  // Budgets: current month transactions for accurate comparison
  const now = new Date();
  const fromDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const toDate = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);

  const transactions = await getTransactions(companyId, { startDate: fromDate, endDate: toDate });
  const [budgets, stats] = await Promise.all([
    getBudgets(companyId),
    getBudgetStats(companyId, transactions),
  ]);

  const categories = stats.categories.map((c) => ({
    name: c.category,
    budget: c.amount,
    actual: c.spent,
    variance: c.spent - c.amount,
    status: c.spent > c.amount ? "over" : "under",
  }));

  const alerts = [];
  for (const c of stats.categories) {
    if (c.percentUsed > 100) {
      alerts.push({
        category: c.category,
        message: `${c.category} is over budget by ${(c.spent - c.amount).toLocaleString("en-US", { style: "currency", currency: "USD" })}`,
        severity: "warning" as const,
      });
    } else if (c.percentUsed > 80) {
      alerts.push({
        category: c.category,
        message: `${c.category} is at ${c.percentUsed.toFixed(0)}% of budget`,
        severity: "info" as const,
      });
    }
  }

  return (
    <BudgetsClient
      totalBudget={stats.totalBudget}
      spent={stats.totalSpent}
      remaining={stats.totalBudget - stats.totalSpent}
      percentUsed={stats.percentUsed}
      categories={categories}
      alerts={alerts}
    />
  );
}
