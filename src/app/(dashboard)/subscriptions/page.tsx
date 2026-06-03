import { getSubscriptions, getSubscriptionStats, requireAuthCompany } from "@/lib/db";
import { getFinancialDataSourceStatus } from "@/lib/db/data-source";
import { ConnectDataSourceState } from "@/components/features/shared/ConnectDataSourceState";
import SubscriptionsContent from "./content";

export default async function SubscriptionsPage() {
  const { companyId } = await requireAuthCompany();
  const dataSourceStatus = await getFinancialDataSourceStatus(companyId);
  if (!dataSourceStatus.hasActiveDataSource) return <ConnectDataSourceState />;

  const subscriptions = await getSubscriptions(companyId);
  const stats = await getSubscriptionStats(companyId);

  return <SubscriptionsContent subscriptions={subscriptions} stats={stats} />;
}
