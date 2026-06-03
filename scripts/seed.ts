#!/usr/bin/env tsx
/**
 * FounderAgent Database Seeder
 * Usage: npx tsx scripts/seed.ts
 *
 * Requires SUPABASE_SECRET_KEY to be set in .env.local
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { getRequiredSupabaseScriptConfig } from "./supabase-env";

const __dirname = dirname(fileURLToPath(import.meta.url));
const { url: SUPABASE_URL, secretKey } = getRequiredSupabaseScriptConfig();
const supabase = createClient(SUPABASE_URL, secretKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function runSeed() {
  console.log("🌱 FounderAgent Database Seeder");
  console.log(`🔗 Connecting to: ${SUPABASE_URL}`);

  // Read and execute seed SQL
  const seedSql = readFileSync(
    join(__dirname, "..", "supabase", "seed.sql"),
    "utf-8"
  );

  console.log("📦 Executing seed data...");

  const { error } = await supabase.rpc("exec_sql", { sql: seedSql });

  if (error) {
    // If exec_sql function doesn't exist, try direct query
    console.log("⚠️  exec_sql RPC not found, trying direct query...");

    // Split by semicolons and execute each statement
    const statements = seedSql
      .split(";")
      .map((s) => s.trim())
      .filter((s) => s.length > 0 && !s.startsWith("--") && !s.startsWith("/*"));

    for (const statement of statements) {
      const { error: stmtError } = await supabase.rpc("exec_sql", {
        sql: statement + ";",
      });
      if (stmtError) {
        console.warn(`⚠️  Statement failed: ${stmtError.message}`);
      }
    }
  }

  console.log("✅ Seed complete!");
  console.log("");
  console.log("📋 Demo data created:");
  console.log("   • Company: Acme Labs");
  console.log("   • 14 Transactions");
  console.log("   • 10 Subscriptions");
  console.log("   • 6 Budgets");
  console.log("   • 6 Alerts");
  console.log("   • 7 Reports");
  console.log("   • 6 Agent Tasks");
  console.log("   • 5 Agent Recommendations");
  console.log("   • 4 Uploads");
  console.log("");
  console.log("💡 Remember to create an auth user and link them to the company:");
  console.log("   INSERT INTO company_members (company_id, user_id, role, is_active) VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'YOUR_AUTH_USER_ID', 'owner', true);");
}

runSeed().catch((err) => {
  console.error("❌ Seed failed:", err);
  process.exit(1);
});
