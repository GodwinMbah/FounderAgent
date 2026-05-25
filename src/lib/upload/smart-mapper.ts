/**
 * Smart CSV Mapper
 * Detects source type, maps columns, detects date format and currency
 * Produces a WizardPreview with confidence scores
 */

import { parseCsv } from "@/lib/parser/csv-core";
import { mapColumns, type MappingReport } from "@/lib/parser/column-mapper";
import { detectDateFormat } from "@/lib/parser/date-parser";
import { detectCurrency } from "@/lib/parser/currency-detector";
import { parseGenericCsv, extractColumnSamples } from "@/lib/parser/adapters/generic-csv";
import { categoriseRows } from "@/lib/intelligence/categoriser";
import { detectCsvSource } from "@/lib/parser/detect";
import type { UploadSource } from "@/lib/types";
import type {
  SourceType,
  ColumnMapping,
  WizardPreview,
  PreviewRow,
  MappingOverrides,
  ColumnSampleValues,
} from "./wizard-types";

export interface SmartMapContext {
  companyId: string;
  companyCurrency?: string;
  companyCountry?: string;
  uploadId?: string;
  overrides?: MappingOverrides;
  sourceTypeHint?: SourceType;
}

const SOURCE_TYPE_WEIGHTS: Record<string, number> = {
  stripe: 90,
  paypal: 90,
  quickbooks: 85,
  xero: 85,
  revolut_business_csv: 88,
  bank_statement_csv: 80,
  manual_csv: 50,
};

function detectSourceType(headers: string[], hint?: SourceType): { source: SourceType; confidence: number } {
  if (hint && hint !== "auto_detect") {
    return { source: hint, confidence: 95 };
  }

  const detected = detectCsvSource(headers);
  const confidence = SOURCE_TYPE_WEIGHTS[detected] ?? 60;

  return { source: detected as SourceType, confidence };
}

function buildColumnMappings(report: MappingReport): ColumnMapping[] {
  const mappings: ColumnMapping[] = [];
  const fieldMap = report.mapping;

  for (const [field, meta] of Object.entries(fieldMap)) {
    if (meta) {
      mappings.push({
        field,
        header: meta.header,
        index: meta.index,
        confidence: meta.confidence,
      });
    }
  }

  return mappings.sort((a, b) => b.confidence - a.confidence);
}

function applyOverrides(
  report: MappingReport,
  overrides: MappingOverrides,
  headers: string[]
): MappingReport {
  const newReport = { ...report, mapping: { ...report.mapping } };
  const overrideMap: Record<string, keyof MappingOverrides> = {
    date: "dateColumn",
    description: "descriptionColumn",
    merchant: "merchantColumn",
    amount: "amountColumn",
    debit: "debitColumn",
    credit: "creditColumn",
    currency: "currencyColumn",
    balance: "balanceColumn",
    type: "typeColumn",
    reference: "referenceColumn",
    category: "categoryColumn",
  };

  for (const [field, overrideKey] of Object.entries(overrideMap)) {
    const overrideValue = overrides[overrideKey];
    if (overrideValue) {
      const idx = headers.findIndex(
        (h) => h.toLowerCase().trim() === overrideValue.toLowerCase().trim()
      );
      if (idx >= 0) {
        (newReport.mapping as Record<string, unknown>)[field] = {
          index: idx,
          header: headers[idx],
          confidence: 100,
        };
      }
    }
  }

  return newReport;
}

export async function smartMapCsv(
  csvText: string,
  context: SmartMapContext
): Promise<WizardPreview> {
  const parsed = parseCsv(csvText);
  const headers = parsed.headers.map((h) => h.toLowerCase().trim());

  // Detect source type
  const sourceDetection = detectSourceType(headers, context.sourceTypeHint);

  // Determine sign convention from source
  const signConvention = sourceDetection.source === "bank_statement_csv" ? "uk_bank" : "unknown";

  // Initial column mapping
  let mappingReport = mapColumns(parsed);

  // Apply user overrides if provided
  if (context.overrides && Object.keys(context.overrides).length > 0) {
    mappingReport = applyOverrides(mappingReport, context.overrides, parsed.headers);
  }

  // Detect date format from sample
  const dateSample: string[] = [];
  if (mappingReport.mapping.date !== undefined) {
    const idx = mappingReport.mapping.date.index;
    for (const row of parsed.rows.slice(0, 20)) {
      if (row[idx]) dateSample.push(row[idx]);
    }
  }
  const dateFormatDetection = detectDateFormat(dateSample, context.companyCountry);

  // Detect currency
  const currencyResult = detectCurrency(
    parsed.headers,
    parsed.rows,
    mappingReport.mapping.currency?.index,
    context.companyCurrency,
    context.companyCountry
  );

  // Extract column samples for UI
  const columnSamples: ColumnSampleValues[] = extractColumnSamples(parsed);

  // Parse and normalise rows (first 50 for preview)
  const previewParse = parseGenericCsv(
    {
      ...parsed,
      rows: parsed.rows.slice(0, 50),
    },
    {
      companyId: context.companyId,
      companyCurrency: context.companyCurrency,
      companyCountry: context.companyCountry,
      uploadId: context.uploadId,
      dateFormat: context.overrides?.dateFormat,
      signConvention: context.overrides?.signConvention ?? signConvention,
      source: sourceDetection.source === "auto_detect" ? undefined : sourceDetection.source as UploadSource,
    }
  );

  // Categorise
  const categorised = categoriseRows(previewParse.rows);

  // Build preview rows
  const previewRows: PreviewRow[] = categorised.map((row) => ({
    rowNumber: row.rowNumber,
    date: row.date,
    merchant: row.merchant,
    description: row.description,
    amount: row.amount,
    type: row.type,
    currency: row.currency || currencyResult.currency,
    category: row.category,
    confidenceScore: row.confidenceScore,
    status: row.status,
    issues: row.parseErrors,
    rawData: row.rawData,
  }));

  // Calculate totals
  const incomeTotal = previewRows
    .filter((r) => r.type === "income")
    .reduce((s, r) => s + r.amount, 0);
  const expenseTotal = previewRows
    .filter((r) => r.type === "expense")
    .reduce((s, r) => s + r.amount, 0);

  return {
    sourceType: sourceDetection.source,
    detectedDelimiter: parsed.delimiter,
    detectedCurrency: currencyResult.currency,
    detectedDateFormat: dateFormatDetection.format,
    columnMappings: buildColumnMappings(mappingReport),
    columnSamples,
    previewRows,
    failedRows: previewParse.failedRows,
    incomeTotal,
    expenseTotal,
    netMovement: incomeTotal - expenseTotal,
    mappingConfidence: mappingReport.overallConfidence,
  };
}

export async function validateMapping(report: MappingReport): Promise<{
  valid: boolean;
  missingRequired: string[];
}> {
  return {
    valid: report.missingRequired.length === 0,
    missingRequired: report.missingRequired,
  };
}
