"use server";

import { createClient as createServerClient } from "@/lib/supabase/server";
import { userHasCompany } from "@/lib/db/company";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

export async function signInAndRedirect(formData: FormData) {
  const supabase = await createServerClient();
  if (!supabase) return { error: "Supabase not configured" };

  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (error) return { error: error.message };

  revalidatePath("/", "layout");

  const hasCompany = await userHasCompany();
  if (hasCompany) {
    const cookieStore = await cookies();
    cookieStore.set("fa_has_company", "true", {
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
    });
    redirect("/dashboard");
  } else {
    redirect("/onboarding");
  }
}
