/**
 * Smart CSV Mapper v2
 * Uses the unified parser and adapter registry for multi-provider ingestion.
 */

import { parseCsv } from "@/lib/parser/csv-core";
import { parseUpload } from "@/lib/parser/unified-parser";
import { detectProvider, buildColumnMapping, getAdapter, scoreHeaderMatch } from "@/lib/providers/adapter-registry";


import { detectSubscriptions } from "@/lib/intelligence/subscription-detector";
import { applyMerchantAndTransferSignals, categoriseCanonicalTransactions, isKpiExcludedCategory } from "@/lib/upload/categorisation-runner";
import { buildPreviewIntelligenceSummary } from "@/lib/upload/intelligence-groups";
import type {
  SourceType,
  ColumnMapping,
  WizardPreview,
  PreviewRow,
  MappingOverrides,
  ColumnSampleValues,
} from "./wizard-types";
import type { CanonicalField } from "@/lib/providers/adapter-types";
import type { CompanySettings } from "@/lib/db/company_settings";

function mapProviderToSourceCategory(providerId: string): SourceType {
  const bankProviders = ["revolut_business_csv", "tide", "monzo", "starling", "wise", "barclays", "hsbc", "lloyds", "natwest", "chase"];
  const paymentProviders = ["stripe_csv", "paypal_csv", "square_csv", "gocardless_csv", "shopify_payouts_csv"];
  const accountingProviders = ["quickbooks", "xero"];

  if (providerId === "generic_bank") return "generic_bank";
  if (bankProviders.includes(providerId)) return "bank_statement_csv";
  if (paymentProviders.includes(providerId)) return "payment_processor_csv";
  if (accountingProviders.includes(providerId)) return "accounting_export_csv";
  return "manual_csv";
}

export interface SmartMapContext {
  companyId: string;
  companyCurrency?: string;
  companyCountry?: string;
  companySettings?: CompanySettings | null;
  uploadId?: string;
  overrides?: MappingOverrides;
  sourceTypeHint?: SourceType;
}

function extractColumnSamples(
  headers: string[],
  rows: string[][]
): ColumnSampleValues[] {
  const samples: ColumnSampleValues[] = [];
  for (let colIdx = 0; colIdx < headers.length; colIdx++) {
    const header = headers[colIdx];
    const colSamples: string[] = [];
    for (const row of rows) {
      const val = row[colIdx]?.trim();
      if (val && !colSamples.includes(val)) {
        colSamples.push(val);
        if (colSamples.length >= 3) break;
      }
    }
    samples.push({ header, samples: colSamples });
  }
  return samples;
}

const CANONICAL_TO_WIZARD_FIELD: Record<string, string> = {
  transactionDate: "date",
  postedDate: "date",
  merchantName: "merchant",
  description: "description",
  amount: "amount",
  debitAmount: "debit",
  creditAmount: "credit",
  currency: "currency",
  runningBalance: "balance",
  transactionType: "type",
  reference: "reference",
  category: "category",
  feeAmount: "fee",
  status: "status",
  externalTransactionId: "externalTransactionId",
  originalAmount: "amount",
  originalCurrency: "currency",
  accountName: "account",
  merchantCategoryCode: "merchantCategoryCode",
};

function buildColumnMappingsFromAdapter(
  headers: string[],
  adapterId: string
): ColumnMapping[] {
  const adapter = getAdapter(adapterId);
  if (!adapter) return [];

  const mapping = buildColumnMapping(headers, adapter);
  const result: ColumnMapping[] = [];

  for (const [field, meta] of Object.entries(mapping)) {
    const wizardField = CANONICAL_TO_WIZARD_FIELD[field] || field;
    result.push({
      field: wizardField,
      header: meta.header,
      index: meta.index,
      confidence: meta.confidence,
    });
  }

  return result.sort((a, b) => b.confidence - a.confidence);
}

export async function smartMapCsv(
  csvText: string,
  context: SmartMapContext
): Promise<WizardPreview> {
  // First parse to get raw structure for column samples and mapping UI
  const parsed = parseCsv(csvText);
  const headers = parsed.headers;

  console.log("[SmartMapperV2] delimiter:", JSON.stringify(parsed.delimiter));
  console.log("[SmartMapperV2] headers:", headers.length, "rows:", parsed.rowCount);

  // Detect provider (or use explicit hint)
  let detectedProvider: string;
  let providerConfidence: number;
  let bestMatch = detectProvider(parsed)[0];

  if (context.sourceTypeHint && context.sourceTypeHint !== "auto_detect") {
    const hintAdapter = getAdapter(context.sourceTypeHint);
    if (hintAdapter) {
      detectedProvider = hintAdapter.id;
      providerConfidence = 100;
      // Build a synthetic match for header details
      const mapped: string[] = [];
      const missing: CanonicalField[] = [];
      for (const alias of hintAdapter.headerAliases) {
        const best = Math.max(...headers.map((h) => scoreHeaderMatch(h, alias.aliases)));
        if (best >= 60) mapped.push(alias.aliases[0]);
        else if (alias.required) missing.push(alias.field);
      }
      bestMatch = {
        provider: hintAdapter,
        score: 100,
        matchedHeaders: mapped,
        missingRequired: missing,
      };
    } else {
      detectedProvider = bestMatch?.provider.id ?? "manual_csv";
      providerConfidence = bestMatch?.score ?? 0;
    }
  } else {
    detectedProvider = bestMatch?.provider.id ?? "manual_csv";
    providerConfidence = bestMatch?.score ?? 0;
  }

  console.log(
    "[SmartMapperV2] provider:", detectedProvider,
    "confidence:", providerConfidence,
    "matched:", bestMatch?.matchedHeaders.join(", ") ?? "none"
  );

  // Use unified parser for actual transaction extraction (first 50 rows for preview)
  const previewText = csvText; // parseUpload handles slicing internally if needed
  const parseResult = parseUpload(previewText, {
    companyId: context.companyId,
    companyCurrency: context.companyCurrency,
    companyCountry: context.companyCountry,
    uploadId: context.uploadId,
    sourceTypeHint: context.sourceTypeHint === "auto_detect" ? undefined : context.sourceTypeHint,
  });

  console.log(
    "[SmartMapperV2] parsed transactions:", parseResult.transactions.length,
    "failed:", parseResult.failedRows.length
  );

  applyMerchantAndTransferSignals(parseResult.transactions);
  const { categorisedRows, intelligenceGroups } = categoriseCanonicalTransactions(
    parseResult.transactions,
    context.companySettings ?? null
  );

  // Build preview rows
  const previewRows: PreviewRow[] = categorisedRows.map((row, i) => ({
    rowNumber: row.rowNumber,
    date: row.date,
    merchant: row.merchant,
    description: row.description,
    bankDescription: row.rawData.Description || row.rawData.description || undefined,
    reference: row.reference,
    payer: row.rawData.Payer || row.rawData.payer || undefined,
    counterparty: parseResult.transactions[i]?.counterpartyName,
    transactionType: parseResult.transactions[i]?.transactionType,
    sourceProvider: parseResult.transactions[i]?.sourceProvider,
    accountName: parseResult.transactions[i]?.accountName,
    externalTransactionId: parseResult.transactions[i]?.externalTransactionId,
    merchantCategoryCode: parseResult.transactions[i]?.merchantCategoryCode,
    feeAmount: parseResult.transactions[i]?.feeAmount,
    runningBalance: parseResult.transactions[i]?.runningBalance,
    amount: row.amount,
    type: row.type,
    currency: row.currency || parseResult.detectedCurrency || context.companyCurrency || "GBP",
    category: row.category,
    subcategory: row.subcategory,
    confidenceScore: row.confidenceScore,
    status: parseResult.transactions[i]?.status ?? row.status,
    categoryReason: row.categoryReason,
    categoryConfidence: row.categoryConfidence,
    groupingConfidence: row.groupingConfidence,
    normalisedMerchant: row.normalisedMerchant,
    displayMerchant: row.displayMerchant,
    kpiTreatment: row.kpiTreatment,
    kpiExclusionReason: parseResult.transactions[i]?.kpiExclusionReason,
    businessMeaning: row.businessMeaning,
    intelligenceGroupId: parseResult.transactions[i]?.intelligenceGroupId,
    intelligenceGroupLabel: parseResult.transactions[i]?.intelligenceGroupLabel,
    intelligenceGroupReason: parseResult.transactions[i]?.intelligenceGroupReason,
    intelligenceGroupSignals: parseResult.transactions[i]?.intelligenceGroupSignals,
    categorySource: parseResult.transactions[i]?.categorySource,
    isCreditCardRepayment: row.isCreditCardRepayment,
    isSubscriptionCandidate: row.isSubscriptionCandidate,
    isRecurringCandidate: row.isRecurringCandidate,
    categoryEvidence: row.categoryEvidence,
    reviewReason: parseResult.transactions[i]?.reviewReason,
    issues: row.parseErrors,
    rawData: row.rawData,
    isPossibleDuplicate: parseResult.transactions[i]?.isPossibleDuplicate ?? false,
  }));

  // Calculate totals
  const incomeTotal = previewRows
    .filter((r) => r.type === "income")
    .reduce((s, r) => s + r.amount, 0);
  const expenseTotal = previewRows
    .filter((r) => r.type === "expense")
    .reduce((s, r) => s + r.amount, 0);

  // Compute estimated impact
  const isKpiExcluded = (r: PreviewRow) => r.kpiTreatment === "excluded" || isKpiExcludedCategory(r.category);
  const incomeToAdd = previewRows
    .filter((r) => r.type === "income" && !r.isPossibleDuplicate && !isKpiExcluded(r))
    .reduce((s, r) => s + r.amount, 0);
  const expensesToAdd = previewRows
    .filter((r) => r.type === "expense" && !r.isPossibleDuplicate && !isKpiExcluded(r))
    .reduce((s, r) => s + r.amount, 0);
  const duplicatesToSkip = previewRows.filter((r) => r.isPossibleDuplicate).length;
  const detectedSubs = detectSubscriptions(categorisedRows);
  const intelligenceSummary = buildPreviewIntelligenceSummary(previewRows);

  const estimatedImpact = {
    incomeToAdd,
    expensesToAdd,
    netMovement: incomeToAdd - expensesToAdd,
    duplicatesToSkip,
    failedRows: parseResult.failedRows.length,
    subscriptionsDetected: detectedSubs.length,
    kpiExcludedRows: intelligenceSummary.kpiExcludedRows,
    creditCardPaymentsDetected: intelligenceSummary.creditCardPaymentsDetected,
    recurringGroupsDetected: intelligenceSummary.recurringGroupsDetected,
    latestBalanceDetected: parseResult.latestBalance,
  };

  // Column mappings for UI
  const columnMappings = buildColumnMappingsFromAdapter(headers, detectedProvider);
  const mappingConfidence = columnMappings.length > 0
    ? Math.round(columnMappings.reduce((s, m) => s + m.confidence, 0) / columnMappings.length)
    : 0;

  // Column samples for UI
  const columnSamples = extractColumnSamples(headers, parsed.rows.slice(0, 20));

  return {
    sourceType: mapProviderToSourceCategory(detectedProvider),
    detectedProvider,
    providerConfidence,
    detectedDelimiter: parseResult.detectedDelimiter,
    detectedCurrency: parseResult.detectedCurrency || context.companyCurrency || "GBP",
    detectedDateFormat: parseResult.detectedDateFormat || "unknown",
    columnMappings,
    columnSamples,
    previewRows,
    parsedHeaders: headers,
    failedRows: parseResult.failedRows,
    incomeTotal,
    expenseTotal,
    netMovement: incomeTotal - expenseTotal,
    mappingConfidence,
    latestBalance: parseResult.latestBalance,
    matchedHeaders: bestMatch?.matchedHeaders,
    missingHeaders: bestMatch?.missingRequired.map((f) => f.replace(/([A-Z])/g, " $1").trim()),
    intelligenceSummary,
    intelligenceGroups,
    estimatedImpact,
  };
}
