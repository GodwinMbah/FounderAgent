import { requireAuthCompany } from "@/lib/db";
import WizardClient from "./WizardClient";
import UploadHistoryList from "@/components/features/upload/UploadHistoryList";
import { getFinancialDataSourceStatus } from "@/lib/db/data-source";
import { DataCoverageBanner } from "@/components/features/shared/DataCoverageBanner";
import { PageHeader } from "@/components/ui/PageHeader";
import { DatabaseZap, Landmark, UploadCloud, Clock3, ShieldCheck, RefreshCw, Unplug } from "lucide-react";
import type { ElementType } from "react";
import OpenBankingSandboxClient from "./OpenBankingSandboxClient";
import { getConnectedAccountSummaries, type ConnectedAccountSummary } from "@/lib/open-banking/connected-accounts";

export default async function UploadCentrePage() {
  const { companyId } = await requireAuthCompany();
  const [dataSourceStatus, connectedAccounts] = await Promise.all([
    getFinancialDataSourceStatus(companyId),
    getConnectedAccountSummaries(companyId),
  ]);
  const sandboxEnabled = process.env.NEXT_PUBLIC_ENABLE_OPEN_BANKING_SANDBOX === "true" || process.env.NODE_ENV !== "production";
  return (
    <div className="space-y-8">
      <PageHeader
        title="Data Sources"
        subtitle="Connect live financial accounts first. Upload statements for history, unsupported banks, and fallback imports."
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-xl border border-[var(--accent)]/30 bg-[var(--card)]/80 p-5 shadow-[0_0_24px_rgba(20,184,166,0.06)]">
          <div className="flex items-start gap-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-[var(--accent)]/25 bg-[var(--accent)]/10 text-[var(--accent)]">
              <Landmark className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-base font-bold text-[var(--foreground)]">Connect Bank Account</h2>
                <span className="rounded-full border border-[var(--accent)]/25 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--accent)]">
                  Primary
                </span>
              </div>
              <p className="mt-2 text-sm leading-6 text-[var(--muted-foreground)]">
                Open Banking sandbox architecture is now the target path for accounts, balances, transactions, sync status, and source trace.
              </p>
              <div className="mt-4 grid gap-2 sm:grid-cols-3">
                <SourceSignal icon={DatabaseZap} label="Provider neutral" />
                <SourceSignal icon={Clock3} label="Sync ready" />
                <SourceSignal icon={ShieldCheck} label="Server-side tokens" />
              </div>
              <OpenBankingSandboxClient enabled={sandboxEnabled} />
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-[var(--border)] bg-[var(--card)]/70 p-5">
          <div className="flex items-start gap-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--background)] text-[var(--muted-foreground)]">
              <UploadCloud className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-base font-bold text-[var(--foreground)]">Upload Statement</h2>
                <span className="rounded-full border border-[var(--border)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
                  Fallback
                </span>
              </div>
              <p className="mt-2 text-sm leading-6 text-[var(--muted-foreground)]">
                CSV remains available for historical imports, unsupported institutions, accountant exports, and one-off statement recovery.
              </p>
            </div>
          </div>
        </section>
      </div>

      <ConnectedAccountsPanel accounts={connectedAccounts} />
      <WizardClient showHeader={false} />
      <DataCoverageBanner status={dataSourceStatus} selectedLabel="All time" />
      <UploadHistoryList />
    </div>
  );
}

function ConnectedAccountsPanel({ accounts }: { accounts: ConnectedAccountSummary[] }) {
  if (accounts.length === 0) return null;

  return (
    <section className="rounded-xl border border-[var(--border)] bg-[var(--card)]/70">
      <div className="border-b border-[var(--border)] px-5 py-4">
        <h2 className="text-base font-bold text-[var(--foreground)]">Connected Accounts</h2>
        <p className="mt-1 text-sm text-[var(--muted-foreground)]">
          First-class connected account records that power balances, sync status, KPI routing, and source trace.
        </p>
      </div>
      <div className="grid gap-3 p-5 md:grid-cols-2 xl:grid-cols-3">
        {accounts.map((account) => (
          <div key={account.id} className="rounded-lg border border-[var(--border)] bg-[var(--background)]/70 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-[var(--foreground)]">{account.accountName}</p>
                <p className="mt-1 text-xs uppercase tracking-wide text-[var(--muted-foreground)]">
                  {formatProvider(account.provider)} · {account.institutionName ?? "Institution"}
                </p>
              </div>
              <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase ${account.connectionStatus === "connected" ? "border-[var(--accent)]/25 text-[var(--accent)]" : "border-[#F43F5E]/30 text-[#FDA4AF]"}`}>
                {account.connectionStatus}
              </span>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
              <SourceFact label="Provider" value={formatProvider(account.provider)} />
              <SourceFact label="Institution" value={account.institutionName ?? "Unknown"} />
              <SourceFact label="Account Type" value={formatLabel(account.accountType ?? "connected account")} />
              <SourceFact label="Subtype" value={formatLabel(account.accountSubtype ?? "unknown")} />
              <SourceFact label="Currency" value={account.currency} />
              <SourceFact label="Current" value={formatMoney(account.currentBalance, account.currency)} />
              <SourceFact label="Available" value={formatMoney(account.availableBalance, account.currency)} />
              <SourceFact label="Credit Limit" value={formatMoney(account.creditLimit, account.currency)} />
              <SourceFact label="Cash Balance" value={account.cashBalanceSource ? "Included" : "Excluded"} />
              <SourceFact label="Sync" value={account.syncStatus ?? "unknown"} />
              <SourceFact label="Last Sync" value={formatSyncDate(account.lastSuccessfulSyncAt)} />
              <SourceFact label="Consent Expiry" value={formatDateTime(account.consentExpiresAt, "Not available")} />
              <SourceFact label="Transactions" value={String(account.transactionsSynced)} />
              <SourceFact label="Duplicates" value={String(account.duplicatesSkipped)} />
            </div>
            {account.syncError && (
              <div className="mt-3 rounded-lg border border-[#F43F5E]/25 bg-[#F43F5E]/10 px-3 py-2 text-xs text-[#FDA4AF]">
                {account.syncError}
              </div>
            )}
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                disabled
                className="inline-flex items-center gap-2 rounded-lg border border-[var(--border)] px-3 py-2 text-xs font-semibold text-[var(--muted-foreground)] opacity-70"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Reconnect
              </button>
              <button
                type="button"
                disabled
                className="inline-flex items-center gap-2 rounded-lg border border-[#F43F5E]/30 px-3 py-2 text-xs font-semibold text-[#FDA4AF] opacity-70"
              >
                <Unplug className="h-3.5 w-3.5" />
                Disconnect
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function SourceFact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wide text-[var(--muted-foreground)]">{label}</p>
      <p className="mt-1 font-medium text-[var(--foreground)]">{value}</p>
    </div>
  );
}

function formatSyncDate(value?: string): string {
  return formatDateTime(value, "Not synced");
}

function formatDateTime(value: string | undefined, fallback: string): string {
  if (!value) return fallback;
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatProvider(value?: string): string {
  if (!value) return "Unknown";
  const labels: Record<string, string> = {
    plaid: "Plaid",
    truelayer: "TrueLayer",
    yapily: "Yapily",
    tink: "Tink",
    gocardless_bank_account_data: "GoCardless",
    enable_banking: "Enable Banking",
  };
  return labels[value.toLowerCase()] ?? formatLabel(value);
}

function formatLabel(value: string): string {
  return value
    .replace(/_/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatMoney(value: number | undefined, currency: string): string {
  if (value === undefined || Number.isNaN(value)) return "Not available";
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}

function SourceSignal({
  icon: Icon,
  label,
}: {
  icon: ElementType;
  label: string;
}) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--background)]/60 px-3 py-2 text-xs font-medium text-[var(--muted-foreground)]">
      <Icon className="h-3.5 w-3.5 text-[var(--accent)]" />
      <span className="truncate">{label}</span>
    </div>
  );
}
