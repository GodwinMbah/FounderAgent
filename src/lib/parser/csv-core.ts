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

export function parseCsv(text: string): ParsedCsv {
  try {
    // Try PapaParse first for RFC 4180 compliance
    return parseCsvWithPapa(text);
  } catch {
    // Fallback to hand-rolled parser
  }

  const delimiter = detectDelimiter(text);
  const allLines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (allLines.length === 0) {
    return { headers: [], rows: [], delimiter, rowCount: 0, columnCount: 0 };
  }

  const headers = parseCsvLine(allLines[0], delimiter).map((h) =>
    h.replace(/^["']|["']$/g, "").trim()
  );

  const rows = allLines.slice(1).map((line) => parseCsvLine(line, delimiter));

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
