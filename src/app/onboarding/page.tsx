import { redirect } from "next/navigation";
import { getUserWithProfile } from "@/lib/auth";
import { userHasCompany } from "@/lib/db/company";
import OnboardingWizard from "./content";

export default async function OnboardingPage() {
  const userData = await getUserWithProfile();

  if (!userData?.user) {
    redirect("/login");
  }

  const hasCompany = await userHasCompany();
  if (hasCompany) {
    redirect("/dashboard");
  }

  return <OnboardingWizard />;
}
