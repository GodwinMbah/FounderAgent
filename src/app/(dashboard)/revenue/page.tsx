import { getTransactions, getMonthlyMetrics, getSubscriptions, requireAuthCompany } from "@/lib/db";
import { getGlobalDateRange } from "@/lib/date-range-server";
import RevenueContent from "./content";

interface Props {
  searchParams?: Promise<{ preset?: string; from?: string; to?: string }>;
}

export default async function RevenuePage({ searchParams }: Props) {
  const { companyId } = await requireAuthCompany();

  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const { preset, from, to } = await getGlobalDateRange(resolvedSearchParams);

  const [transactions, monthlyMetrics, subscriptions] = await Promise.all([
    getTransactions(companyId, { startDate: from, endDate: to, limit: 500 }),
    getMonthlyMetrics(companyId, from, to),
    getSubscriptions(companyId),
  ]);

  return <RevenueContent transactions={transactions} monthlyMetrics={monthlyMetrics} subscriptions={subscriptions} initialPreset={preset} initialFrom={from} initialTo={to} />;
}
