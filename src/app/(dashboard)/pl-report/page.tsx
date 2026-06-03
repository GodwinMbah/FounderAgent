import { getMonthlyMetrics, getTransactions, requireAuthCompany } from "@/lib/db";
import { getGlobalDateRange } from "@/lib/date-range-server";
import PLReportClient from "./PLReportClient";

interface Props {
  searchParams?: Promise<{ preset?: string; from?: string; to?: string }>;
}

export default async function PLReportPage({ searchParams }: Props) {
  const { companyId } = await requireAuthCompany();

  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const { preset, from, to } = await getGlobalDateRange(resolvedSearchParams);

  const [monthlyMetrics, transactions] = await Promise.all([
    getMonthlyMetrics(companyId, from, to),
    getTransactions(companyId, { startDate: from, endDate: to }),
  ]);

  return (
    <PLReportClient
      monthlyMetrics={monthlyMetrics}
      transactions={transactions}
      initialPreset={preset}
      initialFrom={from}
      initialTo={to}
    />
  );
}
