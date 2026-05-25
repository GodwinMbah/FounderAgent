"use server";

import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

export async function signUpAndRedirect(formData: FormData) {
  const supabase = await createServerClient();
  if (!supabase) return { error: "Supabase not configured" };

  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const fullName = formData.get("name") as string;

  const { data: authData, error: authError } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName } },
  });

  if (authError || !authData.user) {
    return { error: authError?.message ?? "Signup failed" };
  }

  const admin = createAdminClient();
  if (admin) {
    await admin.from("profiles").insert({
      id: authData.user.id,
      email,
      full_name: fullName,
    });
  }

  revalidatePath("/", "layout");
  redirect("/onboarding");
}
