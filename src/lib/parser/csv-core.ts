/**
 * Robust CSV/TSV parser with RFC 4180 quote handling and delimiter detection
 * Delegates to PapaParse when available for production-grade parsing
 */

import { parseCsvWithPapa } from "./csv-papaparse";

export interface ParsedCsv {
  headers: string[];
  rows: string[][];
  delimiter: string;
  rowCount: number;
  columnCount: number;
}

export function detectDelimiter(text: string): string {
  const firstLine = text.split(/\r?\n/).find((l) => l.trim().length > 0) || "";
  const tabCount = (firstLine.match(/\t/g) || []).length;
  const commaCount = (firstLine.match(/,/g) || []).length;
  const semiCount = (firstLine.match(/;/g) || []).length;

  if (tabCount > commaCount && tabCount > semiCount) return "\t";
  if (semiCount > commaCount && semiCount > tabCount) return ";";
  return ",";
}

export function parseCsvLine(line: string, delimiter: string = ","): string[] {
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

// Common column-name keywords used for smart header detection
const HEADER_KEYWORDS = [
  "date", "amount", "description", "merchant", "balance", "currency",
  "type", "reference", "debit", "credit", "fee", "total", "name",
  "status", "state", "id", "account", "category",
];

function looksLikeHeaderRow(cells: string[]): boolean {
  // Must have at least 2 columns
  if (cells.length < 2) return false;

  // Must contain at least 2 header-like keywords
  let keywordMatches = 0;
  for (const cell of cells) {
    const lowered = cell.toLowerCase().trim();
    if (HEADER_KEYWORDS.some((k) => lowered.includes(k))) {
      keywordMatches++;
    }
  }
  if (keywordMatches < 2) return false;

  // Must NOT look like a data row (e.g. mostly numbers, single value, etc.)
  const numericCells = cells.filter((c) => /^-?\d+[.,]?\d*$/.test(c.trim()));
  if (numericCells.length > cells.length / 2) return false;

  return true;
}

/**
 * Smart header detection: scan the first 10 lines and pick the one that
 * looks most like a header row (has delimiters, contains column keywords,
 * is not just a single value like "Account: Main GBP").
 */
export function detectHeaderLine(lines: string[], delimiter: string): { index: number; cells: string[] } {
  const candidates: { index: number; cells: string[]; score: number }[] = [];

  for (let i = 0; i < Math.min(10, lines.length); i++) {
    const cells = parseCsvLine(lines[i], delimiter);
    const delimiterCount = cells.length - 1;

    let score = 0;
    score += delimiterCount * 10; // more delimiters = more columnar
    if (looksLikeHeaderRow(cells)) score += 50;

    // Penalise single-value lines (e.g. "Account: Main GBP" split by comma still might be 1 cell)
    if (cells.length === 1) score -= 100;

    candidates.push({ index: i, cells, score });
  }

  // Pick best candidate; default to first line if none score well
  candidates.sort((a, b) => b.score - a.score);
  const best = candidates[0];

  if (best && best.score > 0) {
    return { index: best.index, cells: best.cells };
  }

  // Fallback: first non-empty line
  return { index: 0, cells: parseCsvLine(lines[0], delimiter) };
}

export function parseCsv(text: string): ParsedCsv {
  // Strip BOM
  const bomStripped = text.replace(/^\uFEFF/, "");

  try {
    // Try PapaParse first for RFC 4180 compliance
    return parseCsvWithPapa(bomStripped);
  } catch {
    // Fallback to hand-rolled parser
  }

  const delimiter = detectDelimiter(bomStripped);
  const allLines = bomStripped
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (allLines.length === 0) {
    return { headers: [], rows: [], delimiter, rowCount: 0, columnCount: 0 };
  }

  const headerDetection = detectHeaderLine(allLines, delimiter);
  const headers = headerDetection.cells.map((h) =>
    h.replace(/^["']|["']$/g, "").trim()
  );

  const rows = allLines.slice(headerDetection.index + 1).map((line) => parseCsvLine(line, delimiter));

  // Filter out rows that don't have enough columns (likely malformed)
  const validRows = rows.filter((row) => row.length >= Math.min(2, headers.length));

  return {
    headers,
    rows: validRows,
    delimiter,
    rowCount: validRows.length,
    columnCount: headers.length,
  };
}

export function cleanHeader(header: string): string {
  return header.toLowerCase().trim().replace(/^["']|["']$/g, "").replace(/\s+/g, " ");
}
