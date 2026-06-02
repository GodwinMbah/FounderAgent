import { redirect } from "next/navigation";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { getDashboardMetrics, getMonthlyMetrics, getSubscriptions, getAlerts, getTransactions, requireAuthCompany } from "@/lib/db";
import { getCompanySettings } from "@/lib/db/company_settings";
import { getGlobalDateRange } from "@/lib/date-range-server";
import { buildCompanyBusinessProfile } from "@/lib/business-intelligence/kpi-eligibility";
import { isExpense } from "@/lib/reporting/filters";
import DashboardContent from "./content";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams?: Promise<{ preset?: string; from?: string; to?: string }>;
}) {
  const { companyId } = await requireAuthCompany();

  // NEW: Check if user has any transactions at all
  const supabase = await createServerClient();
  if (!supabase) {
    throw new Error("Supabase not configured");
  }
  const { count: transactionCount } = await supabase
    .from("transactions")
    .select("id", { count: "exact", head: true })
    .eq("company_id", companyId)
    .limit(1);

  if (!transactionCount || transactionCount === 0) {
    redirect("/upload-centre?setup=true");
  }

  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const { preset, from, to } = await getGlobalDateRange(resolvedSearchParams);

  const [metrics, monthlyMetrics, subscriptions, alerts, transactions, companySettings] = await Promise.all([
    getDashboardMetrics(companyId, from, to),
    getMonthlyMetrics(companyId, from, to),
    getSubscriptions(companyId),
    getAlerts(companyId),
    getTransactions(companyId, { startDate: from, endDate: to, limit: 500 }),
    getCompanySettings(companyId),
  ]);

  const companyProfile = buildCompanyBusinessProfile(companySettings);

  // Compute top expenses from transactions (date-filtered)
  const expenseMap = new Map<string, number>();
  transactions
    .filter((t) => isExpense(t))
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
      transactions={transactions}
      companyProfile={companyProfile}
      initialPreset={preset}
      initialFrom={from}
      initialTo={to}
    />
  );
}
