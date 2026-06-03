import { requireAuthCompany } from "@/lib/db";
import WizardClient from "./WizardClient";
import UploadHistoryList from "@/components/features/upload/UploadHistoryList";
import { getFinancialDataSourceStatus } from "@/lib/db/data-source";
import { DataCoverageBanner } from "@/components/features/shared/DataCoverageBanner";

export default async function UploadCentrePage() {
  const { companyId } = await requireAuthCompany();
  const dataSourceStatus = await getFinancialDataSourceStatus(companyId);
  return (
    <div className="space-y-8">
      <WizardClient />
      <DataCoverageBanner status={dataSourceStatus} selectedLabel="All time" />
      <UploadHistoryList />
    </div>
  );
}
