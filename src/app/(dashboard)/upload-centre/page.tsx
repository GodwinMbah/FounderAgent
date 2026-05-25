import { requireAuthCompany } from "@/lib/db";
import WizardClient from "./WizardClient";

export default async function UploadCentrePage() {
  await requireAuthCompany();
  return <WizardClient />;
}
