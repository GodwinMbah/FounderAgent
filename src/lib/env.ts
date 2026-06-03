/**
 * Environment variable validation
 * Returns nulls gracefully so the app works without Supabase credentials
 */

function clean(value: string | undefined, placeholders: string[]): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed || placeholders.some((placeholder) => trimmed.includes(placeholder))) {
    return null;
  }
  return trimmed;
}

function isLegacyJwtKey(key: string): boolean {
  return key.startsWith("ey") && key.split(".").length === 3;
}

export function getSupabaseUrl(): string | null {
  return clean(process.env.NEXT_PUBLIC_SUPABASE_URL, ["your-project"]);
}

export function getSupabasePublishableKey(): string | null {
  return clean(
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    ["your-publishable-key", "your-anon-key"]
  );
}

export function getSupabaseSecretKey(): string | null {
  const key = clean(
    process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY,
    ["your-secret-key", "your-service-role-key"]
  );
  if (!key) return null;
  if (isLegacyJwtKey(key)) {
    return null;
  }
  return key;
}

export function isSupabaseConfigured(): boolean {
  return !!getSupabaseUrl() && !!getSupabasePublishableKey();
}

export function isSupabaseAdminConfigured(): boolean {
  return isSupabaseConfigured() && !!getSupabaseSecretKey();
}

export const getSupabaseAnonKey = getSupabasePublishableKey;
export const getSupabaseServiceRoleKey = getSupabaseSecretKey;
