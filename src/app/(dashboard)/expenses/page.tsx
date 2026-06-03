import { getTransactions, getMonthlyMetrics, requireAuthCompany } from "@/lib/db";
import { getGlobalDateRange } from "@/lib/date-range-server";
import { getFinancialDataSourceStatus } from "@/lib/db/data-source";
import { ConnectDataSourceState } from "@/components/features/shared/ConnectDataSourceState";
import ExpensesContent from "./content";

interface Props {
  searchParams?: Promise<{ preset?: string; from?: string; to?: string }>;
}

export default async function ExpensesPage({ searchParams }: Props) {
  const { companyId } = await requireAuthCompany();

  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const { preset, from, to } = await getGlobalDateRange(resolvedSearchParams);
  const dataSourceStatus = await getFinancialDataSourceStatus(companyId, { from, to });
  if (!dataSourceStatus.hasActiveDataSource) return <ConnectDataSourceState />;

  const [transactions, monthlyMetrics] = await Promise.all([
    getTransactions(companyId, { startDate: from, endDate: to }),
    getMonthlyMetrics(companyId, from, to),
  ]);

  return <ExpensesContent transactions={transactions} monthlyMetrics={monthlyMetrics} initialPreset={preset} initialFrom={from} initialTo={to} />;
}
