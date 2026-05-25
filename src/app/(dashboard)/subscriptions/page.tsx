import { getSubscriptions, getSubscriptionStats, requireAuthCompany } from "@/lib/db";
import SubscriptionsContent from "./content";

export default async function SubscriptionsPage() {
  const { companyId } = await requireAuthCompany();
  const subscriptions = await getSubscriptions(companyId);
  const stats = await getSubscriptionStats(companyId);

  return <SubscriptionsContent subscriptions={subscriptions} stats={stats} />;
}
