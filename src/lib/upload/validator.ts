/**
 * File validation for CSV/TSV uploads
 * Checks type, size, emptiness, readability, and required columns
 */

export interface FileValidationResult {
  valid: boolean;
  error?: string;
  mimeType?: string;
  extension?: string;
  rowCount?: number;
  columnCount?: number;
  hasDateColumn?: boolean;
  hasAmountColumn?: boolean;
  hasDescriptionColumn?: boolean;
  headers?: string[];
  previewRows?: string[][];
}

const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024; // 20MB
const MAX_PREVIEW_ROWS = 5;

const ALLOWED_EXTENSIONS = ["csv", "txt", "tsv", "xlsx", "xls"];
const ALLOWED_MIME_TYPES = [
  "text/csv",
  "text/plain",
  "text/tab-separated-values",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
];

function getExtension(filename: string): string {
  const parts = filename.split(".");
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : "";
}

function detectDelimiter(firstLine: string): string {
  // Count occurrences of common delimiters
  const tabCount = (firstLine.match(/\t/g) || []).length;
  const commaCount = (firstLine.match(/,/g) || []).length;
  const semiCount = (firstLine.match(/;/g) || []).length;

  if (tabCount > commaCount && tabCount > semiCount) return "\t";
  if (semiCount > commaCount && semiCount > tabCount) return ";";
  return ",";
}

function parseCsvLine(line: string, delimiter: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === delimiter && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

function cleanHeader(header: string): string {
  return header.toLowerCase().trim().replace(/^["']|["']$/g, "").replace(/\s+/g, " ");
}

const DATE_COLUMN_PATTERNS = [
  "date", "transaction date", "posted date", "booking date", "value date",
  "created", "created date", "transaction_date", "posting_date", "booking_date",
  "value_date", "created_date", "date posted", "date booked",
];

const DESCRIPTION_COLUMN_PATTERNS = [
  "description", "details", "reference", "memo", "narrative",
  "transaction description", "payment reference", "payee", "name",
  "counterparty", "customer", "supplier", "transaction_description",
  "payment_reference",
];

const MERCHANT_COLUMN_PATTERNS = [
  "merchant", "vendor", "payee", "name", "counterparty",
  "customer", "supplier", "recipient", "to",
];

const AMOUNT_COLUMN_PATTERNS = [
  "amount", "transaction amount", "gross", "net", "total",
  "transaction_amount", "amount ($)", "amount (£)", "amount (€)",
  "value", "transaction value",
];

const DEBIT_COLUMN_PATTERNS = [
  "debit", "money out", "paid out", "withdrawal", "outflow",
  "money_out", "paid_out", "debit amount", "debit_amount", "out",
];

const CREDIT_COLUMN_PATTERNS = [
  "credit", "money in", "paid in", "deposit", "inflow",
  "money_in", "paid_in", "credit amount", "credit_amount", "in",
];

const CURRENCY_COLUMN_PATTERNS = [
  "currency", "currency code", "ccy", "curr", "currency_code",
];

const BALANCE_COLUMN_PATTERNS = [
  "balance", "running balance", "closing balance", "available balance",
  "running_balance", "closing_balance", "available_balance",
];

export function findColumnIndex(headers: string[], patterns: string[]): number {
  for (let i = 0; i < headers.length; i++) {
    const h = cleanHeader(headers[i]);
    for (const pattern of patterns) {
      if (h === pattern || h.includes(pattern)) return i;
    }
  }
  return -1;
}

export async function validateFile(file: File): Promise<FileValidationResult> {
  // 1. File exists
  if (!file || file.size === 0) {
    return { valid: false, error: "No file provided or file is empty" };
  }

  // 2. File size
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return {
      valid: false,
      error: `File too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Maximum is 20MB.`,
    };
  }

  // 3. Extension
  const extension = getExtension(file.name);
  const isXlsx = extension === "xlsx" || extension === "xls";
  if (!ALLOWED_EXTENSIONS.includes(extension)) {
    return {
      valid: false,
      error: `Unsupported file type: .${extension}. Please upload a CSV, TXT, TSV, or XLSX file.`,
      extension,
    };
  }

  // 4. Read file
  let headers: string[] = [];
  let lines: string[] = [];
  let delimiter = ",";

  if (isXlsx) {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const { parseXlsx } = await import("@/lib/parser/xlsx-adapter");
      const parsed = parseXlsx(arrayBuffer);
      headers = parsed.headers;
      lines = parsed.rows.map((row) => row.join(","));
      if (headers.length < 2) {
        return { valid: false, error: `File has only ${headers.length} column(s). At least 2 columns are required.` };
      }
      if (parsed.rows.length < 1) {
        return { valid: false, error: "Excel file has no data rows." };
      }
    } catch {
      return { valid: false, error: "Could not read Excel file. Please try a different file." };
    }
  } else {
    let text: string;
    try {
      text = await file.text();
    } catch {
      return { valid: false, error: "Could not read file contents. Please try a different file." };
    }

    // 5. Not empty after reading
    if (!text.trim()) {
      return { valid: false, error: "File is empty (no readable content)." };
    }

    // 6. Parse lines
    lines = text.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0);
    if (lines.length < 2) {
      return { valid: false, error: "File has no data rows. At least a header and one data row are required." };
    }

    // 7. Detect delimiter and parse headers
    delimiter = detectDelimiter(lines[0]);
    headers = parseCsvLine(lines[0], delimiter);
    if (headers.length < 2) {
      return { valid: false, error: `File has only ${headers.length} column(s). At least 2 columns are required.` };
    }
  }

  // 8. Check required columns
  const hasDateColumn = findColumnIndex(headers, DATE_COLUMN_PATTERNS) !== -1;
  const hasAmountColumn =
    findColumnIndex(headers, AMOUNT_COLUMN_PATTERNS) !== -1 ||
    findColumnIndex(headers, DEBIT_COLUMN_PATTERNS) !== -1 ||
    findColumnIndex(headers, CREDIT_COLUMN_PATTERNS) !== -1;
  const hasDescriptionColumn =
    findColumnIndex(headers, DESCRIPTION_COLUMN_PATTERNS) !== -1 ||
    findColumnIndex(headers, MERCHANT_COLUMN_PATTERNS) !== -1;

  if (!hasDateColumn) {
    return {
      valid: false,
      error: `Could not find a date column. Expected one of: Date, Transaction Date, Posted Date, etc. Detected columns: ${headers.join(", ")}`,
      headers,
      columnCount: headers.length,
      rowCount: lines.length - 1,
    };
  }

  if (!hasAmountColumn) {
    return {
      valid: false,
      error: `Could not find an amount column. Expected one of: Amount, Debit, Credit, Money In, Money Out, etc. Detected columns: ${headers.join(", ")}`,
      headers,
      columnCount: headers.length,
      rowCount: lines.length - 1,
      hasDateColumn,
    };
  }

  if (!hasDescriptionColumn) {
    return {
      valid: false,
      error: `Could not find a description or merchant column. Expected one of: Description, Reference, Merchant, Payee, etc. Detected columns: ${headers.join(", ")}`,
      headers,
      columnCount: headers.length,
      rowCount: lines.length - 1,
      hasDateColumn,
      hasAmountColumn,
    };
  }

  // 9. Preview rows
  const previewRows = lines.slice(1, 1 + MAX_PREVIEW_ROWS).map((line) => parseCsvLine(line, delimiter));

  return {
    valid: true,
    mimeType: file.type || "text/csv",
    extension,
    rowCount: lines.length - 1,
    columnCount: headers.length,
    hasDateColumn,
    hasAmountColumn,
    hasDescriptionColumn,
    headers,
    previewRows,
  };
}
