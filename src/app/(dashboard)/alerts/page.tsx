import { getAlerts, requireAuthCompany } from "@/lib/db";
import AlertsClient from "./AlertsClient";

export default async function AlertsPage() {
  const { companyId } = await requireAuthCompany();
  const alerts = await getAlerts(companyId);

  const mappedAlerts = alerts.map((a) => ({
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
