import { config } from "dotenv";

config({ path: ".env.local" });
config();

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

export function getRequiredSupabaseScriptConfig(): {
  url: string;
  secretKey: string;
} {
  const url = clean(process.env.NEXT_PUBLIC_SUPABASE_URL, ["your-project"]);
  const secretKey = clean(
    process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY,
    ["your-secret-key", "your-service-role-key"]
  );

  if (!url || !secretKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY");
  }

  if (isLegacyJwtKey(secretKey)) {
    throw new Error("SUPABASE_SECRET_KEY must use the current sb_secret_ key format; legacy JWT service-role keys are disabled.");
  }

  process.env.NEXT_PUBLIC_SUPABASE_URL = url;
  process.env.SUPABASE_SECRET_KEY = secretKey;
  process.env.SUPABASE_SERVICE_ROLE_KEY = secretKey;

  return { url, secretKey };
}
