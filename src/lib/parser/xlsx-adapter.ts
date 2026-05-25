/**
 * XLSX adapter — converts Excel files to ParsedCsv format
 * Uses SheetJS (xlsx) library
 */

import * as XLSX from "xlsx";
import type { ParsedCsv } from "./csv-core";

export function parseXlsx(arrayBuffer: ArrayBuffer): ParsedCsv {
  const workbook = XLSX.read(arrayBuffer, { type: "array" });

  // Use the first sheet
  const firstSheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[firstSheetName];

  // Convert to JSON array of arrays
  const data: unknown[][] = XLSX.utils.sheet_to_json(worksheet, {
    header: 1,
    defval: "",
    blankrows: false,
  });

  if (data.length === 0) {
    return { headers: [], rows: [], delimiter: ",", rowCount: 0, columnCount: 0 };
  }

  const headers = (data[0] as unknown[]).map((h) => String(h).trim());
  const rows = data
    .slice(1)
    .map((row) => (row as unknown[]).map((cell) => String(cell).trim()))
    .filter((row) => row.length >= Math.min(2, headers.length));

  return {
    headers,
    rows,
    delimiter: ",",
    rowCount: rows.length,
    columnCount: headers.length,
  };
}

export function isXlsxFile(fileName: string): boolean {
  const ext = fileName.split(".").pop()?.toLowerCase();
  return ext === "xlsx" || ext === "xls";
}
