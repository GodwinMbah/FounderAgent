/**
 * Reset Demo Upload Data
 * Safe script to clear all demo company test data for repeatable QA.
 * ONLY affects the demo company (aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa).
 */

import { createClient } from "@supabase/supabase-js";
import { getRequiredSupabaseScriptConfig } from "./supabase-env";

const DEMO_COMPANY_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";

async function main() {
  const { url, secretKey } = getRequiredSupabaseScriptConfig();

  const admin = createClient(url, secretKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  console.log(`[reset-demo] Clearing data for demo company ${DEMO_COMPANY_ID}...`);

  // Delete in dependency order
  const tables = [
    "agent_activity_logs",
    "agent_tasks",
    "agent_recommendations",
    "alerts",
    "subscriptions",
    "transactions",
    "uploads",
    "upload_sessions",
  ];

  for (const table of tables) {
    const { error } = await admin.from(table).delete().eq("company_id", DEMO_COMPANY_ID);
    if (error) {
      console.error(`[reset-demo] Failed to clear ${table}:`, error.message);
    } else {
      console.log(`[reset-demo] Cleared ${table}`);
    }
  }

  // Reset company metrics cache
  const { error: metricsError } = await admin
    .from("company_metrics")
    .delete()
    .eq("company_id", DEMO_COMPANY_ID);
  if (metricsError) {
    console.error(`[reset-demo] Failed to clear company_metrics:`, metricsError.message);
  } else {
    console.log(`[reset-demo] Cleared company_metrics`);
  }

  console.log("[reset-demo] Done. Demo company data has been reset.");
}

main().catch((err) => {
  console.error("[reset-demo] Error:", err);
  process.exit(1);
});
