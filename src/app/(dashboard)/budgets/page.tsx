import { getBudgets, getBudgetStats, getTransactions, requireAuthCompany, getCompanyById } from "@/lib/db";
import { getGlobalDateRange } from "@/lib/date-range-server";
import { formatCurrency } from "@/lib/utils/formatters";
import BudgetsClient from "./BudgetsClient";

interface Props {
  searchParams?: Promise<{ preset?: string; from?: string; to?: string }>;
}

export default async function BudgetsPage({ searchParams }: Props) {
  const { companyId } = await requireAuthCompany();
  const company = await getCompanyById(companyId);

  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const { preset, from, to } = await getGlobalDateRange(resolvedSearchParams);

  const transactions = await getTransactions(companyId, { startDate: from, endDate: to });
  const [, stats] = await Promise.all([
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
        message: `${c.category} is over budget by ${formatCurrency(c.spent - c.amount, 0, company?.currency || "USD")}`,
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
      initialPreset={preset}
      initialFrom={from}
      initialTo={to}
    />
  );
}
