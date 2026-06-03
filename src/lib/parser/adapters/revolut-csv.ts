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
import { detectCurrency } from "../currency-detector";

// Fuzzy header matching: exact = 100, substring = 75, contains-pattern = 60
function scoreHeaderMatch(header: string, patterns: string[]): number {
  const h = header.toLowerCase().trim().replace(/^["']|["']$/g, "").replace(/\s+/g, " ");
  for (const p of patterns) {
    if (h === p) return 100;
    if (h.includes(p)) return 75;
  }
  // Reverse: does pattern include header? (e.g. header="date" vs pattern="date completed")
  for (const p of patterns) {
    if (p.includes(h) && h.length > 2) return 60;
  }
  return 0;
}

function getColumnIndex(headers: string[], names: string[]): number {
  let bestIdx = -1;
  let bestScore = 0;
  for (let i = 0; i < headers.length; i++) {
    const score = scoreHeaderMatch(headers[i], names);
    if (score > bestScore) {
      bestScore = score;
      bestIdx = i;
    }
  }
  return bestIdx;
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

  // Revolut-specific fuzzy patterns
  const idxDateCompleted = getColumnIndex(headers, [
    "date completed utc", "date completed", "completed date", "completed_date", "date_completed",
    "date completed (utc)", "completed date (utc)",
  ]);
  const idxDateStarted = getColumnIndex(headers, [
    "date started utc", "date started", "started date", "started_date", "date_started",
    "date started (utc)", "started date (utc)",
  ]);
  const idxId = getColumnIndex(headers, ["id", "transaction id", "transaction_id"]);
  const idxDescription = getColumnIndex(headers, [
    "description", "desc", "details", "transaction description", "transaction_description",
  ]);
  const idxReference = getColumnIndex(headers, [
    "reference", "ref", "payment reference", "payment_reference", "original reference",
  ]);
  const idxType = getColumnIndex(headers, ["type", "transaction type", "transaction_type"]);
  const idxState = getColumnIndex(headers, ["state", "status", "transaction state", "transaction_state"]);
  const idxAmount = getColumnIndex(headers, [
    "amount", "transaction amount", "transaction_amount", "net amount", "net_amount",
  ]);
  const idxTotalAmount = getColumnIndex(headers, [
    "total amount", "total_amount", "gross amount", "gross_amount",
  ]);
  const idxFee = getColumnIndex(headers, ["fee", "transaction fee", "transaction_fee", "fees"]);
  const idxBalance = getColumnIndex(headers, [
    "balance", "running balance", "running_balance", "account balance", "account_balance",
  ]);
  const idxAccount = getColumnIndex(headers, [
    "account", "account name", "account_name", "account id", "account_id",
  ]);
  const idxMcc = getColumnIndex(headers, [
    "mcc", "merchant category code", "merchant_category_code",
  ]);
  const idxOrigCurrency = getColumnIndex(headers, [
    "orig currency", "orig_currency", "original currency", "original_currency", "orig. currency",
  ]);
  const idxOrigAmount = getColumnIndex(headers, [
    "orig amount", "orig_amount", "original amount", "original_amount", "orig. amount",
  ]);
  const idxPaymentCurrency = getColumnIndex(headers, [
    "payment currency", "payment_currency", "payment ccy", "payment_ccy",
  ]);
  const idxRelatedTransactionId = getColumnIndex(headers, [
    "related transaction id", "related_transaction_id", "related id", "related_id",
  ]);

  // Log what we found for diagnostics
  const foundCols: string[] = [];
  const missedCols: string[] = [];
  const checkCol = (name: string, idx: number) => {
    if (idx >= 0) foundCols.push(`${name}=${headers[idx]}`);
    else missedCols.push(name);
  };
  checkCol("dateCompleted", idxDateCompleted);
  checkCol("dateStarted", idxDateStarted);
  checkCol("amount", idxAmount);
  checkCol("totalAmount", idxTotalAmount);
  checkCol("description", idxDescription);
  checkCol("state", idxState);
  checkCol("type", idxType);
  checkCol("fee", idxFee);
  checkCol("balance", idxBalance);
  checkCol("origCurrency", idxOrigCurrency);
  checkCol("origAmount", idxOrigAmount);
  checkCol("paymentCurrency", idxPaymentCurrency);
  checkCol("relatedTransactionId", idxRelatedTransactionId);

  console.log("[RevolutAdapter] headers:", headers.slice(0, 10).join(", "), "...");
  console.log("[RevolutAdapter] found:", foundCols.join(" | "));
  if (missedCols.length > 0) console.warn("[RevolutAdapter] missed:", missedCols.join(" | "));

  // Fallback to generic column mapper if critical Revolut columns are missing
  let genericMapping: MappingReport | undefined;
  const hasDate = idxDateCompleted >= 0 || idxDateStarted >= 0;
  const hasAmount = idxAmount >= 0 || idxTotalAmount >= 0;

  if (!hasDate || !hasAmount) {
    console.warn("[RevolutAdapter] Critical columns missing. Falling back to generic column mapper.");
    genericMapping = mapColumns(parsed);
  }

  // If still no date/amount after fallback, return diagnostic failed row
  const finalHasDate = hasDate || (genericMapping?.mapping.date !== undefined);
  const finalHasAmount = hasAmount || (genericMapping?.mapping.amount !== undefined);

  if (!finalHasDate || !finalHasAmount) {
    console.error("[RevolutAdapter] No date/amount columns found even with generic mapper.");
    failedRows.push({
      rowNumber: 1,
      rawRow: headers,
      errors: ["Revolut headers not recognised — falling back to generic parser"],
    });
    const emptyMappingReport = mapColumns(parsed);
    const currencyResult = detectCurrency(
      parsed.headers,
      parsed.rows,
      undefined,
      context.companyCurrency,
      context.companyCountry
    );
    return { rows: [], mappingReport: emptyMappingReport, currencyResult, failedRows };
  }

  // Helper to resolve column index: prefer Revolut-specific, fallback to generic
  const resolveIdx = (revolutIdx: number, genericField: keyof MappingReport["mapping"]): number => {
    if (revolutIdx >= 0) return revolutIdx;
    if (genericMapping?.mapping[genericField]?.index !== undefined) {
      return genericMapping.mapping[genericField]!.index;
    }
    return -1;
  };

  const effectiveDateIdx = resolveIdx(idxDateCompleted, "date");
  const effectiveDateStartedIdx = idxDateStarted >= 0 ? idxDateStarted : genericMapping?.mapping.date?.index ?? -1;
  const effectiveAmountIdx = resolveIdx(idxAmount, "amount");
  const effectiveTotalAmountIdx = resolveIdx(idxTotalAmount, "totalAmount");
  const effectiveDescriptionIdx = resolveIdx(idxDescription, "description");
  const effectiveReferenceIdx = resolveIdx(idxReference, "reference");
  const effectiveTypeIdx = resolveIdx(idxType, "type");
  const effectiveStateIdx = resolveIdx(idxState, "state");
  const effectiveFeeIdx = resolveIdx(idxFee, "fee");
  const effectiveBalanceIdx = resolveIdx(idxBalance, "balance");
  const effectiveAccountIdx = resolveIdx(idxAccount, "accountName");
  const effectiveMccIdx = resolveIdx(idxMcc, "mcc");
  const effectiveOrigCurrencyIdx = resolveIdx(idxOrigCurrency, "originalCurrency");
  const effectiveOrigAmountIdx = resolveIdx(idxOrigAmount, "originalAmount");
  const effectivePaymentCurrencyIdx = resolveIdx(idxPaymentCurrency, "paymentCurrency");
  const effectiveRelatedTransactionIdIdx = resolveIdx(idxRelatedTransactionId, "relatedTransactionId");

  for (let i = 0; i < parsed.rows.length; i++) {
    const rowNumber = i + 2; // 1-based, skipping header
    const row = parsed.rows[i];
    const errors: string[] = [];

    // Skip rows that are clearly empty or too short
    if (row.length < 2) {
      failedRows.push({ rowNumber, rawRow: row, errors: ["Row too short"] });
      continue;
    }

    const state = getValue(row, effectiveStateIdx).toUpperCase();
    if (state === "DECLINED" || state === "REVERSED" || state === "FAILED") {
      continue;
    }

    // Parse date: prefer Date Completed, fallback to Date Started
    const dateStr = getValue(row, effectiveDateIdx) || getValue(row, effectiveDateStartedIdx);
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
    const description = getValue(row, effectiveDescriptionIdx);
    const reference = getValue(row, effectiveReferenceIdx);
    const merchant = description ? extractMerchant(description) : "";

    // Amount logic
    let amountStr = getValue(row, effectiveAmountIdx);
    if (!amountStr) {
      amountStr = getValue(row, effectiveTotalAmountIdx);
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
    const typeValue = getValue(row, effectiveTypeIdx).toUpperCase();
    if (typeValue) rawData["transaction_type_hint"] = typeValue;
    if (state) rawData["state"] = state;
    if (effectiveBalanceIdx >= 0) rawData["balance"] = getValue(row, effectiveBalanceIdx);
    if (effectiveAccountIdx >= 0) rawData["account_name"] = getValue(row, effectiveAccountIdx);
    if (effectiveMccIdx >= 0) rawData["mcc"] = getValue(row, effectiveMccIdx);
    if (effectiveRelatedTransactionIdIdx >= 0) {
      rawData["related_transaction_id"] = getValue(row, effectiveRelatedTransactionIdIdx);
    }

    const transferEvidence = `${description} ${reference}`.toLowerCase();
    const isTransfer = typeValue === "TRANSFER" && [
      "internal transfer",
      "from british pound",
      "to british pound",
      "business savings",
      "currency exchange",
      "capital on tap",
      "capital one",
      "moneyway",
      "close brothers",
      "credit card repayment",
      "loan repayment",
      "owner transfer",
      "director loan",
      "shareholder",
      "capital injection",
      "capital repayment",
    ].some((signal) => transferEvidence.includes(signal));
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

    const paymentCurrency = getValue(row, effectivePaymentCurrencyIdx);
    const currency = paymentCurrency || context.companyCurrency;

    let originalAmount: number | undefined;
    const origAmountStr = getValue(row, effectiveOrigAmountIdx);
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
      originalCurrency: effectiveOrigCurrencyIdx >= 0 ? getValue(row, effectiveOrigCurrencyIdx) : undefined,
      status,
      confidenceScore,
      rawData,
      parseErrors: [],
    };

    rows.push(mainRow);

    // Fee transaction
    const feeStr = getValue(row, effectiveFeeIdx);
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
  const mappingReport = genericMapping ?? mapColumns(parsed);

  // Detect currency
  const currencyResult = detectCurrency(
    parsed.headers,
    parsed.rows,
    effectivePaymentCurrencyIdx >= 0 ? effectivePaymentCurrencyIdx : undefined,
    context.companyCurrency,
    context.companyCountry
  );

  console.log(
    `[RevolutAdapter] parsed ${rows.length} rows, ${failedRows.length} failed, currency=${currencyResult.currency}`
  );

  return { rows, mappingReport, currencyResult, failedRows };
}
