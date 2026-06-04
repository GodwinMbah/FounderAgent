import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("Open Banking schema migration contract", () => {
  const migration = readFileSync(join(process.cwd(), "supabase/migrations/022_open_banking_connected_sources.sql"), "utf8");

  it("creates provider-neutral connection, consent, balance, sync job and log tables", () => {
    expect(migration).toContain("CREATE TABLE IF NOT EXISTS public.connected_institutions");
    expect(migration).toContain("CREATE TABLE IF NOT EXISTS public.provider_consents");
    expect(migration).toContain("CREATE TABLE IF NOT EXISTS public.bank_account_balances");
    expect(migration).toContain("CREATE TABLE IF NOT EXISTS public.open_banking_sync_jobs");
    expect(migration).toContain("CREATE TABLE IF NOT EXISTS public.open_banking_sync_logs");
  });

  it("extends bank accounts and transactions with connected source lineage", () => {
    expect(migration).toContain("ADD COLUMN IF NOT EXISTS provider_account_id");
    expect(migration).toContain("ADD COLUMN IF NOT EXISTS kpi_routing");
    expect(migration).toContain("ADD COLUMN IF NOT EXISTS source_connection_id");
    expect(migration).toContain("ADD COLUMN IF NOT EXISTS source_sync_job_id");
    expect(migration).toContain("ADD COLUMN IF NOT EXISTS source_account_provider_id");
  });

  it("documents token references instead of raw token storage", () => {
    expect(migration).toContain("token_reference");
    expect(migration).toContain("Do not store raw provider access tokens here");
  });
});

