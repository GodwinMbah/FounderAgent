/**
 * Environment variable validation
 * Returns nulls gracefully so the app works without Supabase credentials
 */

export function getSupabaseUrl(): string | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url || url.includes("your-project")) return null;
  return url;
}

export function getSupabaseAnonKey(): string | null {
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!key || key.includes("your-anon-key")) return null;
  return key;
}

export function getSupabaseServiceRoleKey(): string | null {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key || key.includes("your-service-role-key")) return null;
  return key;
}

export function isSupabaseConfigured(): boolean {
  return !!getSupabaseUrl() && !!getSupabaseAnonKey();
}

export function isSupabaseAdminConfigured(): boolean {
  return isSupabaseConfigured() && !!getSupabaseServiceRoleKey();
}
