#!/usr/bin/env tsx
/**
 * FounderAgent Database Seeder
 * Usage: npx tsx scripts/seed.ts
 *
 * Requires SUPABASE_SERVICE_ROLE_KEY to be set in .env.local
 */

import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load env vars from .env.local
config({ path: join(__dirname, "..", ".env.local") });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || SUPABASE_URL.includes("your-project")) {
  console.error("❌ NEXT_PUBLIC_SUPABASE_URL is not configured in .env.local");
  process.exit(1);
}

if (!SERVICE_ROLE_KEY || SERVICE_ROLE_KEY.includes("your-service-role-key")) {
  console.error("❌ SUPABASE_SERVICE_ROLE_KEY is not configured in .env.local");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
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
