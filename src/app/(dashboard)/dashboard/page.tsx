import { getDashboardMetrics, getMonthlyMetrics, getSubscriptions, getAlerts, getTransactions, requireAuthCompany } from "@/lib/db";
import { getCompanySettings } from "@/lib/db/company_settings";
import { getGlobalDateRange } from "@/lib/date-range-server";
import { buildCompanyBusinessProfile } from "@/lib/business-intelligence/kpi-eligibility";
import { isExpense } from "@/lib/reporting/filters";
import { getFinancialDataSourceStatus } from "@/lib/db/data-source";
import { ConnectDataSourceState } from "@/components/features/shared/ConnectDataSourceState";
import DashboardContent from "./content";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams?: Promise<{ preset?: string; from?: string; to?: string }>;
}) {
  const { companyId } = await requireAuthCompany();
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const { preset, from, to } = await getGlobalDateRange(resolvedSearchParams);
  const dataSourceStatus = await getFinancialDataSourceStatus(companyId, { from, to });

  if (!dataSourceStatus.hasActiveDataSource) {
    return (
      <div className="space-y-8">
        <ConnectDataSourceState />
      </div>
    );
  }

  const [metrics, monthlyMetrics, subscriptions, alerts, transactions, companySettings] = await Promise.all([
    getDashboardMetrics(companyId, from, to),
    getMonthlyMetrics(companyId, from, to),
    getSubscriptions(companyId),
    getAlerts(companyId),
    getTransactions(companyId, { startDate: from, endDate: to }),
    getCompanySettings(companyId),
  ]);

  const companyProfile = buildCompanyBusinessProfile(companySettings);
  const hasSelectedTransactions = (dataSourceStatus.selectedTransactionCount ?? transactions.length) > 0;
  const scopedSubscriptions = hasSelectedTransactions ? subscriptions : [];
  const scopedAlerts = hasSelectedTransactions
    ? alerts.filter((alert) => {
        const created = alert.createdAt.slice(0, 10);
        return preset === "allTime" || (created >= from && created <= to);
      })
    : [];
  const scopedMetrics = hasSelectedTransactions
    ? metrics
      : {
          ...metrics,
          cashBalance: 0,
          monthlyRevenue: 0,
        monthlyExpenses: 0,
        netProfit: 0,
        profitMargin: 0,
        monthlyBurn: 0,
        runwayMonths: 0,
        healthScore: 0,
        activeSubscriptions: 0,
        monthlySubscriptionSpend: 0,
        flaggedSubscriptions: 0,
        potentialSavings: 0,
        totalTransactions: 0,
        uncategorizedTransactions: 0,
        arr: 0,
        grossMargin: 0,
        netNewARR: 0,
        burnMultiple: 0,
        ruleOf40: 0,
      };

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
      monthlyMetrics={monthlyMetrics}
      dataSourceStatus={dataSourceStatus}
      metrics={scopedMetrics}
      subscriptions={scopedSubscriptions}
      alerts={scopedAlerts}
      topExpenses={topExpenses}
      transactions={transactions}
      companyProfile={companyProfile}
      initialPreset={preset}
      initialFrom={from}
      initialTo={to}
    />
  );
}
