#!/usr/bin/env tsx
/**
 * Create Supabase Storage buckets required by FounderAgent.
 * Run: npx tsx scripts/setup-storage-bucket.ts
 *
 * Requires SUPABASE_SERVICE_ROLE_KEY in .env.local
 */

import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

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

async function ensureBucket(
  id: string,
  options: {
    public: boolean;
    fileSizeLimit: number;
    allowedMimeTypes: string[];
  }
) {
  const { data: existing } = await supabase.storage.getBucket(id);
  if (existing) {
    console.log(`✅ Bucket "${id}" already exists`);
    return;
  }

  const { error } = await supabase.storage.createBucket(id, {
    public: options.public,
    fileSizeLimit: options.fileSizeLimit,
    allowedMimeTypes: options.allowedMimeTypes,
  });

  if (error) {
    console.error(`❌ Failed to create bucket "${id}":`, error.message);
    process.exit(1);
  }

  console.log(`✅ Created bucket "${id}"`);
}

async function main() {
  console.log("🪣 Setting up Supabase Storage buckets...\n");

  await ensureBucket("financial_uploads", {
    public: false,
    fileSizeLimit: 10 * 1024 * 1024, // 10 MB
    allowedMimeTypes: [
      "text/csv",
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-excel",
    ],
  });

  await ensureBucket("generated_reports", {
    public: false,
    fileSizeLimit: 50 * 1024 * 1024, // 50 MB
    allowedMimeTypes: [
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ],
  });

  await ensureBucket("brand_assets", {
    public: true,
    fileSizeLimit: 5 * 1024 * 1024, // 5 MB
    allowedMimeTypes: ["image/png", "image/jpeg", "image/webp", "image/svg+xml"],
  });

  console.log("\n🎉 All storage buckets are ready.");
  console.log("\n📋 Next steps:");
  console.log("   1. Set Storage RLS policies in Supabase Dashboard > Storage > Policies");
  console.log("   2. Or run the policy migration if one is provided.");
}

main().catch((err) => {
  console.error("❌ Unexpected error:", err);
  process.exit(1);
});
