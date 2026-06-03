#!/usr/bin/env tsx
/**
 * Create a Supabase Auth test user and link to the demo company
 * Usage: npx tsx scripts/create-test-user.ts
 *
 * Requires SUPABASE_SECRET_KEY to be set in .env.local
 */

import { createClient } from "@supabase/supabase-js";
import { getRequiredSupabaseScriptConfig } from "./supabase-env";

const { url: SUPABASE_URL, secretKey } = getRequiredSupabaseScriptConfig();
const supabase = createClient(SUPABASE_URL, secretKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const TEST_EMAIL = "demo@acmelabs.com";
const TEST_PASSWORD = "Demo1234!";
const TEST_NAME = "Alex Founder";
const DEMO_COMPANY_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";

async function main() {
  console.log("🧪 Creating test user...\n");

  // 1. Create auth user
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email: TEST_EMAIL,
    password: TEST_PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: TEST_NAME },
  });

  if (authError) {
    console.error("❌ Failed to create auth user:", authError.message);
    process.exit(1);
  }

  const userId = authData.user.id;
  console.log("✅ Auth user created");
  console.log(`   UUID: ${userId}`);
  console.log(`   Email: ${TEST_EMAIL}`);
  console.log(`   Password: ${TEST_PASSWORD}`);
  console.log("");

  // 2. Create profile
  const { error: profileError } = await supabase
    .from("profiles")
    .insert({ id: userId, email: TEST_EMAIL, full_name: TEST_NAME })
    .single();

  if (profileError) {
    console.warn("⚠️  Profile insert warning (may already exist):", profileError.message);
  } else {
    console.log("✅ Profile created");
  }

  // 3. Link to demo company
  const { error: memberError } = await supabase
    .from("company_members")
    .insert({ company_id: DEMO_COMPANY_ID, user_id: userId, role: "owner", is_active: true })
    .single();

  if (memberError) {
    console.warn("⚠️  Company member insert warning (may already exist):", memberError.message);
  } else {
    console.log("✅ Linked to demo company (Acme Labs)");
  }

  console.log("\n📋 Test User Summary");
  console.log("=====================");
  console.log(`User ID:    ${userId}`);
  console.log(`Email:      ${TEST_EMAIL}`);
  console.log(`Password:   ${TEST_PASSWORD}`);
  console.log(`Company:    ${DEMO_COMPANY_ID}`);
  console.log("\n🚀 You can now log in at /login with these credentials.");
  console.log("\n--- SQL equivalent (if you prefer manual setup) ---");
  console.log(`-- After creating the auth user, run:`);
  console.log(`INSERT INTO profiles (id, email, full_name)`);
  console.log(`VALUES ('${userId}', '${TEST_EMAIL}', '${TEST_NAME}')`);
  console.log(`ON CONFLICT (id) DO NOTHING;`);
  console.log("");
  console.log(`INSERT INTO company_members (company_id, user_id, role, is_active)`);
  console.log(`VALUES ('${DEMO_COMPANY_ID}', '${userId}', 'owner', true)`);
  console.log(`ON CONFLICT (company_id, user_id) DO NOTHING;`);
}

main().catch((err) => {
  console.error("❌ Unexpected error:", err);
  process.exit(1);
});
