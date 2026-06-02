/**
 * Reset Demo Upload Data
 * Safe script to clear all demo company test data for repeatable QA.
 * ONLY affects the demo company (aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa).
 */

import { createClient } from "@supabase/supabase-js";

const DEMO_COMPANY_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    console.error("Missing SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_URL");
    process.exit(1);
  }

  const admin = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  console.log(`[reset-demo] Clearing data for demo company ${DEMO_COMPANY_ID}...`);

  // Delete in dependency order
  const tables = [
    { name: "agent_activity_logs", filter: (q: any) => q.eq("company_id", DEMO_COMPANY_ID) },
    { name: "agent_tasks", filter: (q: any) => q.eq("company_id", DEMO_COMPANY_ID) },
    { name: "agent_recommendations", filter: (q: any) => q.eq("company_id", DEMO_COMPANY_ID) },
    { name: "alerts", filter: (q: any) => q.eq("company_id", DEMO_COMPANY_ID) },
    { name: "subscriptions", filter: (q: any) => q.eq("company_id", DEMO_COMPANY_ID) },
    { name: "transactions", filter: (q: any) => q.eq("company_id", DEMO_COMPANY_ID) },
    { name: "uploads", filter: (q: any) => q.eq("company_id", DEMO_COMPANY_ID) },
    { name: "upload_sessions", filter: (q: any) => q.eq("company_id", DEMO_COMPANY_ID) },
  ];

  for (const table of tables) {
    const { error } = await table.filter(admin.from(table.name)).delete();
    if (error) {
      console.error(`[reset-demo] Failed to clear ${table.name}:`, error.message);
    } else {
      console.log(`[reset-demo] Cleared ${table.name}`);
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
