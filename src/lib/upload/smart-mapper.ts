/**
 * Smart CSV Mapper v2
 * Uses the unified parser and adapter registry for multi-provider ingestion.
 */

import { parseCsv } from "@/lib/parser/csv-core";
import { parseUpload } from "@/lib/parser/unified-parser";
import { detectProvider, buildColumnMapping, getAdapter, scoreHeaderMatch } from "@/lib/providers/adapter-registry";


import { categoriseRows } from "@/lib/intelligence/categoriser";
import { detectSubscriptions } from "@/lib/intelligence/subscription-detector";
import type {
  SourceType,
  ColumnMapping,
  WizardPreview,
  PreviewRow,
  MappingOverrides,
  ColumnSampleValues,
} from "./wizard-types";
import type { CanonicalField } from "@/lib/providers/adapter-types";

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
  externalTransactionId: "reference",
  originalAmount: "amount",
  originalCurrency: "currency",
  accountName: "account",
  merchantCategoryCode: "category",
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

  // Categorise rows
  const categorised = categoriseRows(
    parseResult.transactions.map((tx, i) => ({
      rowNumber: i + 2,
      date: tx.transactionDate,
      merchant: tx.merchantName,
      description: tx.description,
      amount: Math.abs(tx.amount),
      type: tx.amount >= 0 ? ("income" as const) : ("expense" as const),
      currency: tx.currency,
      category: tx.category,
      status: tx.status,
      confidenceScore: tx.confidenceScore,
      rawData: tx.rawData,
      parseErrors: tx.parseErrors,
    }))
  );

  // Build preview rows
  const previewRows: PreviewRow[] = categorised.map((row, i) => ({
    rowNumber: row.rowNumber,
    date: row.date,
    merchant: row.merchant,
    description: row.description,
    amount: row.amount,
    type: row.type,
    currency: row.currency || parseResult.detectedCurrency || context.companyCurrency || "GBP",
    category: row.category,
    confidenceScore: row.confidenceScore,
    status: row.status,
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
  const incomeToAdd = previewRows
    .filter((r) => r.type === "income" && !r.isPossibleDuplicate)
    .reduce((s, r) => s + r.amount, 0);
  const expensesToAdd = previewRows
    .filter((r) => r.type === "expense" && !r.isPossibleDuplicate)
    .reduce((s, r) => s + r.amount, 0);
  const duplicatesToSkip = previewRows.filter((r) => r.isPossibleDuplicate).length;
  const detectedSubs = detectSubscriptions(categorised);

  const estimatedImpact = {
    incomeToAdd,
    expensesToAdd,
    netMovement: incomeToAdd - expensesToAdd,
    duplicatesToSkip,
    failedRows: parseResult.failedRows.length,
    subscriptionsDetected: detectedSubs.length,
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
    estimatedImpact,
  };
}
