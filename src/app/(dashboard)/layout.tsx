import { AppShell } from "@/components/layout/AppShell";
import { ReactNode } from "react";
import { getActiveCompanyForUser } from "@/lib/db/company";
import { getCompanySettings } from "@/lib/db/company_settings";
import { getGlobalDateRange } from "@/lib/date-range-server";

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const ctx = await getActiveCompanyForUser();
  const settings = ctx ? await getCompanySettings(ctx.companyId) : null;
  const currency = settings?.currency || "GBP";
  const dateRange = await getGlobalDateRange();

  return (
    <AppShell currency={currency} initialPreset={dateRange.preset} initialFrom={dateRange.from} initialTo={dateRange.to}>
      {children}
    </AppShell>
  );
}
