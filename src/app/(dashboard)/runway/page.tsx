import { getDashboardMetrics, getMonthlyMetrics, requireAuthCompany } from "@/lib/db";
import { getGlobalDateRange } from "@/lib/date-range-server";
import { getFinancialDataSourceStatus } from "@/lib/db/data-source";
import { ConnectDataSourceState } from "@/components/features/shared/ConnectDataSourceState";
import RunwayClient from "./RunwayClient";

interface Props {
  searchParams?: Promise<{ preset?: string; from?: string; to?: string }>;
}

export default async function RunwayPage({ searchParams }: Props) {
  const { companyId } = await requireAuthCompany();

  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const { preset, from, to } = await getGlobalDateRange(resolvedSearchParams);
  const dataSourceStatus = await getFinancialDataSourceStatus(companyId, { from, to });
  if (!dataSourceStatus.hasActiveDataSource) return <ConnectDataSourceState />;

  const [metrics, monthlyMetrics] = await Promise.all([
    getDashboardMetrics(companyId, from, to),
    getMonthlyMetrics(companyId, from, to),
  ]);
  const hasSelectedTransactions = (dataSourceStatus.selectedTransactionCount ?? 0) > 0;
  const scopedMetrics = hasSelectedTransactions
    ? metrics
    : {
        ...metrics,
        cashBalance: 0,
        monthlyBurn: 0,
        runwayMonths: 0,
        monthlyRevenue: 0,
        monthlyExpenses: 0,
        monthlySubscriptionSpend: 0,
      };

  return (
    <RunwayClient
      metrics={{
        cashBalance: scopedMetrics.cashBalance,
        monthlyBurn: scopedMetrics.monthlyBurn,
        runwayMonths: scopedMetrics.runwayMonths,
        monthlyRevenue: scopedMetrics.monthlyRevenue,
        monthlyExpenses: scopedMetrics.monthlyExpenses,
        monthlySubscriptionSpend: scopedMetrics.monthlySubscriptionSpend,
      }}
      monthlyMetrics={monthlyMetrics}
      initialPreset={preset}
      initialFrom={from}
      initialTo={to}
    />
  );
}
