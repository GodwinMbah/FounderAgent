import { getAlerts, requireAuthCompany } from "@/lib/db";
import { getFinancialDataSourceStatus } from "@/lib/db/data-source";
import { ConnectDataSourceState } from "@/components/features/shared/ConnectDataSourceState";
import { getGlobalDateRange } from "@/lib/date-range-server";
import AlertsClient from "./AlertsClient";

export default async function AlertsPage({
  searchParams,
}: {
  searchParams?: Promise<{ preset?: string; from?: string; to?: string }>;
}) {
  const { companyId } = await requireAuthCompany();
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const { preset, from, to } = await getGlobalDateRange(resolvedSearchParams);
  const dataSourceStatus = await getFinancialDataSourceStatus(companyId, { from, to });
  if (!dataSourceStatus.hasActiveDataSource) return <ConnectDataSourceState />;

  const alerts = await getAlerts(companyId);
  const scopedAlerts =
    preset === "allTime" ? alerts : alerts.filter((alert) => alert.createdAt.slice(0, 10) >= from && alert.createdAt.slice(0, 10) <= to);

  const mappedAlerts = scopedAlerts.map((a) => ({
    id: a.id,
    title: a.title,
    description: a.description,
    severity: a.severity as "critical" | "warning" | "info",
    category: a.category,
    date: a.createdAt.slice(0, 10),
    status: (a.status || (a.isDismissed ? "resolved" : "open")) as "open" | "resolved",
  }));

  const criticalCount = mappedAlerts.filter((a) => a.severity === "critical").length;
  const warningCount = mappedAlerts.filter((a) => a.severity === "warning").length;
  const infoCount = mappedAlerts.filter((a) => a.severity === "info").length;
  const resolvedCount = mappedAlerts.filter((a) => a.status === "resolved").length;

  return (
    <AlertsClient
      alertsData={mappedAlerts}
      criticalCount={criticalCount}
      warningCount={warningCount}
      infoCount={infoCount}
      resolvedCount={resolvedCount}
    />
  );
}
