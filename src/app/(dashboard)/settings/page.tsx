import { getUserWithProfile, getCurrentCompany } from "@/lib/auth";
import { requireAuthCompany } from "@/lib/db/company";
import { getCompanySettings } from "@/lib/db/company_settings";
import SettingsClient from "./SettingsClient";

export default async function SettingsPage() {
  await requireAuthCompany();

  const [userData, company] = await Promise.all([
    getUserWithProfile(),
    getCurrentCompany(),
  ]);

  const companyData = Array.isArray(company) ? company[0] ?? null : company;
  const companySettings = companyData?.id
    ? await getCompanySettings(companyData.id)
    : null;

  return (
    <SettingsClient
      profile={userData?.profile ?? null}
      company={companyData}
      companyId={companyData?.id ?? ""}
      companySettings={companySettings}
    />
  );
}
