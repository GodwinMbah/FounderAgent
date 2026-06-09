"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, DatabaseZap, Loader2, TriangleAlert } from "lucide-react";
import { runOpenBankingSandboxSync } from "./open-banking-actions";
import type { OpenBankingSandboxSyncResult } from "@/lib/open-banking/sandbox-sync";

export default function OpenBankingSandboxClient({ enabled }: { enabled: boolean }) {
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<OpenBankingSandboxSyncResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  function runSandboxSync() {
    setError(null);
    startTransition(async () => {
      try {
        const next = await runOpenBankingSandboxSync();
        setResult(next);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Sandbox sync failed.");
      }
    });
  }

  return (
    <div className="mt-4 space-y-3">
      <button
        type="button"
        onClick={runSandboxSync}
        disabled={!enabled || isPending}
        className="inline-flex items-center justify-center gap-2 rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-[var(--accent-foreground)] transition-colors hover:bg-[var(--accent)]/90 disabled:cursor-not-allowed disabled:opacity-45"
      >
        {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <DatabaseZap className="h-4 w-4" />}
        Run Sandbox Sync
      </button>

      {!enabled && (
        <p className="flex items-center gap-2 text-xs text-[var(--muted-foreground)]">
          <TriangleAlert className="h-3.5 w-3.5 text-[#FBBF24]" />
          Sandbox sync is hidden in production unless explicitly enabled.
        </p>
      )}

      {result && (
        <div className="rounded-lg border border-[#22C55E]/25 bg-[#22C55E]/10 p-3 text-xs text-[#BBF7D0]">
          <div className="flex items-center gap-2 font-semibold text-[#22C55E]">
            <CheckCircle2 className="h-4 w-4" />
            Sandbox sync completed
          </div>
          <p className="mt-2 text-[#D1FAE5]">
            Source: {result.sourceMode === "plaid_api" ? "Plaid Sandbox API" : "FounderAgent fixture"}
          </p>
          <p className="mt-2">
            {result.accountsSynced} accounts, {result.balancesSynced} balances, {result.transactionsInserted} inserted,
            {" "}
            {result.duplicatesSkipped} duplicate skipped.
          </p>
          {result.warnings.length > 0 && (
            <p className="mt-2 text-[#FDE68A]">{result.warnings[0]}</p>
          )}
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-[#F43F5E]/25 bg-[#F43F5E]/10 p-3 text-xs text-[#FDA4AF]">
          {error}
        </div>
      )}
    </div>
  );
}
