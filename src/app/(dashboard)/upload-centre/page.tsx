import { Suspense } from "react";
import { requireAuthCompany } from "@/lib/db";
import WizardClient from "./WizardClient";
import UploadHistoryList from "@/components/features/upload/UploadHistoryList";

export default async function UploadCentrePage() {
  await requireAuthCompany();
  return (
    <Suspense fallback={null}>
      <div className="space-y-8">
        <WizardClient />
        <UploadHistoryList />
      </div>
    </Suspense>
  );
}
