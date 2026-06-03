import { getMonthlyMetrics, getTransactions, requireAuthCompany } from "@/lib/db";
import { getTotalCashBalance } from "@/lib/db/bank-accounts";
import { getGlobalDateRange } from "@/lib/date-range-server";
import CashFlowClient from "./CashFlowClient";

interface Props {
  searchParams?: Promise<{ preset?: string; from?: string; to?: string }>;
}

export default async function CashFlowPage({ searchParams }: Props) {
  const { companyId } = await requireAuthCompany();

  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const { preset, from, to } = await getGlobalDateRange(resolvedSearchParams);

  const [monthlyMetrics, transactions, totalCashBalance] = await Promise.all([
    getMonthlyMetrics(companyId, from, to),
    getTransactions(companyId, { startDate: from, endDate: to }),
    getTotalCashBalance(companyId),
  ]);

  return (
    <CashFlowClient
      monthlyMetrics={monthlyMetrics}
      transactions={transactions}
      totalCashBalance={totalCashBalance}
      initialPreset={preset}
      initialFrom={from}
      initialTo={to}
    />
  );
}
