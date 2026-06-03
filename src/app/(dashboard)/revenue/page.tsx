import { getTransactions, getMonthlyMetrics, getSubscriptions, requireAuthCompany } from "@/lib/db";
import { getGlobalDateRange } from "@/lib/date-range-server";
import { getFinancialDataSourceStatus } from "@/lib/db/data-source";
import { ConnectDataSourceState } from "@/components/features/shared/ConnectDataSourceState";
import RevenueContent from "./content";

interface Props {
  searchParams?: Promise<{ preset?: string; from?: string; to?: string }>;
}

export default async function RevenuePage({ searchParams }: Props) {
  const { companyId } = await requireAuthCompany();

  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const { preset, from, to } = await getGlobalDateRange(resolvedSearchParams);
  const dataSourceStatus = await getFinancialDataSourceStatus(companyId, { from, to });
  if (!dataSourceStatus.hasActiveDataSource) return <ConnectDataSourceState />;
  const hasSelectedTransactions = (dataSourceStatus.selectedTransactionCount ?? 0) > 0;

  const [transactions, monthlyMetrics, subscriptions] = await Promise.all([
    getTransactions(companyId, { startDate: from, endDate: to }),
    getMonthlyMetrics(companyId, from, to),
    getSubscriptions(companyId),
  ]);

  return <RevenueContent transactions={transactions} monthlyMetrics={monthlyMetrics} subscriptions={hasSelectedTransactions ? subscriptions : []} initialPreset={preset} initialFrom={from} initialTo={to} />;
}
