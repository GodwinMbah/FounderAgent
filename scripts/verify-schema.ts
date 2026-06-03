#!/usr/bin/env tsx
/**
 * FounderAgent Schema Verification Script
 * Usage: npx tsx scripts/verify-schema.ts
 *
 * Verifies live Supabase schema against expected columns.
 */

import { createClient } from "@supabase/supabase-js";
import { getRequiredSupabaseScriptConfig } from "./supabase-env";

const { url: SUPABASE_URL, secretKey } = getRequiredSupabaseScriptConfig();
const supabase = createClient(SUPABASE_URL, secretKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

interface TableExpectations {
  must: string[];
  should: string[];
}

const EXPECTED_COLUMNS: Record<string, TableExpectations> = {
  transactions: {
    must: [
      "id", "company_id", "upload_id", "date", "merchant", "description",
      "category", "amount", "type", "status", "confidence_score", "metadata",
      "created_at", "updated_at", "bank_account_id", "currency", "reference",
      "external_transaction_id", "source_provider", "source_row_number",
      "raw_row_hash", "row_status", "kpi_excluded", "kpi_exclusion_reason",
      "duplicate_of_transaction_id",
    ],
    should: [
      "posted_date", "fee_amount", "running_balance",
    ],
  },
  uploads: {
    must: [
      "id", "company_id", "user_id", "file_name", "file_path", "file_size",
      "mime_type", "source", "status", "transaction_count", "error_message",
      "metadata", "uploaded_at", "processed_at", "updated_at", "total_rows",
      "processed_rows", "failed_rows", "pipeline_stage", "pipeline_progress",
      "started_at",
    ],
    should: [
      "provider_detected", "provider_confidence",
    ],
  },
  bank_accounts: {
    must: [
      "id", "company_id", "name", "currency", "current_balance",
      "metadata", "created_at", "updated_at",
    ],
    should: [
      "account_number", "sort_code",
    ],
  },
  company_metrics: {
    must: [
      "id", "company_id", "period_type", "total_revenue", "total_expenses",
      "net_profit", "cash_balance", "monthly_burn", "runway_months",
      "health_score", "active_subscription_count", "transaction_count",
      "updated_at",
    ],
    should: [
      "metadata", "created_at", "mrr", "uncategorized_count",
    ],
  },
  alerts: {
    must: [
      "id", "company_id", "title", "description", "category", "severity",
      "metadata", "created_at", "updated_at",
    ],
    should: [
      "status",
    ],
  },
  agent_tasks: {
    must: [
      "id", "company_id", "title", "task_type", "status",
      "priority", "input_data", "created_at", "updated_at",
    ],
    should: [
      "description", "due_date", "assigned_to", "result_summary",
      "recommended_actions", "error_message", "started_at", "completed_at",
    ],
  },
  agent_recommendations: {
    must: [
      "id", "company_id", "title", "description", "category", "impact_score",
      "effort_score", "status", "potential_savings", "metadata",
      "created_at", "updated_at",
    ],
    should: [],
  },
  subscriptions: {
    must: [
      "id", "company_id", "vendor", "amount", "category", "billing_cycle",
      "status", "next_billing_date", "metadata", "created_at", "updated_at",
    ],
    should: [
      "name", "start_date", "end_date", "notes", "is_flagged", "flag_reason",
    ],
  },
};

async function getActualColumns(table: string): Promise<string[] | null> {
  const { data, error } = await supabase
    .from(table)
    .select("*")
    .limit(1);

  if (error) {
    // If table is empty, data will be [] and we can still get columns
    if (error.message && error.message.includes("does not exist")) {
      console.error(`  ❌ Table '${table}' does not exist or is not accessible`);
      return null;
    }
    // Try to infer columns from empty result
    if (data && Array.isArray(data)) {
      if (data.length === 0) {
        // Empty table — we can't get columns from select('*').limit(1)
        // Fallback: try to insert a dummy row and catch the error to see expected columns
        // Or use a raw SQL query via RPC if available
        return [];
      }
    }
    console.error(`  ⚠️  Error querying ${table}: ${error.message}`);
    return null;
  }

  if (!data || data.length === 0) {
    // Empty table — try to get column info via SQL
    return [];
  }

  return Object.keys(data[0]);
}

async function getColumnsViaSql(table: string): Promise<string[] | null> {
  const { data, error } = await supabase.rpc("exec_sql", {
    sql: `
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = '${table}'
      ORDER BY ordinal_position;
    `,
  });

  if (error) {
    // exec_sql might not exist, try another approach
    return null;
  }

  if (data && Array.isArray(data)) {
    return data.map((row: Record<string, unknown>) => row.column_name as string);
  }

  return null;
}

async function verifySchema() {
  console.log("═══════════════════════════════════════════════════════════");
  console.log("  FounderAgent — Live Schema Verification");
  console.log("═══════════════════════════════════════════════════════════");
  console.log(`🔗 URL: ${SUPABASE_URL}`);
  console.log("");

  const results: {
    table: string;
    actual: string[];
    mustMissing: string[];
    shouldMissing: string[];
    shouldInMetadata: string[];
  }[] = [];

  let hasCriticalMissing = false;

  for (const [table, expectations] of Object.entries(EXPECTED_COLUMNS)) {
    console.log(`📋 Table: ${table}`);

    let actualColumns = await getActualColumns(table);

    // Fallback to SQL if table is empty
    if (actualColumns !== null && actualColumns.length === 0) {
      const sqlColumns = await getColumnsViaSql(table);
      if (sqlColumns && sqlColumns.length > 0) {
        actualColumns = sqlColumns;
      }
    }

    if (actualColumns === null) {
      console.log("   ❌ Could not determine columns");
      results.push({
        table,
        actual: [],
        mustMissing: expectations.must,
        shouldMissing: expectations.should,
        shouldInMetadata: [],
      });
      hasCriticalMissing = true;
      console.log("");
      continue;
    }

    if (actualColumns.length === 0) {
      console.log("   ⚠️  Table appears empty; could not enumerate columns without SQL access");
      // Try SQL as final fallback
      const sqlColumns = await getColumnsViaSql(table);
      if (sqlColumns && sqlColumns.length > 0) {
        actualColumns = sqlColumns;
      } else {
        console.log("   ⚠️  SQL fallback also unavailable (exec_sql RPC may not exist)");
        results.push({
          table,
          actual: [],
          mustMissing: expectations.must,
          shouldMissing: expectations.should,
          shouldInMetadata: [],
        });
        hasCriticalMissing = true;
        console.log("");
        continue;
      }
    }

    const mustMissing = expectations.must.filter((c) => !actualColumns!.includes(c));
    const shouldMissing = expectations.should.filter((c) => !actualColumns!.includes(c));
    const shouldInMetadata: string[] = [];

    for (const col of shouldMissing) {
      // Check if metadata has this info as fallback
      if (actualColumns.includes("metadata")) {
        shouldInMetadata.push(col);
      }
    }

    // Report MUST columns
    for (const col of expectations.must) {
      const exists = actualColumns.includes(col);
      console.log(`   ${exists ? "✅" : "❌"} ${col} ${exists ? "" : "(MUST — MISSING)"}`);
    }

    // Report SHOULD columns
    for (const col of expectations.should) {
      const exists = actualColumns.includes(col);
      if (exists) {
        console.log(`   ✅ ${col} (SHOULD — present)`);
      } else if (shouldInMetadata.includes(col)) {
        console.log(`   ⚠️  ${col} (SHOULD — missing, metadata fallback available)`);
      } else {
        console.log(`   ⚠️  ${col} (SHOULD — missing, no fallback)`);
      }
    }

    // Report unexpected columns
    const allExpected = [...expectations.must, ...expectations.should];
    const unexpected = actualColumns.filter((c) => !allExpected.includes(c));
    if (unexpected.length > 0) {
      console.log(`   ℹ️  Extra columns: ${unexpected.join(", ")}`);
    }

    if (mustMissing.length > 0) {
      hasCriticalMissing = true;
    }

    results.push({
      table,
      actual: actualColumns,
      mustMissing,
      shouldMissing,
      shouldInMetadata,
    });

    console.log("");
  }

  // Summary
  console.log("═══════════════════════════════════════════════════════════");
  console.log("  Summary");
  console.log("═══════════════════════════════════════════════════════════");

  for (const r of results) {
    const status = r.mustMissing.length > 0 ? "❌ FAIL" : "✅ PASS";
    console.log(`${status}  ${r.table}`);
    if (r.mustMissing.length > 0) {
      console.log(`      Missing MUST: ${r.mustMissing.join(", ")}`);
    }
    if (r.shouldMissing.length > 0) {
      const withFallback = r.shouldInMetadata;
      const noFallback = r.shouldMissing.filter((c) => !withFallback.includes(c));
      if (withFallback.length > 0) {
        console.log(`      Missing SHOULD (metadata fallback): ${withFallback.join(", ")}`);
      }
      if (noFallback.length > 0) {
        console.log(`      Missing SHOULD (no fallback): ${noFallback.join(", ")}`);
      }
    }
  }

  console.log("");

  // Migration 017/018 specific findings
  console.log("═══════════════════════════════════════════════════════════");
  console.log("  Migration 017 / 018 Column Audit");
  console.log("═══════════════════════════════════════════════════════════");

  const migration017Columns = [
    { table: "uploads", col: "provider_detected" },
    { table: "uploads", col: "provider_confidence" },
    { table: "transactions", col: "currency" },
    { table: "transactions", col: "reference" },
    { table: "transactions", col: "external_transaction_id" },
    { table: "transactions", col: "source_provider" },
    { table: "transactions", col: "posted_date" },
    { table: "transactions", col: "fee_amount" },
    { table: "transactions", col: "running_balance" },
  ];

  for (const { table, col } of migration017Columns) {
    const r = results.find((x) => x.table === table);
    if (r) {
      const exists = r.actual.includes(col);
      if (exists) {
        console.log(`✅ ${table}.${col}`);
      } else {
        const hasMetadata = r.actual.includes("metadata");
        console.log(`${hasMetadata ? "⚠️" : "❌"} ${table}.${col} missing${hasMetadata ? " (metadata fallback available)" : ""}`);
      }
    }
  }

  console.log("");

  if (hasCriticalMissing) {
    console.log("❌ Schema verification FAILED — some MUST columns are missing.");
    process.exit(1);
  } else {
    console.log("✅ Schema verification PASSED — all MUST columns present.");
    process.exit(0);
  }
}

verifySchema().catch((err) => {
  console.error("❌ Schema verification crashed:", err);
  process.exit(1);
});
