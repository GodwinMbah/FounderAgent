"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function signIn(formData: FormData) {
  const supabase = await createServerClient();
  if (!supabase) return { error: "Supabase not configured" };

  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: error.message };

  revalidatePath("/", "layout");
  redirect("/dashboard");
}

export async function signUp(formData: FormData) {
  const supabase = await createServerClient();
  if (!supabase) return { error: "Supabase not configured" };

  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const fullName = formData.get("name") as string;
  const companyName = formData.get("companyName") as string;

  const { data: authData, error: authError } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName } },
  });

  if (authError || !authData.user) {
    return { error: authError?.message ?? "Signup failed" };
  }

  // Create profile and company via admin client
  const admin = createAdminClient();
  if (admin) {
    // Generate collision-resistant slug
    const slugBase = companyName.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
    const slug = `${slugBase}-${Math.random().toString(36).substring(2, 6)}`;

    // Create company
    const { data: company, error: companyError } = await admin
      .from("companies")
      .insert({ name: companyName, slug })
      .select("id")
      .single();

    if (companyError || !company) {
      console.error("[signUp] Company creation failed:", companyError?.message);
    } else {
      // Upsert profile
      const { error: profileError } = await admin.from("profiles").upsert({
        id: authData.user.id,
        email,
        full_name: fullName,
      }, { onConflict: "id" });
      if (profileError) {
        console.error("[signUp] Profile upsert failed:", profileError.message);
      }

      // Upsert company membership
      const { error: memberError } = await admin.from("company_members").upsert({
        company_id: company.id,
        user_id: authData.user.id,
        role: "owner",
        is_active: true,
      }, { onConflict: "company_id, user_id" });
      if (memberError) {
        console.error("[signUp] Membership upsert failed:", memberError.message);
      }

      // Set cookies so middleware recognises the company immediately
      const cookieStore = await cookies();
      cookieStore.set("fa_has_company", "true", {
        path: "/",
        maxAge: 60 * 60 * 24 * 30,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        httpOnly: true,
      });
      cookieStore.set("active_company_id", company.id, {
        path: "/",
        maxAge: 60 * 60 * 24 * 30,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        httpOnly: true,
      });
    }
  }

  revalidatePath("/", "layout");
  redirect("/dashboard");
}

export async function signOut() {
  const supabase = await createServerClient();
  if (supabase) await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/login");
}

export async function getUser() {
  const supabase = await createServerClient();
  if (!supabase) return null;
  const { data } = await supabase.auth.getUser();
  return data.user;
}

export async function getSession() {
  const supabase = await createServerClient();
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session;
}

export async function getUserWithProfile() {
  const supabase = await createServerClient();
  if (!supabase) return null;

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  return { user, profile };
}

export async function getCurrentCompany() {
  const supabase = await createServerClient();
  if (!supabase) return null;

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: membership } = await supabase
    .from("company_members")
    .select("company_id, companies(*)")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .order("joined_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  return membership?.companies ?? null;
}

export async function userHasCompany(): Promise<boolean> {
  const supabase = await createServerClient();
  if (!supabase) return false;

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;

  const { data: membership, error } = await supabase
    .from("company_members")
    .select("id")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();

  return !error && !!membership;
}

export async function getUserCompanies() {
  const supabase = await createServerClient();
  if (!supabase) return [];

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data: memberships, error } = await supabase
    .from("company_members")
    .select("company_id, role, companies(id, name, slug, industry, currency, timezone, logo_url)")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .order("joined_at", { ascending: true });

  if (error) return [];
  return memberships ?? [];
}

export async function switchCompany(companyId: string) {
  const supabase = await createServerClient();
  if (!supabase) throw new Error("Supabase not configured");

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { data: membership, error } = await supabase
    .from("company_members")
    .select("id")
    .eq("user_id", user.id)
    .eq("company_id", companyId)
    .eq("is_active", true)
    .single();

  if (error || !membership) throw new Error("Forbidden: Not a member of this company");

  const cookieStore = await cookies();
  cookieStore.set("active_company_id", companyId, {
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
  });

  return { success: true };
}
