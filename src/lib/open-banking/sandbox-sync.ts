import { createAdminClient } from "@/lib/supabase/admin";
import { recalculateCompanyMetrics } from "@/lib/db/company-metrics";
import { createTransactionsChunked, type TransactionInsert } from "@/lib/db/transactions";
import { detectDuplicate } from "@/lib/intelligence/duplicate-detector-v2";
import { toDbTransaction, type CanonicalTransaction } from "@/lib/providers/canonical-model";
import { applyReportingTreatment } from "@/lib/reporting/treatment-engine";
import { applyMerchantAndTransferSignals, categoriseCanonicalTransactions } from "@/lib/upload/categorisation-runner";
import { classifyConnectedAccountTreatment } from "./kpi-routing";
import { PlaidSandboxFixtureConnector } from "./sandbox-provider";
import type { ConnectedBankAccount, ConnectedInstitution, ProviderBalance, ProviderConsent } from "./types";

type AdminClient = NonNullable<ReturnType<typeof createAdminClient>>;

interface OptionalWriteResult {
  id?: string;
  warning?: string;
}

interface BankAccountPersistResult {
  id: string;
  providerAccountId: string;
  accountName: string;
  warning?: string;
}

export interface OpenBankingSandboxSyncResult {
  success: boolean;
  provider: "plaid";
  environment: "sandbox";
  institutionId?: string;
  consentId?: string;
  syncJobId?: string;
  connectedAccounts: BankAccountPersistResult[];
  accountsSynced: number;
  balancesSynced: number;
  providerTransactions: number;
  canonicalTransactions: number;
  transactionsInserted: number;
  duplicatesSkipped: number;
  revenueRows: number;
  expenseRows: number;
  transferRows: number;
  debtRows: number;
  warnings: string[];
  error?: string;
}

export function assertOpenBankingSandboxAllowed() {
  const openBankingEnv = (process.env.OPEN_BANKING_ENV ?? "sandbox").toLowerCase();
  const plaidEnv = (process.env.PLAID_ENV ?? "sandbox").toLowerCase();
  const explicitlyEnabled = process.env.NEXT_PUBLIC_ENABLE_OPEN_BANKING_SANDBOX === "true";
  if (process.env.NODE_ENV === "production" && !explicitlyEnabled) {
    throw new Error("Open Banking sandbox proof is disabled in production unless explicitly enabled.");
  }
  if (openBankingEnv === "production" || plaidEnv === "production") {
    throw new Error("Open Banking sandbox proof cannot run while a production provider environment is selected.");
  }
}

function isMissingSchemaError(message?: string): boolean {
  if (!message) return false;
  const lower = message.toLowerCase();
  return (
    lower.includes("does not exist") ||
    lower.includes("schema cache") ||
    lower.includes("could not find") ||
    lower.includes("column") ||
    lower.includes("relation")
  );
}

function optionalWarning(scope: string, message?: string): string {
  return `${scope} skipped because migration 022 is not applied in this database yet${message ? ` (${message})` : ""}.`;
}

function accountDbType(account: ConnectedBankAccount): string {
  if (account.accountType === "business_credit_card") return "credit_card";
  if (account.accountType === "loan") return "loan";
  if (account.accountType === "payment_processor") return "payment_processor";
  return "bank";
}

function accountCashBalance(account: ConnectedBankAccount): number {
  if (!account.kpiRouting.cashBalanceSource) return 0;
  return account.currentBalance ?? 0;
}

function bankAccountMetadata(
  account: ConnectedBankAccount,
  balance: ProviderBalance | undefined,
  institutionId?: string,
  consentId?: string
): Record<string, unknown> {
  return {
    source_kind: "open_banking",
    provider: account.provider,
    provider_account_id: account.providerAccountId,
    provider_institution_id: account.institutionId,
    connected_institution_id: institutionId,
    provider_consent_id: consentId,
    connected_account_type: account.accountType,
    connected_account_subtype: account.accountSubtype,
    connected_account_name: account.accountName,
    official_name: account.officialName,
    account_mask: account.accountMask,
    available_balance: account.availableBalance,
    credit_limit: account.limit,
    last_synced_at: account.lastSyncedAt,
    last_successful_sync_at: account.lastSuccessfulSyncAt,
    sync_status: account.syncStatus,
    connection_status: account.status,
    kpi_routing: account.kpiRouting,
    cash_balance_source: account.kpiRouting.cashBalanceSource,
    last_balance_payload: balance?.raw,
  };
}

async function upsertConnectedInstitution(
  admin: AdminClient,
  institution: ConnectedInstitution
): Promise<OptionalWriteResult> {
  const { data: existing, error: existingError } = await admin
    .from("connected_institutions")
    .select("id")
    .eq("company_id", institution.companyId)
    .eq("provider", institution.provider)
    .eq("provider_institution_id", institution.providerInstitutionId)
    .maybeSingle();

  if (existingError && isMissingSchemaError(existingError.message)) {
    return { warning: optionalWarning("connected_institutions", existingError.message) };
  }
  if (existingError) throw new Error(`Connected institution lookup failed: ${existingError.message}`);

  if (existing?.id) {
    const { error } = await admin
      .from("connected_institutions")
      .update({
        institution_name: institution.institutionName,
        country_codes: institution.countryCodes,
        status: institution.status,
        metadata: institution.metadata ?? {},
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id);
    if (error && isMissingSchemaError(error.message)) {
      return { id: existing.id, warning: optionalWarning("connected_institutions update", error.message) };
    }
    if (error) throw new Error(`Connected institution update failed: ${error.message}`);
    return { id: existing.id };
  }

  const { data, error } = await admin
    .from("connected_institutions")
    .insert({
      company_id: institution.companyId,
      provider: institution.provider,
      provider_institution_id: institution.providerInstitutionId,
      institution_name: institution.institutionName,
      country_codes: institution.countryCodes,
      status: institution.status,
      connected_at: institution.connectedAt ?? new Date().toISOString(),
      metadata: institution.metadata ?? {},
    })
    .select("id")
    .single();

  if (error && isMissingSchemaError(error.message)) {
    return { warning: optionalWarning("connected_institutions", error.message) };
  }
  if (error || !data) throw new Error(`Connected institution insert failed: ${error?.message}`);
  return { id: data.id as string };
}

async function insertProviderConsent(
  admin: AdminClient,
  consent: ProviderConsent,
  institutionId?: string
): Promise<OptionalWriteResult> {
  const { data, error } = await admin
    .from("provider_consents")
    .insert({
      company_id: consent.companyId,
      connected_institution_id: institutionId,
      provider: consent.provider,
      provider_item_id: consent.providerItemId,
      provider_consent_id: consent.providerConsentId,
      token_reference: consent.tokenReference,
      scopes: consent.scopes,
      status: consent.status,
      consent_expires_at: consent.consentExpiresAt,
      last_synced_at: consent.lastSyncedAt,
      last_successful_sync_at: consent.lastSuccessfulSyncAt,
      reconnect_url: consent.reconnectUrl,
      metadata: {
        ...(consent.metadata ?? {}),
        token_storage: "reference_only",
        sandbox_fixture: true,
      },
    })
    .select("id")
    .single();

  if (error && isMissingSchemaError(error.message)) {
    return { warning: optionalWarning("provider_consents", error.message) };
  }
  if (error || !data) throw new Error(`Provider consent insert failed: ${error?.message}`);
  return { id: data.id as string };
}

async function upsertBankAccount(
  admin: AdminClient,
  account: ConnectedBankAccount,
  balance: ProviderBalance | undefined,
  institutionId?: string,
  consentId?: string
): Promise<BankAccountPersistResult> {
  const { data: existingRows, error: existingError } = await admin
    .from("bank_accounts")
    .select("id, name, metadata")
    .eq("company_id", account.companyId)
    .limit(200);

  if (existingError) throw new Error(`Bank account lookup failed: ${existingError.message}`);

  const existing = (existingRows ?? []).find((row: { name?: string; metadata?: Record<string, unknown> | null }) => {
    const metadata = row.metadata ?? {};
    return metadata.provider_account_id === account.providerAccountId || row.name === account.accountName;
  });

  const metadata = {
    ...((existing?.metadata as Record<string, unknown> | undefined) ?? {}),
    ...bankAccountMetadata(account, balance, institutionId, consentId),
  };

  const payload = {
    company_id: account.companyId,
    name: account.accountName,
    type: accountDbType(account),
    currency: account.currency,
    current_balance: accountCashBalance(account),
    last_statement_date: account.lastSuccessfulSyncAt?.slice(0, 10) ?? new Date().toISOString().slice(0, 10),
    is_active: true,
    metadata,
    updated_at: new Date().toISOString(),
  };

  let id = existing?.id as string | undefined;
  if (id) {
    const { error } = await admin.from("bank_accounts").update(payload).eq("id", id);
    if (error) throw new Error(`Bank account update failed: ${error.message}`);
  } else {
    const { data, error } = await admin.from("bank_accounts").insert(payload).select("id").single();
    if (error || !data) throw new Error(`Bank account insert failed: ${error?.message}`);
    id = data.id as string;
  }

  const optionalUpdate = {
    provider: account.provider,
    provider_account_id: account.providerAccountId,
    connected_institution_id: institutionId,
    provider_consent_id: consentId,
    account_subtype: account.accountSubtype,
    available_balance: account.availableBalance,
    credit_limit: account.limit,
    connection_status: account.status,
    last_synced_at: account.lastSyncedAt,
    last_successful_sync_at: account.lastSuccessfulSyncAt,
    sync_status: account.syncStatus,
    sync_error: account.syncError,
    kpi_routing: account.kpiRouting,
  };
  const { error: optionalError } = await admin.from("bank_accounts").update(optionalUpdate).eq("id", id);
  const warning = optionalError && isMissingSchemaError(optionalError.message)
    ? optionalWarning("bank_accounts connected columns", optionalError.message)
    : undefined;
  if (optionalError && !warning) throw new Error(`Bank account connected update failed: ${optionalError.message}`);

  return { id, providerAccountId: account.providerAccountId, accountName: account.accountName, warning };
}

async function insertBalanceSnapshot(
  admin: AdminClient,
  companyId: string,
  accountId: string,
  balance: ProviderBalance
): Promise<string | undefined> {
  const { error } = await admin.from("bank_account_balances").insert({
    company_id: companyId,
    bank_account_id: accountId,
    provider: "plaid",
    provider_account_id: balance.providerAccountId,
    current_balance: balance.current,
    available_balance: balance.available,
    credit_limit: balance.limit,
    currency: balance.currency,
    balance_as_of: balance.asOf,
    raw_payload: balance.raw,
  });

  if (error && isMissingSchemaError(error.message)) return optionalWarning("bank_account_balances", error.message);
  if (error) throw new Error(`Balance snapshot insert failed: ${error.message}`);
  return undefined;
}

async function createSyncJob(
  admin: AdminClient,
  input: {
    companyId: string;
    institutionId?: string;
    consentId?: string;
  }
): Promise<OptionalWriteResult> {
  if (!input.institutionId) return { warning: "open_banking_sync_jobs skipped because no connected institution row was available." };

  const { data, error } = await admin
    .from("open_banking_sync_jobs")
    .insert({
      company_id: input.companyId,
      provider: "plaid",
      provider_consent_id: input.consentId,
      connected_institution_id: input.institutionId,
      sync_type: "transactions",
      status: "running",
      started_at: new Date().toISOString(),
      metadata: { sandbox_fixture: true },
    })
    .select("id")
    .single();

  if (error && isMissingSchemaError(error.message)) {
    return { warning: optionalWarning("open_banking_sync_jobs", error.message) };
  }
  if (error || !data) throw new Error(`Open Banking sync job insert failed: ${error?.message}`);
  return { id: data.id as string };
}

async function finishSyncJob(
  admin: AdminClient,
  syncJobId: string | undefined,
  result: Pick<OpenBankingSandboxSyncResult, "accountsSynced" | "balancesSynced" | "providerTransactions" | "transactionsInserted" | "duplicatesSkipped">
): Promise<string | undefined> {
  if (!syncJobId) return undefined;
  const { error } = await admin
    .from("open_banking_sync_jobs")
    .update({
      status: "succeeded",
      completed_at: new Date().toISOString(),
      accounts_synced: result.accountsSynced,
      balances_synced: result.balancesSynced,
      transactions_seen: result.providerTransactions,
      transactions_inserted: result.transactionsInserted,
      duplicates_skipped: result.duplicatesSkipped,
      updated_at: new Date().toISOString(),
    })
    .eq("id", syncJobId);

  if (error && isMissingSchemaError(error.message)) return optionalWarning("open_banking_sync_jobs update", error.message);
  if (error) throw new Error(`Open Banking sync job update failed: ${error.message}`);
  return undefined;
}

async function writeSyncLog(
  admin: AdminClient,
  companyId: string,
  syncJobId: string | undefined,
  message: string
): Promise<string | undefined> {
  if (!syncJobId) return undefined;
  const { error } = await admin.from("open_banking_sync_logs").insert({
    company_id: companyId,
    sync_job_id: syncJobId,
    provider: "plaid",
    level: "info",
    event: "sandbox_sync_completed",
    message,
    raw_payload: { sandbox_fixture: true },
  });
  if (error && isMissingSchemaError(error.message)) return optionalWarning("open_banking_sync_logs", error.message);
  if (error) throw new Error(`Open Banking sync log insert failed: ${error.message}`);
  return undefined;
}

function mapExistingTransactionRows(data: Array<Record<string, unknown>>) {
  return data.map((row) => {
    const metadata = (row.metadata as Record<string, unknown> | null) ?? {};
    const absAmount = Number(row.amount);
    const signedAmount = row.type === "expense" ? -absAmount : absAmount;
    return {
      id: row.id as string,
      transactionDate: row.date as string,
      amount: signedAmount,
      currency: (row.currency as string | undefined) || (metadata.currency as string) || "GBP",
      merchantName: (row.merchant as string | undefined) || "",
      reference: (row.reference as string | undefined) || (metadata.reference as string | undefined),
      externalTransactionId: (row.external_transaction_id as string | undefined) || (metadata.external_transaction_id as string | undefined),
      accountName: (metadata.account_name as string | undefined),
      sourceProvider: (row.source_provider as string | undefined) || (metadata.source_provider as string | undefined) || "unknown",
      sourceFileId: (metadata.source_file_id as string | undefined),
    };
  });
}

async function getExistingTransactionsForDedup(admin: AdminClient, companyId: string, externalTransactionIds: string[] = []) {
  const selectedColumns = "id, date, amount, type, merchant, metadata, currency, reference, external_transaction_id, source_provider";
  const rowsById = new Map<string, Record<string, unknown>>();

  if (externalTransactionIds.length > 0) {
    const { data, error } = await admin
      .from("transactions")
      .select(selectedColumns)
      .eq("company_id", companyId)
      .in("external_transaction_id", externalTransactionIds);

    if (error) throw new Error(`Exact existing transaction lookup failed: ${error.message}`);
    for (const row of data ?? []) rowsById.set(row.id as string, row as Record<string, unknown>);
  }

  const { data, error } = await admin
    .from("transactions")
    .select(selectedColumns)
    .eq("company_id", companyId)
    .order("date", { ascending: false })
    .limit(2000);

  if (error) throw new Error(`Existing transaction lookup failed: ${error.message}`);
  for (const row of data ?? []) rowsById.set(row.id as string, row as Record<string, unknown>);

  return mapExistingTransactionRows([...rowsById.values()]);
}

export function buildOpenBankingTransactionInserts(input: {
  companyId: string;
  canonical: CanonicalTransaction[];
  existingTransactions: Awaited<ReturnType<typeof getExistingTransactionsForDedup>>;
  accountIdsByProviderId: Map<string, string>;
  institutionId?: string;
  consentId?: string;
  syncJobId?: string;
}): { inserts: TransactionInsert[]; duplicatesSkipped: number } {
  const inserts: TransactionInsert[] = [];
  let duplicatesSkipped = 0;

  for (const tx of input.canonical) {
    const duplicate = detectDuplicate(tx, input.existingTransactions);
    if (duplicate.isDuplicate) {
      tx.isPossibleDuplicate = true;
      tx.duplicateOfTransactionId = duplicate.duplicateTransactionId;
      tx.rowStatus = "duplicate_skipped";
      tx.status = "possible_duplicate";
      tx.kpiExcluded = true;
      tx.kpiExclusionReason = "duplicate";
      tx.reviewReason = duplicate.reason;
      duplicatesSkipped += 1;
      continue;
    }

    const treatment = tx.reportingTreatment ?? applyReportingTreatment(tx).reportingTreatment;
    if (treatment.includedInCashMovement && !treatment.includedInOperatingKpis && !treatment.includedInDataQualityReporting) {
      tx.rowStatus = "transfer";
    } else if (treatment.includedInDataQualityReporting || tx.status === "needs_review") {
      tx.rowStatus = "needs_review";
    } else {
      tx.rowStatus = "inserted";
    }

    const providerAccountId = tx.rawData.providerAccountId || tx.rawData.account_id || tx.rawData.provider_account_id;
    const bankAccountId = providerAccountId ? input.accountIdsByProviderId.get(providerAccountId) : undefined;
    const mapped = toDbTransaction(tx, input.companyId, undefined, bankAccountId);
    inserts.push({
      ...mapped,
      companyId: input.companyId,
      bankAccountId: mapped.accountId,
      date: typeof mapped.date === "string" ? mapped.date : mapped.date.toISOString().slice(0, 10),
      sourceConnectionId: input.consentId,
      sourceInstitutionId: input.institutionId,
      sourceSyncJobId: input.syncJobId,
      sourceAccountProviderId: providerAccountId,
      metadata: {
        ...mapped.metadata,
        source_kind: "open_banking",
        source_connection_id: input.consentId,
        source_institution_id: input.institutionId,
        source_sync_job_id: input.syncJobId,
        source_account_provider_id: providerAccountId,
        provider_account_id: providerAccountId,
        open_banking_sandbox_fixture: true,
      },
    });
  }

  return { inserts, duplicatesSkipped };
}

export function applyConnectedAccountTreatment(
  tx: CanonicalTransaction,
  account: ConnectedBankAccount
): CanonicalTransaction {
  const treatment = classifyConnectedAccountTreatment({
    accountType: account.accountType,
    type: tx.amount >= 0 ? "income" : "expense",
    amount: Math.abs(tx.amount),
    category: tx.category,
    merchant: tx.merchantName,
    description: tx.description,
    reference: tx.reference,
    transactionType: tx.transactionType,
    sourceProvider: tx.sourceProvider,
    metadata: {
      account_type: account.accountType,
      source_provider: tx.sourceProvider,
      provider_account_id: account.providerAccountId,
      connected_account_type: account.accountType,
      connected_account_name: account.accountName,
    },
  });

  tx.reportingTreatment = treatment;
  tx.category = treatment.category ?? tx.category;
  tx.categoryConfidence = treatment.confidence;
  tx.confidenceScore = Math.max(tx.confidenceScore ?? 0, treatment.confidence);
  tx.kpiTreatment = treatment.includedInOperatingKpis ? "included" : "excluded";
  tx.kpiExcluded = !treatment.includedInOperatingKpis;
  tx.kpiExclusionReason = treatment.kpiExclusionReason;
  tx.isCreditCardRepayment = treatment.reportingTreatment === "credit_card_repayment";
  tx.isFee = treatment.reportingTreatment === "bank_fee";
  tx.isTransfer =
    treatment.includedInCashMovement &&
    !treatment.includedInOperatingKpis &&
    !treatment.includedInDataQualityReporting;
  if (treatment.includedInDataQualityReporting) {
    tx.status = "needs_review";
    tx.rowStatus = "needs_review";
  } else if (tx.isTransfer) {
    tx.status = "transfer";
    tx.rowStatus = "transfer";
  } else if (tx.status === "transfer" || tx.status === "needs_review") {
    tx.status = "categorised";
    tx.rowStatus = "inserted";
  }
  return tx;
}

export async function runPlaidSandboxSyncForCompany(companyId: string): Promise<OpenBankingSandboxSyncResult> {
  assertOpenBankingSandboxAllowed();

  const admin = createAdminClient();
  if (!admin) throw new Error("Admin client not available");

  const connector = new PlaidSandboxFixtureConnector();
  const warnings: string[] = [];
  const now = new Date().toISOString();

  const institution: ConnectedInstitution = {
    companyId,
    provider: "plaid",
    providerInstitutionId: "plaid-sandbox-bank-founderagent",
    institutionName: "Plaid Sandbox Bank",
    countryCodes: ["GB"],
    status: "connected",
    connectedAt: now,
    metadata: { sandbox_fixture: true },
  };

  const institutionWrite = await upsertConnectedInstitution(admin, institution);
  if (institutionWrite.warning) warnings.push(institutionWrite.warning);

  const consent = await connector.exchangeConnectionToken({ companyId, publicToken: "public-sandbox-token-founderagent" });
  const consentWrite = await insertProviderConsent(admin, consent, institutionWrite.id);
  if (consentWrite.warning) warnings.push(consentWrite.warning);

  const accounts = (await connector.syncAccounts({
    ...consent,
    id: consentWrite.id,
    institutionId: institutionWrite.id,
  })).map((account) => ({
    ...account,
    institutionId: institution.providerInstitutionId,
    consentId: consent.providerConsentId,
  }));
  const balances = await connector.syncBalances(consent, accounts);
  const balanceByProviderId = new Map(balances.map((balance) => [balance.providerAccountId, balance]));

  const persistedAccounts: BankAccountPersistResult[] = [];
  const accountIdsByProviderId = new Map<string, string>();
  for (const account of accounts) {
    const persisted = await upsertBankAccount(admin, account, balanceByProviderId.get(account.providerAccountId), institutionWrite.id, consentWrite.id);
    persistedAccounts.push(persisted);
    accountIdsByProviderId.set(account.providerAccountId, persisted.id);
    if (persisted.warning && !warnings.includes(persisted.warning)) warnings.push(persisted.warning);
  }

  for (const balance of balances) {
    const accountId = accountIdsByProviderId.get(balance.providerAccountId);
    if (!accountId) continue;
    const warning = await insertBalanceSnapshot(admin, companyId, accountId, balance);
    if (warning && !warnings.includes(warning)) warnings.push(warning);
  }

  const syncJob = await createSyncJob(admin, { companyId, institutionId: institutionWrite.id, consentId: consentWrite.id });
  if (syncJob.warning) warnings.push(syncJob.warning);

  const synced = await connector.syncTransactions(consent, accounts);
  const accountByProviderId = new Map(accounts.map((account) => [account.providerAccountId, account]));
  const canonical = synced.transactions.map((transaction) => {
    const account = accountByProviderId.get(transaction.providerAccountId);
    if (!account) throw new Error(`Missing connected account for provider account ${transaction.providerAccountId}`);
    const tx = connector.normaliseTransaction(transaction, account);
    tx.rawData = {
      ...tx.rawData,
      providerAccountId: transaction.providerAccountId,
      provider_account_id: transaction.providerAccountId,
      account_id: transaction.providerAccountId,
      provider_transaction_id: transaction.providerTransactionId,
    };
    return tx;
  });

  applyMerchantAndTransferSignals(canonical);
  categoriseCanonicalTransactions(canonical, null);
  for (const tx of canonical) {
    const providerAccountId = tx.rawData.providerAccountId || tx.rawData.account_id || tx.rawData.provider_account_id;
    const account = providerAccountId ? accountByProviderId.get(providerAccountId) : undefined;
    if (account) applyConnectedAccountTreatment(tx, account);
  }

  const externalTransactionIds = canonical
    .map((tx) => tx.externalTransactionId)
    .filter((value): value is string => Boolean(value));
  const existingTransactions = await getExistingTransactionsForDedup(admin, companyId, externalTransactionIds);
  const { inserts, duplicatesSkipped } = buildOpenBankingTransactionInserts({
    companyId,
    canonical,
    existingTransactions,
    accountIdsByProviderId,
    institutionId: institutionWrite.id,
    consentId: consentWrite.id,
    syncJobId: syncJob.id,
  });

  const insertResult = await createTransactionsChunked(inserts);
  if (insertResult.error) throw new Error(`Open Banking sandbox transaction insert failed: ${insertResult.error}`);

  const result: OpenBankingSandboxSyncResult = {
    success: true,
    provider: "plaid",
    environment: "sandbox",
    institutionId: institutionWrite.id,
    consentId: consentWrite.id,
    syncJobId: syncJob.id,
    connectedAccounts: persistedAccounts,
    accountsSynced: accounts.length,
    balancesSynced: balances.length,
    providerTransactions: synced.transactions.length,
    canonicalTransactions: canonical.length,
    transactionsInserted: insertResult.count,
    duplicatesSkipped,
    revenueRows: canonical.filter((tx) => tx.reportingTreatment?.includedInOperatingRevenue).length,
    expenseRows: canonical.filter((tx) => tx.reportingTreatment?.includedInOperatingExpenses).length,
    transferRows: canonical.filter((tx) => tx.reportingTreatment?.reportingTreatment === "internal_transfer").length,
    debtRows: canonical.filter((tx) => tx.reportingTreatment?.includedInDebtTracking).length,
    warnings,
  };

  const finishWarning = await finishSyncJob(admin, syncJob.id, result);
  if (finishWarning && !result.warnings.includes(finishWarning)) result.warnings.push(finishWarning);
  const logWarning = await writeSyncLog(
    admin,
    companyId,
    syncJob.id,
    `Sandbox sync inserted ${result.transactionsInserted} transactions and skipped ${result.duplicatesSkipped} duplicates.`
  );
  if (logWarning && !result.warnings.includes(logWarning)) result.warnings.push(logWarning);

  await recalculateCompanyMetrics(companyId, "monthly");
  await recalculateCompanyMetrics(companyId, "all");

  return result;
}
