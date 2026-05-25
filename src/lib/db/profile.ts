"use server";

import { createClient as createServerClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types";

function mapRow(row: Record<string, unknown>): Profile {
  return {
    id: row.id as string,
    email: row.email as string,
    fullName: row.full_name as string | undefined,
    avatarUrl: row.avatar_url as string | undefined,
    phone: row.phone as string | undefined,
    timezone: (row.timezone as string) ?? "UTC",
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string | undefined,
  };
}

export async function getProfile(userId: string): Promise<Profile | null> {
  const supabase = await createServerClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    console.error("[getProfile] Query failed:", error.message);
    return null;
  }

  return data ? mapRow(data as Record<string, unknown>) : null;
}

export async function upsertProfile(data: {
  id: string;
  email: string;
  fullName?: string;
  avatarUrl?: string;
  phone?: string;
  timezone?: string;
}): Promise<Profile | null> {
  const supabase = await createServerClient();
  if (!supabase) return null;

  const { data: row, error } = await supabase
    .from("profiles")
    .upsert({
      id: data.id,
      email: data.email,
      full_name: data.fullName,
      avatar_url: data.avatarUrl,
      phone: data.phone,
      timezone: data.timezone ?? "UTC",
    })
    .select("*")
    .single();

  if (error) {
    console.error("[upsertProfile] Failed:", error.message);
    return null;
  }

  return mapRow(row as Record<string, unknown>);
}
