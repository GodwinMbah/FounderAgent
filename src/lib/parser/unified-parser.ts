/**
 * Unified Parser
 * Provider-agnostic CSV parser that uses the adapter registry.
 * Entry point for all multi-provider ingestion.
 */

import { parseCsv } from "./csv-core";
import { parseAmount, parseDebitCredit } from "./amount-parser";
import { parseDate, detectDateFormat } from "./date-parser";
import { detectCurrency } from "./currency-detector";
import {
  detectProvider,
  getAdapter,
  buildColumnMapping,
} from "@/lib/providers/adapter-registry";
import type { ProviderAdapter } from "@/lib/providers/adapter-types";
import type {
  CanonicalTransaction,
  CanonicalParseResult,
} from "@/lib/providers/canonical-model";
import { isPersonalName as detectIsPersonalName } from "@/lib/intelligence/merchant-enrichment";
import { getCategoryFromMcc } from "@/lib/intelligence/mcc-categories";


export interface ParseOptions {
  companyId: string;
  companyCurrency?: string;
  companyCountry?: string;
  uploadId?: string;
  sourceTypeHint?: string;
}

function getValue(row: string[], index: number): string {
  if (index < 0 || index >= row.length) return "";
  return row[index]?.trim() ?? "";
}

function normaliseStatus(raw: string): string {
  const s = raw.toUpperCase().trim();
  if (s === "COMPLETED" || s === "SUCCESS" || s === "CLEARED" || s === "SETTLED") return "completed";
  if (s === "PENDING" || s === "PROCESSING" || s === "HELD") return "pending";
  if (s === "DECLINED" || s === "FAILED" || s === "CANCELLED" || s === "REVERSED") return "failed";
  if (s === "REFUNDED") return "refunded";
  return s.toLowerCase();
}

function inferDirectionFromType(
  typeRaw: string,
  adapter: ProviderAdapter
): { direction: "income" | "expense" | "transfer" | "fee" | "neutral"; category?: string } | null {
  const t = typeRaw.toUpperCase().trim();
  if (adapter.knownTransactionTypes?.[t]) {
    return adapter.knownTransactionTypes[t];
  }
  // Generic fallback patterns
  if (t.includes("TRANSFER") || t.includes("PAYOUT") || t.includes("WITHDRAWAL")) {
    return { direction: "transfer" };
  }
  if (t.includes("FEE") || t.includes("CHARGE")) {
    return { direction: "fee", category: "Bank Fees" };
  }
  if (t.includes("REFUND") || t.includes("RETURN")) {
    return { direction: "income", category: "Refunds" };
  }
  if (t.includes("PAYMENT") || t.includes("PURCHASE") || t.includes("DEBIT")) {
    return { direction: "expense" };
  }
  if (t.includes("DEPOSIT") || t.includes("CREDIT") || t.includes("TOPUP")) {
    return { direction: "income" };
  }
  return null;
}

function isTransferDescription(description: string, adapter: ProviderAdapter): boolean {
  const d = description.toUpperCase();
  if (adapter.transferPatterns) {
    for (const p of adapter.transferPatterns) {
      if (d.includes(p.toUpperCase())) return true;
    }
  }
  return false;
}

function toTitleCase(str: string): string {
  return str
    .toLowerCase()
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function cleanMerchantName(raw: string): string {
  if (!raw) return "Unknown";
  const cleaned = raw
    .replace(/\s+/g, " ")
    .trim();
  return cleaned || "Unknown";
}

function hashRow(headers: string[], row: string[]): string {
  const input = headers.map((header, index) => `${header}:${row[index] ?? ""}`).join("|");
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return `fnv1a:${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

function cleanCardPaymentMerchant(raw: string): string {
  let cleaned = raw.replace(/\s+/g, " ").trim();

  // Remove "Pending" suffix
  cleaned = cleaned.replace(/\s+Pending$/i, "");

  // Known payment-method prefixes → use suffix as merchant
  const paymentMethodPrefixes = [
    /^Klarna\s*\*\s*/i,
    /^Sumup\s*\*\s*/i,
    /^Paypal\s*\*\s*/i,
    /^Stripe\s*\*\s*/i,
  ];
  for (const pattern of paymentMethodPrefixes) {
    if (pattern.test(cleaned)) {
      cleaned = cleaned.replace(pattern, "").trim();
      break;
    }
  }

  // Known merchant prefixes with reference codes after *
  if (/^Facebk\s*\*/i.test(cleaned)) {
    cleaned = "Facebook";
  } else if (/^Canva\s*\*/i.test(cleaned)) {
    cleaned = "Canva";
  } else if (/^Remitly\s*\*/i.test(cleaned)) {
    cleaned = "Remitly";
  } else {
    // Replace remaining * with space (e.g., "Uber * Eats")
    cleaned = cleaned.replace(/\s*\*\s*/g, " ").trim();
  }

  // Remove common domain suffixes
  cleaned = cleaned.replace(/\.com$/i, "").replace(/\.co\.uk$/i, "");

  // Title-case common names (prefix match)
  const titleCaseMap: Record<string, string> = {
    openai: "OpenAI",
    highlevel: "HighLevel",
  };
  const words = cleaned.split(" ");
  const firstWordLower = words[0]?.toLowerCase();
  if (firstWordLower && titleCaseMap[firstWordLower]) {
    words[0] = titleCaseMap[firstWordLower];
    cleaned = words.join(" ");
  }

  // Title-case if the entire string is lowercase
  if (cleaned === cleaned.toLowerCase()) {
    cleaned = toTitleCase(cleaned);
  }

  return cleaned || "Unknown";
}

function extractMerchantFromDescription(
  description: string,
  reference?: string,
  transactionType?: string,
  sourceProvider?: string
): { merchantName: string; isPersonalName: boolean; counterpartyName?: string; descriptionOverride?: string } {
  const cleaned = description.replace(/\s+/g, " ").trim();
  if (!cleaned) return { merchantName: "Unknown", isPersonalName: false };

  // Revolut-specific type handling
  const typeUpper = (transactionType || "").toUpperCase();

  // TOPUP: strip common prefixes and extract source
  if (typeUpper.includes("TOPUP")) {
    const source = cleaned
      .replace(/^Money added from\s+/i, "")
      .replace(/^Top\s*up\s+from\s+/i, "")
      .trim();
    const merchant = toTitleCase(source);
    return { merchantName: merchant, isPersonalName: false, counterpartyName: merchant };
  }

  // FEE: special handling for Revolut Business Fee
  if (typeUpper.includes("FEE")) {
    if (/Revolut Business Fee/i.test(cleaned)) {
      return { merchantName: "Revolut", isPersonalName: false };
    }
    return { merchantName: sourceProvider || "Fee", isPersonalName: false };
  }

  // TRANSFER: extract counterparty from description
  if (typeUpper.includes("TRANSFER")) {
    const hasToFromPrefix = /^(To|From)\s+/i.test(cleaned);
    const counterparty = cleaned.replace(/^(To|From)\s+/i, "").trim();

    const isInternal = /^British Pound/i.test(counterparty);
    if (isInternal) {
      return {
        merchantName: "Internal Transfer",
        isPersonalName: false,
        counterpartyName: "British Pound",
        descriptionOverride: reference || cleaned,
      };
    }

    // If description doesn't have To/From prefix and is generic, fall back to reference for merchant
    if (!hasToFromPrefix && reference) {
      const genericWords = ["transfer", "bank transfer", "money transfer"];
      const isGeneric = genericWords.some((g) => cleaned.toLowerCase().includes(g));
      if (isGeneric) {
        return {
          merchantName: reference,
          isPersonalName: false,
          counterpartyName: counterparty,
          descriptionOverride: reference,
        };
      }
    }

    const merchant = counterparty || reference || "Transfer";
    return {
      merchantName: merchant,
      isPersonalName: detectIsPersonalName(counterparty),
      counterpartyName: counterparty || reference,
      descriptionOverride: reference || cleaned,
    };
  }

  // CARD_PAYMENT: description is the merchant name
  if (typeUpper.includes("CARD_PAYMENT") || typeUpper.includes("CARD PAYMENT")) {
    const merchant = cleanCardPaymentMerchant(cleaned);
    return { merchantName: merchant, isPersonalName: false };
  }

  const genericDescriptions = [
    "card payment",
    "transfer",
    "direct debit",
    "standing order",
    "bill payment",
    "payment",
    "card",
  ];
  const descLower = cleaned.toLowerCase();
  const isGeneric = genericDescriptions.some(
    (g) => descLower === g || descLower.startsWith(g + " ")
  );

  let withoutPrefix: string;
  if (isGeneric && reference) {
    withoutPrefix = reference
      .replace(/^(POS|CARD|PURCHASE|PAYMENT|TRANSFER|DIRECT DEBIT|STANDING ORDER|BILL PAYMENT)\s*/i, "")
      .trim();
  } else {
    withoutPrefix = cleaned
      .replace(/^(POS|CARD|PURCHASE|PAYMENT|TRANSFER|DIRECT DEBIT|STANDING ORDER|BILL PAYMENT)\s*/i, "")
      .trim();
  }

  const parts = withoutPrefix.split(" ");
  const wordCount = Math.min(parts.length, 3);
  const result = parts.slice(0, wordCount).join(" ");

  if (detectIsPersonalName(result)) {
    return { merchantName: "Personal", isPersonalName: true };
  }

  return { merchantName: result || "Unknown", isPersonalName: false };
}

/**
 * Parse a CSV text into canonical transactions using the adapter registry.
 */
export function parseUpload(csvText: string, options: ParseOptions): CanonicalParseResult {
  const parsed = parseCsv(csvText);
  const headers = parsed.headers;
  const rows = parsed.rows;

  console.log(`[UnifiedParser] ${rows.length} rows, ${headers.length} cols, delimiter=${JSON.stringify(parsed.delimiter)}`);

  // Detect provider (or use explicit hint)
  let adapter: ProviderAdapter;
  let providerConfidence: number;

  if (options.sourceTypeHint && options.sourceTypeHint !== "auto_detect") {
    const hintAdapter = getAdapter(options.sourceTypeHint);
    if (hintAdapter) {
      adapter = hintAdapter;
      providerConfidence = 100;
    } else {
      const providerMatches = detectProvider(parsed);
      const bestMatch = providerMatches[0];
      adapter = bestMatch?.provider ?? getAdapter("manual_csv")!;
      providerConfidence = bestMatch?.score ?? 0;
    }
  } else {
    const providerMatches = detectProvider(parsed);
    const bestMatch = providerMatches[0];
    adapter = bestMatch?.provider ?? getAdapter("manual_csv")!;
    providerConfidence = bestMatch?.score ?? 0;
  }

  console.log(`[UnifiedParser] detected provider: ${adapter.id} (${adapter.displayName}) confidence=${providerConfidence}`);

  // Build column mapping
  const mapping = buildColumnMapping(headers, adapter);
  console.log(`[UnifiedParser] mapped fields: ${Object.keys(mapping).join(", ")}`);

  // Detect currency
  const currencyIdx = mapping.currency?.index ?? mapping.originalCurrency?.index ?? -1;
  const currencyResult = detectCurrency(
    headers,
    rows,
    currencyIdx >= 0 ? currencyIdx : undefined,
    options.companyCurrency,
    options.companyCountry
  );

  // Detect date format from samples
  const dateSamples: string[] = [];
  const dateIdx = mapping.transactionDate?.index ?? -1;
  if (dateIdx >= 0) {
    for (const row of rows.slice(0, 20)) {
      const v = getValue(row, dateIdx);
      if (v) dateSamples.push(v);
    }
  }
  const dateFormatDetection = detectDateFormat(dateSamples, options.companyCountry);

  // Parse rows
  const transactions: CanonicalTransaction[] = [];
  const failedRows: CanonicalParseResult["failedRows"] = [];

  for (let i = 0; i < rows.length; i++) {
    const rowNumber = i + 2; // 1-based, skipping header
    const row = rows[i];
    const errors: string[] = [];

    if (row.length < 2) {
      failedRows.push({ rowNumber, rawRow: row, errors: ["Row too short"] });
      continue;
    }

    // ── Date ──
    let transactionDate = "";
    if (dateIdx >= 0) {
      const dateStr = getValue(row, dateIdx);
      if (dateStr) {
        const dateResult = parseDate(dateStr, options.companyCountry);
        if (dateResult.valid && dateResult.date) {
          transactionDate = dateResult.date;
        } else {
          errors.push(dateResult.error || "Invalid date");
        }
      } else {
        errors.push("Missing date");
      }
    } else {
      errors.push("No date column mapped");
    }

    // ── Posted date ──
    let postedDate: string | undefined;
    const postedIdx = mapping.postedDate?.index ?? -1;
    if (postedIdx >= 0) {
      const postedStr = getValue(row, postedIdx);
      if (postedStr) {
        const postedResult = parseDate(postedStr, options.companyCountry);
        if (postedResult.valid && postedResult.date) {
          postedDate = postedResult.date;
        }
      }
    }

    // ── Reference ──
    let reference: string | undefined;
    const refIdx = mapping.reference?.index ?? -1;
    if (refIdx >= 0) reference = getValue(row, refIdx);

    // ── External Transaction ID ──
    let externalTransactionId: string | undefined;
    const extIdIdx = mapping.externalTransactionId?.index ?? -1;
    if (extIdIdx >= 0) externalTransactionId = getValue(row, extIdIdx);

    // ── Transaction Type ──
    let transactionType: string | undefined;
    const typeIdx = mapping.transactionType?.index ?? -1;
    if (typeIdx >= 0) transactionType = getValue(row, typeIdx);

    // ── Description & Merchant ──
    let description = "";
    const descIdx = mapping.description?.index ?? -1;
    if (descIdx >= 0) {
      description = getValue(row, descIdx);
    }
    const originalDescription = description;

    let merchantName = "";
    let isPersonalName = false;
    let extractedCounterparty: string | undefined;
    let descriptionOverride: string | undefined;
    const merchantIdx = mapping.merchantName?.index ?? -1;
    if (merchantIdx >= 0 && merchantIdx !== descIdx) {
      // Dedicated merchant column — use it directly
      merchantName = cleanMerchantName(getValue(row, merchantIdx));
    }
    // Always run extraction for:
    // - No dedicated merchant column
    // - Merchant column IS the description column (needs type-aware parsing)
    if ((!merchantName || merchantIdx === descIdx) && description) {
      const extracted = extractMerchantFromDescription(
        description,
        reference,
        transactionType,
        adapter.displayName
      );
      merchantName = extracted.merchantName;
      isPersonalName = extracted.isPersonalName;
      extractedCounterparty = extracted.counterpartyName;
      descriptionOverride = extracted.descriptionOverride;
    }
    if (!description && merchantName) {
      description = merchantName;
    }
    if (descriptionOverride) {
      description = descriptionOverride;
    }
    if (!description) errors.push("Missing description");

    // ── Status ──
    let status = "needs_review";
    const statusIdx = mapping.status?.index ?? -1;
    if (statusIdx >= 0) {
      const statusRaw = getValue(row, statusIdx);
      if (statusRaw) {
        const norm = normaliseStatus(statusRaw);
        if (norm === "failed" || norm === "declined" || norm === "reversed") {
          // Skip failed transactions entirely
          continue;
        }
        status = norm === "completed" ? "completed" : norm === "pending" ? "pending" : "needs_review";
      }
    }

    // ── Amount ──
    let amountResult: { amount: number; type: "income" | "expense"; currency?: string } | null = null;
    let feeAmount: number | undefined;

    const amountIdx = mapping.amount?.index ?? -1;
    const debitIdx = mapping.debitAmount?.index ?? -1;
    const creditIdx = mapping.creditAmount?.index ?? -1;
    const feeIdx = mapping.feeAmount?.index ?? -1;

    // Extract fee first if separate column
    if (feeIdx >= 0 && adapter.feeHandling === "separate_column") {
      const feeStr = getValue(row, feeIdx);
      if (feeStr) {
        const feeParsed = parseAmount(feeStr, adapter.signConvention);
        feeAmount = feeParsed.amount;
      }
    }

    // Parse amount based on column structure
    if (adapter.hasSplitAmountColumns && debitIdx >= 0 && creditIdx >= 0) {
      const debitStr = getValue(row, debitIdx);
      const creditStr = getValue(row, creditIdx);
      const dcResult = parseDebitCredit(debitStr, creditStr);
      if (dcResult) {
        amountResult = dcResult;
      }
    } else if (amountIdx >= 0) {
      const amountStr = getValue(row, amountIdx);
      if (amountStr) {
        let typeHint: string | undefined;
        if (transactionType) {
          const dir = inferDirectionFromType(transactionType, adapter);
          if (dir) typeHint = dir.direction;
        }
        amountResult = parseAmount(amountStr, adapter.signConvention);
        // Override type if type hint exists
        if (typeHint === "income") amountResult.type = "income";
        if (typeHint === "expense") amountResult.type = "expense";
      }
    }

    if (!amountResult || amountResult.amount === 0) {
      errors.push("Missing or invalid amount");
    }

    // ── Currency ──
    let currency = options.companyCurrency || "GBP";
    const currencyColIdx = mapping.currency?.index ?? -1;
    if (currencyColIdx >= 0) {
      const currencyStr = getValue(row, currencyColIdx);
      if (currencyStr) currency = currencyStr.toUpperCase();
    } else if (adapter.fixedCurrency) {
      currency = adapter.fixedCurrency;
    } else if (amountResult?.currency) {
      currency = amountResult.currency;
    } else if (currencyResult.currency) {
      currency = currencyResult.currency;
    }

    // ── Original currency / amount ──
    let originalCurrency: string | undefined;
    const origCurrIdx = mapping.originalCurrency?.index ?? -1;
    if (origCurrIdx >= 0) originalCurrency = getValue(row, origCurrIdx);

    let originalAmount: number | undefined;
    const origAmtIdx = mapping.originalAmount?.index ?? -1;
    if (origAmtIdx >= 0) {
      const origAmtStr = getValue(row, origAmtIdx);
      if (origAmtStr) {
        const origParsed = parseAmount(origAmtStr, adapter.signConvention);
        if (origParsed.amount > 0) originalAmount = origParsed.amount;
      }
    }

    // ── Exchange rate ──
    let exchangeRate: number | undefined;
    const rateIdx = mapping.exchangeRate?.index ?? -1;
    if (rateIdx >= 0) {
      const rateStr = getValue(row, rateIdx);
      if (rateStr) exchangeRate = parseFloat(rateStr) || undefined;
    }

    // ── Fee currency ──
    let feeCurrency: string | undefined;
    const feeCurrencyIdx = mapping.feeCurrency?.index ?? -1;
    if (feeCurrencyIdx >= 0) {
      feeCurrency = getValue(row, feeCurrencyIdx).toUpperCase();
    }

    // ── Balance ──
    let runningBalance: number | undefined;
    const balanceIdx = mapping.runningBalance?.index ?? -1;
    if (balanceIdx >= 0) {
      const balanceStr = getValue(row, balanceIdx);
      if (balanceStr) {
        const balanceParsed = parseAmount(balanceStr, adapter.signConvention);
        runningBalance = balanceParsed.amount;
      }
    }

    // ── Account ──
    let accountName: string | undefined;
    const acctNameIdx = mapping.accountName?.index ?? -1;
    if (acctNameIdx >= 0) accountName = getValue(row, acctNameIdx);

    let accountNumber: string | undefined;
    const acctNumIdx = mapping.accountNumber?.index ?? -1;
    if (acctNumIdx >= 0) accountNumber = getValue(row, acctNumIdx);

    // ── MCC ──
    let merchantCategoryCode: string | undefined;
    const mccIdx = mapping.merchantCategoryCode?.index ?? -1;
    if (mccIdx >= 0) merchantCategoryCode = getValue(row, mccIdx);

    // ── Counterparty ──
    let counterpartyName: string | undefined;
    const cpIdx = mapping.counterpartyName?.index ?? -1;
    if (cpIdx >= 0) counterpartyName = getValue(row, cpIdx);

    // For Revolut TRANSFER and TOPUP, the description contains the actual counterparty
    const typeUpper = (transactionType || "").toUpperCase();
    if (extractedCounterparty && (typeUpper.includes("TRANSFER") || typeUpper.includes("TOPUP"))) {
      counterpartyName = extractedCounterparty;
    } else if (!counterpartyName && extractedCounterparty) {
      counterpartyName = extractedCounterparty;
    }

    // ── Build raw data preservation ──
    const rawData: Record<string, string> = {};
    for (let h = 0; h < headers.length; h++) {
      rawData[headers[h]] = row[h] || "";
    }

    // ── Transfer pair ID ──
    let transferPairId: string | undefined;
    const relatedTxId = rawData["Related transaction id"] || rawData["Related Transaction ID"];
    if (relatedTxId) transferPairId = relatedTxId;

    // ── Transfer detection ──
    let isTransfer = false;
    if (transactionType) {
      const dir = inferDirectionFromType(transactionType, adapter);
      if (dir?.direction === "transfer") isTransfer = true;
    }
    const transferSignalText = `${description} ${originalDescription}`.trim();
    if (!isTransfer && transferSignalText && !typeUpper.includes("TOPUP") && isTransferDescription(transferSignalText, adapter)) {
      isTransfer = true;
    }

    // ── Fee detection ──
    let isFee = false;
    if (transactionType) {
      const dir = inferDirectionFromType(transactionType, adapter);
      if (dir?.direction === "fee") isFee = true;
    }
    if (feeAmount && feeAmount > 0 && !amountResult) {
      // Fee-only row
      isFee = true;
    }

    // ── Category inference (basic) ──
    let category: string | undefined;
    if (isTransfer) category = "Transfers";
    else if (isFee) category = adapter.type === "payment_processor" ? "Payment Processor Fees" : "Bank Fees";

    // MCC-based category provides more specific hint than generic type categories
    if (!category && merchantCategoryCode) {
      category = getCategoryFromMcc(merchantCategoryCode);
    }

    if (!category && transactionType) {
      const dir = inferDirectionFromType(transactionType, adapter);
      if (dir?.category) category = dir.category;
    }
    if (!category && adapter.defaultCategoryRules) {
      const combined = `${merchantName} ${description}`.toUpperCase();
      for (const rule of adapter.defaultCategoryRules) {
        if (combined.includes(rule.pattern.toUpperCase())) {
          category = rule.category;
          break;
        }
      }
    }

    // If errors, add to failed rows
    if (errors.length > 0) {
      failedRows.push({ rowNumber, rawRow: row, errors });
      continue;
    }

    // ── Final amount ──
    const absAmount = amountResult!.amount;
    const direction = amountResult!.type;
    const signedAmount = direction === "income" ? absAmount : -absAmount;

    // Calculate row-level confidence from provider and mapping quality
    const mappingConfidences = Object.values(mapping).map((m) => m.confidence);
    const mappingConfidence = mappingConfidences.length > 0
      ? Math.round(mappingConfidences.reduce((s, c) => s + c, 0) / mappingConfidences.length)
      : 0;
    const rowConfidence = Math.max(providerConfidence, mappingConfidence);

    // Build canonical transaction
    const canonical: CanonicalTransaction = {
      transactionDate: transactionDate || new Date().toISOString().slice(0, 10),
      postedDate,
      externalTransactionId,
      transactionType,
      merchantName: merchantName || "Unknown",
      description: description || reference || `${adapter.displayName} transaction`,
      reference,
      counterpartyName,
      amount: signedAmount,
      debitAmount: debitIdx >= 0 ? parseAmount(getValue(row, debitIdx)).amount : undefined,
      creditAmount: creditIdx >= 0 ? parseAmount(getValue(row, creditIdx)).amount : undefined,
      currency,
      originalCurrency,
      originalAmount,
      exchangeRate,
      feeAmount,
      feeCurrency: feeCurrency || (feeAmount ? currency : undefined),
      runningBalance,
      accountName,
      accountNumber,
      category,
      merchantCategoryCode,
      status: isTransfer ? "transfer" : status,
      confidenceScore: rowConfidence,
      sourceProvider: adapter.id,
      sourceFileId: options.uploadId,
      sourceRowNumber: rowNumber,
      rawRowHash: hashRow(headers, row),
      rowStatus: isTransfer ? "transfer" : status === "completed" ? "valid" : status,
      kpiExcluded: isTransfer,
      kpiExclusionReason: isTransfer ? "transfer" : undefined,
      isTransfer,
      isFee,
      isPossibleDuplicate: false,
      isPersonalName,
      transferPairId,
      rawData,
      parseErrors: [],
    };

    transactions.push(canonical);
  }

  // Find latest balance
  let latestBalance: number | undefined;
  for (let i = transactions.length - 1; i >= 0; i--) {
    if (transactions[i].runningBalance !== undefined) {
      latestBalance = transactions[i].runningBalance;
      break;
    }
  }

  return {
    transactions,
    detectedProvider: adapter.id,
    providerConfidence,
    detectedDelimiter: parsed.delimiter,
    detectedHeaderRow: 0, // csv-core already handles smart header detection
    columnCount: headers.length,
    rowCount: rows.length,
    failedRows,
    detectedCurrency: currencyResult.currency,
    detectedDateFormat: dateFormatDetection.format,
    accountName: transactions[0]?.accountName,
    latestBalance,
  };
}
