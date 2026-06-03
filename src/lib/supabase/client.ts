"use client";

import { createBrowserClient } from "@supabase/ssr";
import { getSupabasePublishableKey, getSupabaseUrl } from "@/lib/env";

let browserClient: ReturnType<typeof createBrowserClient> | null = null;

export function createClient() {
  const url = getSupabaseUrl();
  const publishableKey = getSupabasePublishableKey();

  if (!url || !publishableKey) {
    console.warn("[Supabase] Browser client not configured");
    return null;
  }
  if (!browserClient) {
    browserClient = createBrowserClient(url, publishableKey);
  }
  return browserClient;
}
