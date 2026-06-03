"use server";

import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

export async function signUpAndRedirect(formData: FormData) {
  try {
    const supabase = await createServerClient();
    if (!supabase) return { error: "Supabase not configured" };

    const email = formData.get("email") as string;
    const password = formData.get("password") as string;
    const fullName = formData.get("name") as string;
    const companyName = formData.get("companyName") as string;

    console.log("[signup] fields:", { email: !!email, password: !!password, fullName: !!fullName, companyName: !!companyName });

    if (!email || !password || !fullName || !companyName) {
      return { error: "All fields are required" };
    }

    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    });

    console.log("[signup] auth result:", { hasUser: !!authData?.user, hasSession: !!authData?.session, error: authError?.message ?? "none" });

    if (authError) {
      return { error: authError.message || "Signup failed" };
    }

    if (!authData.user) {
      return { error: "Signup failed — no user returned. Please try again or contact support." };
    }

    // Create profile
    const admin = createAdminClient();
    if (admin) {
      const { error: profileError } = await admin.from("profiles").insert({
        id: authData.user.id,
        email,
        full_name: fullName,
      });
      if (profileError) {
        console.error("[signup] Profile insert failed:", profileError.message);
        // Non-fatal: user exists, profile can be created later
      }

      // Create company
      const { data: company, error: companyError } = await admin
        .from("companies")
        .insert({ name: companyName, currency: "GBP" })
        .select("id")
        .single();

      console.log("[signup] company result:", { companyId: company?.id, error: companyError?.message ?? "none" });

      if (companyError || !company) {
        console.error("[signup] Company insert failed:", companyError?.message);
        return { error: "Failed to create company. Please try again." };
      }

      // Link user to company
      const { error: memberError } = await admin.from("company_members").insert({
        company_id: company.id,
        user_id: authData.user.id,
        role: "owner",
        is_active: true,
      });

      console.log("[signup] member result:", { error: memberError?.message ?? "none" });

      if (memberError) {
        console.error("[signup] Member insert failed:", memberError.message);
        return { error: "Failed to link user to company. Please try again." };
      }
    }

    revalidatePath("/", "layout");
    redirect("/onboarding");
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error during signup";
    console.error("[signup] Unexpected error:", message);
    return { error: message };
  }
}
