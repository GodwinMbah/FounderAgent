#!/usr/bin/env tsx
/**
 * Test alert category enum compatibility with the live schema.
 * Usage: npx tsx scripts/test-alert-categories.ts
 */

import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import crypto from "crypto";
import { normalizeAlertCategory } from "../src/lib/db/alert-helpers";

const __dirname = dirname(fileURLToPath(import.meta.url));
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

const TEST_COMPANY_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";

async function testRawInsert(category: string) {
  const id = crypto.randomUUID();
  const { error } = await supabase.from("alerts").insert({
    id,
    company_id: TEST_COMPANY_ID,
    title: `Test alert: ${category}`,
    description: "Test description",
    severity: "info",
    category,
    is_read: false,
    is_dismissed: false,
    metadata: {},
  });

  if (error) {
    if (
      error.message.includes("invalid input value for enum") ||
      error.message.includes("check constraint")
    ) {
      console.log(`  RAW INSERT: ${category} → ❌ ENUM VIOLATION`);
    } else {
      console.log(`  RAW INSERT: ${category} → ❌ OTHER ERROR: ${error.message}`);
    }
  } else {
    console.log(`  RAW INSERT: ${category} → ✅ SUCCESS`);
    await supabase.from("alerts").delete().eq("id", id);
  }
}

async function testNormalizedInsert(category: string) {
  const normalized = normalizeAlertCategory(category);
  const id = crypto.randomUUID();
  const { error } = await supabase.from("alerts").insert({
    id,
    company_id: TEST_COMPANY_ID,
    title: `Test alert (normalized): ${category} → ${normalized}`,
    description: "Test description",
    severity: "info",
    category: normalized,
    is_read: false,
    is_dismissed: false,
    metadata: {},
  });

  if (error) {
    console.log(`  NORMALIZED: ${category} → ${normalized} → ❌ ERROR: ${error.message}`);
  } else {
    console.log(`  NORMALIZED: ${category} → ${normalized} → ✅ SUCCESS`);
    await supabase.from("alerts").delete().eq("id", id);
  }
}

async function main() {
  console.log("\n🔍 Testing alert category enum compatibility\n");

  const categories = ["spending", "currency", "anomaly", "duplicate"];

  console.log("--- Raw DB inserts ---");
  for (const cat of categories) {
    await testRawInsert(cat);
  }

  console.log("\n--- Normalized inserts ---");
  for (const cat of categories) {
    await testNormalizedInsert(cat);
  }

  console.log("\n--- Normalization mapping verification ---");
  const mappings = [
    { input: "spending", expected: "spending" },
    { input: "currency", expected: "spending" },
    { input: "foreign_currency", expected: "spending" },
    { input: "anomaly", expected: "spending" },
    { input: "unusual", expected: "spending" },
    { input: "duplicate", expected: "spending" },
    { input: "subscription", expected: "subscription" },
    { input: "revenue", expected: "revenue" },
    { input: "cash_flow", expected: "cash_flow" },
    { input: "budget", expected: "budget" },
    { input: "security", expected: "security" },
    { input: "compliance", expected: "compliance" },
    { input: "UNKNOWN_CATEGORY", expected: "spending" },
  ];

  let allPassed = true;
  for (const { input, expected } of mappings) {
    const actual = normalizeAlertCategory(input);
    const pass = actual === expected;
    if (!pass) allPassed = false;
    console.log(`  ${input} → ${actual} ${pass ? "✅" : `❌ (expected ${expected})`}`);
  }

  console.log("\n" + (allPassed ? "✅ All normalization mappings correct" : "❌ Some mappings failed"));
  process.exit(allPassed ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
