/**
 * Revolut Business CSV adapter
 * Parses Revolut Business export format into normalised transactions
 */

import type { ParsedCsv } from "../csv-core";
import type { GenericParseResult, ParseContext, NormalisedRow } from "./generic-csv";
import { extractMerchant } from "./generic-csv";
import { parseDate } from "../date-parser";
import { parseAmount } from "../amount-parser";
import { mapColumns, type MappingReport } from "../column-mapper";
import { detectCurrency, type CurrencyDetectionResult } from "../currency-detector";

function getColumnIndex(headers: string[], names: string[]): number {
  for (let i = 0; i < headers.length; i++) {
    const h = headers[i].toLowerCase().trim();
    if (names.includes(h)) return i;
  }
  return -1;
}

function getValue(row: string[], index: number): string {
  if (index < 0 || index >= row.length) return "";
  return row[index]?.trim() ?? "";
}

export function parseRevolutCsv(
  parsed: ParsedCsv,
  context: ParseContext
): GenericParseResult {
  const headers = parsed.headers;
  const failedRows: GenericParseResult["failedRows"] = [];
  const rows: NormalisedRow[] = [];

  const idxDateCompleted = getColumnIndex(headers, ["date completed utc"]);
  const idxDateStarted = getColumnIndex(headers, ["date started utc"]);
  const idxId = getColumnIndex(headers, ["id"]);
  const idxDescription = getColumnIndex(headers, ["description"]);
  const idxReference = getColumnIndex(headers, ["reference"]);
  const idxType = getColumnIndex(headers, ["type"]);
  const idxState = getColumnIndex(headers, ["state"]);
  const idxAmount = getColumnIndex(headers, ["amount"]);
  const idxTotalAmount = getColumnIndex(headers, ["total amount"]);
  const idxFee = getColumnIndex(headers, ["fee"]);
  const idxBalance = getColumnIndex(headers, ["balance"]);
  const idxAccount = getColumnIndex(headers, ["account"]);
  const idxMcc = getColumnIndex(headers, ["mcc"]);
  const idxOrigCurrency = getColumnIndex(headers, ["orig currency"]);
  const idxOrigAmount = getColumnIndex(headers, ["orig amount"]);
  const idxPaymentCurrency = getColumnIndex(headers, ["payment currency"]);
  const idxRelatedTransactionId = getColumnIndex(headers, ["related transaction id"]);

  for (let i = 0; i < parsed.rows.length; i++) {
    const rowNumber = i + 2; // 1-based, skipping header
    const row = parsed.rows[i];
    const errors: string[] = [];

    // Skip rows that are clearly empty or too short
    if (row.length < 2) {
      failedRows.push({ rowNumber, rawRow: row, errors: ["Row too short"] });
      continue;
    }

    const state = getValue(row, idxState).toUpperCase();
    if (state === "DECLINED" || state === "REVERSED" || state === "FAILED") {
      continue;
    }

    // Parse date: prefer Date Completed UTC, fallback to Date Started UTC
    const dateStr = getValue(row, idxDateCompleted) || getValue(row, idxDateStarted);
    let date = "";
    if (dateStr) {
      const dateResult = parseDate(dateStr, context.companyCountry);
      if (dateResult.valid && dateResult.date) {
        date = dateResult.date;
      } else {
        errors.push(dateResult.error || "Invalid date");
      }
    } else {
      errors.push("Missing date");
    }

    // Description, reference, merchant
    const description = getValue(row, idxDescription);
    const reference = getValue(row, idxReference);
    const merchant = description ? extractMerchant(description) : "";

    // Amount logic
    let amountStr = getValue(row, idxAmount);
    if (!amountStr) {
      amountStr = getValue(row, idxTotalAmount);
    }

    const amountResult = amountStr ? parseAmount(amountStr, "uk_bank") : null;
    if (!amountResult || amountResult.amount === 0) {
      errors.push("Missing or invalid amount");
    }

    // Build raw data preservation
    const rawData: Record<string, string> = {};
    for (let h = 0; h < parsed.headers.length; h++) {
      rawData[parsed.headers[h]] = row[h] || "";
    }

    // Map metadata
    const idValue = getValue(row, idxId);
    if (idValue) rawData["external_id"] = idValue;
    if (reference) rawData["reference"] = reference;
    const typeValue = getValue(row, idxType).toUpperCase();
    if (typeValue) rawData["transaction_type_hint"] = typeValue;
    if (state) rawData["state"] = state;
    if (idxBalance >= 0) rawData["balance"] = getValue(row, idxBalance);
    if (idxAccount >= 0) rawData["account_name"] = getValue(row, idxAccount);
    if (idxMcc >= 0) rawData["mcc"] = getValue(row, idxMcc);
    if (idxRelatedTransactionId >= 0) {
      rawData["related_transaction_id"] = getValue(row, idxRelatedTransactionId);
    }

    const isTransfer = typeValue === "TRANSFER";
    if (isTransfer) {
      rawData["is_transfer"] = "true";
    }

    if (errors.length > 0) {
      failedRows.push({ rowNumber, rawRow: row, errors });
      continue;
    }

    // Determine status based on state
    let status = "needs_review";
    if (state === "COMPLETED") {
      status = "completed";
    } else if (state === "PENDING") {
      status = "pending";
    }

    // If merchant is well-known, bump confidence
    let confidenceScore = 0;
    if (merchant && merchant !== "Unknown") {
      confidenceScore = 70;
      // For high-confidence known merchants with completed state, mark as AI suggested
      if (state === "COMPLETED") {
        status = "ai_suggested";
      }
    }

    const paymentCurrency = getValue(row, idxPaymentCurrency);
    const currency = paymentCurrency || context.companyCurrency;

    let originalAmount: number | undefined;
    const origAmountStr = getValue(row, idxOrigAmount);
    if (origAmountStr) {
      const origParsed = parseAmount(origAmountStr, "uk_bank");
      if (origParsed) originalAmount = origParsed.amount;
    }

    const mainRow: NormalisedRow = {
      rowNumber,
      date: date || new Date().toISOString().slice(0, 10),
      merchant: merchant || "Unknown",
      description: description || reference || "Revolut transaction",
      amount: amountResult?.amount ?? 0,
      type: amountResult?.type ?? "expense",
      currency,
      originalAmount,
      originalCurrency: idxOrigCurrency >= 0 ? getValue(row, idxOrigCurrency) : undefined,
      status,
      confidenceScore,
      rawData,
      parseErrors: [],
    };

    rows.push(mainRow);

    // Fee transaction
    const feeStr = getValue(row, idxFee);
    const feeAmount = feeStr
      ? Math.abs(parseFloat(feeStr.replace(/[$£€¥₹,]/g, "")) || 0)
      : 0;
    if (feeAmount > 0) {
      const feeCategory =
        merchant === "STRIPE" || merchant === "PAYPAL"
          ? "Payment Processor Fees"
          : "Bank Fees";

      const feeRow: NormalisedRow = {
        rowNumber,
        date: mainRow.date,
        merchant: mainRow.merchant,
        description: `Fee: ${mainRow.description}`,
        amount: feeAmount,
        type: "expense",
        currency: mainRow.currency,
        category: feeCategory,
        status: "completed",
        confidenceScore: 95,
        rawData: {
          ...rawData,
          is_fee: "true",
          related_transaction_id: idValue,
        },
        parseErrors: [],
      };
      rows.push(feeRow);
    }
  }

  // Build mapping report via column mapper (for UI compatibility)
  const mappingReport = mapColumns(parsed);

  // Detect currency
  const currencyResult = detectCurrency(
    parsed.headers,
    parsed.rows,
    idxPaymentCurrency >= 0 ? idxPaymentCurrency : undefined,
    context.companyCurrency,
    context.companyCountry
  );

  return { rows, mappingReport, currencyResult, failedRows };
}
