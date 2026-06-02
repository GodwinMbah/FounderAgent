/**
 * PapaParse-based CSV parser for RFC 4180 compliance
 * Handles quoted fields, multi-line values, BOM, and automatic delimiter detection
 */

import Papa from "papaparse";

export interface ParsedCsv {
  headers: string[];
  rows: string[][];
  delimiter: string;
  rowCount: number;
  columnCount: number;
}

export function parseCsvWithPapa(text: string): ParsedCsv {
  // Remove BOM if present
  const cleanText = text.replace(/^\uFEFF/, "");

  const result = Papa.parse<string[]>(cleanText, {
    skipEmptyLines: true,
    delimiter: "", // auto-detect
    header: false, // explicit: we want raw arrays, not keyed objects
  });

  const delimiter = result.meta.delimiter || ",";
  const data = result.data;

  if (data.length === 0) {
    return { headers: [], rows: [], delimiter, rowCount: 0, columnCount: 0 };
  }

  const headers = data[0].map((h) => h.replace(/^["']|["']$/g, "").trim());
  const rows = data.slice(1).map((row) =>
    row.map((cell) => cell.replace(/^["']|["']$/g, "").trim())
  );

  // Filter out rows that don't have enough columns
  const validRows = rows.filter((row) => row.length >= Math.min(2, headers.length));

  return {
    headers,
    rows: validRows,
    delimiter,
    rowCount: validRows.length,
    columnCount: headers.length,
  };
}
