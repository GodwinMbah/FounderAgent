export function isCashBalanceSourceAccount(row: {
  type?: string | null;
  current_balance?: number | string | null;
  metadata?: Record<string, unknown> | null;
}): boolean {
  const metadata = row.metadata ?? {};
  const routing = metadata.kpi_routing;
  if (routing && typeof routing === "object" && "cashBalanceSource" in routing) {
    return (routing as { cashBalanceSource?: unknown }).cashBalanceSource !== false;
  }
  if (metadata.cash_balance_source === false) return false;
  if (metadata.connected_account_type === "business_credit_card" || metadata.connected_account_type === "loan") {
    return false;
  }
  return row.type !== "credit_card" && row.type !== "loan";
}
