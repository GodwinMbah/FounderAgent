import { getDashboardMetrics, getMonthlyMetrics, requireAuthCompany } from "@/lib/db";
import { getGlobalDateRange } from "@/lib/date-range-server";
import RunwayClient from "./RunwayClient";

interface Props {
  searchParams?: Promise<{ preset?: string; from?: string; to?: string }>;
}

export default async function RunwayPage({ searchParams }: Props) {
  const { companyId } = await requireAuthCompany();

  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const { preset, from, to } = await getGlobalDateRange(resolvedSearchParams);

  const [metrics, monthlyMetrics] = await Promise.all([
    getDashboardMetrics(companyId),
    getMonthlyMetrics(companyId, from, to),
  ]);

  return (
    <RunwayClient
      metrics={{
        cashBalance: metrics.cashBalance,
        monthlyBurn: metrics.monthlyBurn,
        runwayMonths: metrics.runwayMonths,
        monthlyRevenue: metrics.monthlyRevenue,
        monthlyExpenses: metrics.monthlyExpenses,
        monthlySubscriptionSpend: metrics.monthlySubscriptionSpend,
      }}
      monthlyMetrics={monthlyMetrics}
      initialPreset={preset}
      initialFrom={from}
      initialTo={to}
    />
  );
}
