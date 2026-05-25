/**
 * Generic CSV adapter — fallback for any CSV format
 * Uses column mapper to detect headers, then normalises rows into transactions
 */

import type { UploadSource } from "@/lib/types";
import { type ParsedCsv } from "../csv-core";
import { mapColumns, type MappingReport } from "../column-mapper";
import { parseDate, type DateParseResult } from "../date-parser";
import { parseAmount, parseDebitCredit, parseAmountWithType, type AmountParseResult, type SignConvention } from "../amount-parser";
import { detectCurrency, type CurrencyDetectionResult } from "../currency-detector";
import { parseRevolutCsv } from "./revolut-csv";

export interface NormalisedRow {
  rowNumber: number;
  date: string;
  merchant: string;
  description: string;
  amount: number;
  type: "income" | "expense";
  currency?: string;
  originalAmount?: number;
  originalCurrency?: string;
  category?: string;
  status: string;
  confidenceScore: number;
  rawData: Record<string, string>;
  metadata?: Record<string, unknown>;
  parseErrors: string[];
}

export interface GenericParseResult {
  rows: NormalisedRow[];
  mappingReport: MappingReport;
  currencyResult: CurrencyDetectionResult;
  failedRows: { rowNumber: number; rawRow: string[]; errors: string[] }[];
}

export interface ParseContext {
  companyId: string;
  companyCurrency?: string;
  companyCountry?: string;
  uploadId?: string;
  dateFormat?: string;
  signConvention?: SignConvention;
  source?: UploadSource;
}

export function parseGenericCsv(
  parsed: ParsedCsv,
  context: ParseContext
): GenericParseResult {
  if (context.source === "revolut_business_csv") {
    return parseRevolutCsv(parsed, context);
  }

  const mappingReport = mapColumns(parsed);
  const { mapping } = mappingReport;
  const failedRows: { rowNumber: number; rawRow: string[]; errors: string[] }[] = [];
  const rows: NormalisedRow[] = [];

  // Detect currency
  const currencyResult = detectCurrency(
    parsed.headers,
    parsed.rows,
    mapping.currency?.index,
    context.companyCurrency,
    context.companyCountry
  );

  // Determine sign convention from source or default to UK bank standard
  const signConvention: SignConvention = context.signConvention ?? "uk_bank";

  for (let i = 0; i < parsed.rows.length; i++) {
    const rowNumber = i + 2; // 1-based, skipping header
    const row = parsed.rows[i];
    const errors: string[] = [];

    // Skip rows that are clearly empty or too short
    if (row.length < 2) {
      failedRows.push({ rowNumber, rawRow: row, errors: ["Row too short"] });
      continue;
    }

    // Parse date
    let dateResult: DateParseResult | null = null;
    if (mapping.date !== undefined) {
      const dateStr = row[mapping.date.index];
      if (dateStr) {
        dateResult = parseDate(dateStr, context.companyCountry);
        if (!dateResult.valid) errors.push(dateResult.error || "Invalid date");
      } else {
        errors.push("Missing date");
      }
    } else {
      errors.push("No date column mapped");
    }

    // Parse description / merchant
    let description = "";
    let merchant = "";
    if (mapping.description !== undefined) {
      description = row[mapping.description.index]?.trim() || "";
    }
    if (mapping.merchant !== undefined) {
      merchant = row[mapping.merchant.index]?.trim() || "";
    }
    // If no description, use merchant; if no merchant, use description
    if (!description && merchant) description = merchant;
    if (!merchant && description) merchant = extractMerchant(description);
    if (!description) errors.push("Missing description");

    // Parse amount
    let amountResult: AmountParseResult | null = null;
    if (mapping.debit !== undefined || mapping.credit !== undefined) {
      const debitStr = mapping.debit !== undefined ? row[mapping.debit.index] : "";
      const creditStr = mapping.credit !== undefined ? row[mapping.credit.index] : "";
      amountResult = parseDebitCredit(debitStr || "0", creditStr || "0");
      if (!amountResult) {
        // Fallback: check amount column
        if (mapping.amount !== undefined) {
          const amountStr = row[mapping.amount.index];
          if (amountStr) {
            amountResult = parseAmount(amountStr, signConvention);
          }
        }
      }
    } else if (mapping.amount !== undefined) {
      const amountStr = row[mapping.amount.index];
      if (amountStr) {
        if (mapping.type !== undefined) {
          amountResult = parseAmountWithType(amountStr, row[mapping.type.index] || "");
        } else {
          amountResult = parseAmount(amountStr, signConvention);
        }
      }
    }

    if (!amountResult || amountResult.amount === 0) {
      errors.push("Missing or invalid amount");
    }

    // Build raw data preservation
    const rawData: Record<string, string> = {};
    for (let h = 0; h < parsed.headers.length; h++) {
      rawData[parsed.headers[h]] = row[h] || "";
    }

    // If critical errors exist, mark as failed row
    if (errors.length > 0) {
      failedRows.push({ rowNumber, rawRow: row, errors });
      continue;
    }

    // Determine row currency
    const rowCurrency = amountResult?.currency || currencyResult.currency;

    // Build normalised row
    rows.push({
      rowNumber,
      date: dateResult?.date || new Date().toISOString().slice(0, 10),
      merchant,
      description,
      amount: amountResult?.amount ?? 0,
      type: amountResult?.type ?? "expense",
      currency: rowCurrency,
      originalAmount: amountResult?.originalAmount,
      originalCurrency: amountResult?.originalCurrency,
      status: "needs_review",
      confidenceScore: 0, // Will be set by categoriser
      rawData,
      parseErrors: [],
    });
  }

  return { rows, mappingReport, currencyResult, failedRows };
}

export function extractMerchant(description: string): string {
  const cleaned = description.replace(/\s+/g, " ").trim();
  if (!cleaned) return "Unknown";

  // Remove common prefixes
  const withoutPrefix = cleaned
    .replace(/^(POS|CARD|PURCHASE|PAYMENT|TRANSFER|DIRECT DEBIT|STANDING ORDER)\s*/i, "")
    .trim();

  const parts = withoutPrefix.split(" ");
  if (parts.length === 0) return "Unknown";

  // Take first 2-3 words as merchant name
  const wordCount = Math.min(parts.length, 3);
  return parts.slice(0, wordCount).join(" ");
}

/**
 * Extract sample values for each column (first 3 non-empty values)
 */
export function extractColumnSamples(parsed: ParsedCsv): { header: string; samples: string[] }[] {
  const samples: { header: string; samples: string[] }[] = [];

  for (let colIdx = 0; colIdx < parsed.headers.length; colIdx++) {
    const header = parsed.headers[colIdx];
    const colSamples: string[] = [];
    for (const row of parsed.rows) {
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
