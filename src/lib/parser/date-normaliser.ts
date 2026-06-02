import { parseDate } from "./date-parser";

export interface DateNormalisationResult {
  date: string; // ISO YYYY-MM-DD
  format?: string; // detected format, e.g., "DD/MM/YYYY"
  confidence: number; // 0-100
}

function isValidDate(y: number, m: number, d: number): boolean {
  if (m < 1 || m > 12) return false;
  if (d < 1 || d > 31) return false;
  const daysInMonth = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (m === 2 && ((y % 4 === 0 && y % 100 !== 0) || y % 400 === 0)) {
    return d <= 29;
  }
  return d <= daysInMonth[m - 1];
}

function cleanValue(value: string): string {
  let cleaned = value.trim();
  if (!cleaned) return cleaned;

  // Strip ISO or space-separated time component
  const isoTimeMatch = cleaned.match(/^(\d{4}-\d{2}-\d{2})[T\s]/);
  if (isoTimeMatch) {
    cleaned = isoTimeMatch[1];
  } else {
    const genericTimeMatch = cleaned.match(
      /^(\d{1,4}[\/\.\-]\d{1,2}[\/\.\-]\d{1,4})\s+\d{1,2}:\d{2}/
    );
    if (genericTimeMatch) {
      cleaned = genericTimeMatch[1];
    }
  }

  // Normalise spaces around separators
  cleaned = cleaned.replace(/\s*([\/\.\-])\s*/g, "$1");
  // Collapse multiple spaces (named month formats)
  cleaned = cleaned.replace(/\s+/g, " ");

  return cleaned;
}

function expandTwoDigitYear(y: number): number {
  return y >= 50 ? 1900 + y : 2000 + y;
}

function parseMonthName(name: string): number {
  const months: Record<string, number> = {
    jan: 1,
    january: 1,
    feb: 2,
    february: 2,
    mar: 3,
    march: 3,
    apr: 4,
    april: 4,
    may: 5,
    jun: 6,
    june: 6,
    jul: 7,
    july: 7,
    aug: 8,
    august: 8,
    sep: 9,
    sept: 9,
    september: 9,
    oct: 10,
    october: 10,
    nov: 11,
    november: 11,
    dec: 12,
    december: 12,
  };
  return months[name.toLowerCase().trim()] ?? 0;
}

function parseWithHint(
  value: string,
  hint: string
): { year: number; month: number; day: number } | null {
  const cleaned = cleanValue(value);
  const upperHint = hint.toUpperCase().trim();

  if (upperHint === "YYYY-MM-DD") {
    const m = cleaned.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (m) {
      const y = parseInt(m[1], 10),
        mo = parseInt(m[2], 10),
        d = parseInt(m[3], 10);
      if (isValidDate(y, mo, d)) return { year: y, month: mo, day: d };
    }
    return null;
  }

  if (upperHint === "YYYY/MM/DD") {
    const m = cleaned.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/);
    if (m) {
      const y = parseInt(m[1], 10),
        mo = parseInt(m[2], 10),
        d = parseInt(m[3], 10);
      if (isValidDate(y, mo, d)) return { year: y, month: mo, day: d };
    }
    return null;
  }

  if (upperHint === "MM/DD/YYYY") {
    const m = cleaned.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (m) {
      const mo = parseInt(m[1], 10),
        d = parseInt(m[2], 10),
        y = parseInt(m[3], 10);
      if (isValidDate(y, mo, d)) return { year: y, month: mo, day: d };
    }
    return null;
  }

  if (upperHint === "DD/MM/YYYY") {
    const m = cleaned.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (m) {
      const d = parseInt(m[1], 10),
        mo = parseInt(m[2], 10),
        y = parseInt(m[3], 10);
      if (isValidDate(y, mo, d)) return { year: y, month: mo, day: d };
    }
    return null;
  }

  if (upperHint === "MM/DD/YY") {
    const m = cleaned.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2})$/);
    if (m) {
      const mo = parseInt(m[1], 10),
        d = parseInt(m[2], 10),
        y = expandTwoDigitYear(parseInt(m[3], 10));
      if (isValidDate(y, mo, d)) return { year: y, month: mo, day: d };
    }
    return null;
  }

  if (upperHint === "DD/MM/YY") {
    const m = cleaned.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2})$/);
    if (m) {
      const d = parseInt(m[1], 10),
        mo = parseInt(m[2], 10),
        y = expandTwoDigitYear(parseInt(m[3], 10));
      if (isValidDate(y, mo, d)) return { year: y, month: mo, day: d };
    }
    return null;
  }

  if (upperHint === "DD.MM.YYYY") {
    const m = cleaned.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
    if (m) {
      const d = parseInt(m[1], 10),
        mo = parseInt(m[2], 10),
        y = parseInt(m[3], 10);
      if (isValidDate(y, mo, d)) return { year: y, month: mo, day: d };
    }
    return null;
  }

  if (upperHint === "DD-MM-YYYY") {
    const m = cleaned.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
    if (m) {
      const d = parseInt(m[1], 10),
        mo = parseInt(m[2], 10),
        y = parseInt(m[3], 10);
      if (isValidDate(y, mo, d)) return { year: y, month: mo, day: d };
    }
    return null;
  }

  if (upperHint === "MM-DD-YYYY") {
    const m = cleaned.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
    if (m) {
      const mo = parseInt(m[1], 10),
        d = parseInt(m[2], 10),
        y = parseInt(m[3], 10);
      if (isValidDate(y, mo, d)) return { year: y, month: mo, day: d };
    }
    return null;
  }

  if (upperHint === "DD MON YYYY" || upperHint === "DD MONTH YYYY") {
    const m = cleaned.match(/^(\d{1,2})\s+([A-Za-z]{3,})\s+(\d{4})$/);
    if (m) {
      const d = parseInt(m[1], 10),
        mo = parseMonthName(m[2]),
        y = parseInt(m[3], 10);
      if (mo > 0 && isValidDate(y, mo, d)) return { year: y, month: mo, day: d };
    }
    return null;
  }

  if (upperHint === "MON DD, YYYY" || upperHint === "MONTH DD, YYYY") {
    const m = cleaned.match(/^([A-Za-z]{3,})\s+(\d{1,2}),?\s+(\d{4})$/);
    if (m) {
      const mo = parseMonthName(m[1]),
        d = parseInt(m[2], 10),
        y = parseInt(m[3], 10);
      if (mo > 0 && isValidDate(y, mo, d)) return { year: y, month: mo, day: d };
    }
    return null;
  }

  return null;
}

function inferFormat(value: string): string | undefined {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return "YYYY-MM-DD";
  if (/^\d{4}\/\d{1,2}\/\d{1,2}$/.test(value)) return "YYYY/MM/DD";
  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(value)) return "DD/MM/YYYY";
  if (/^\d{1,2}\.\d{1,2}\.\d{4}$/.test(value)) return "DD.MM.YYYY";
  if (/^\d{1,2}-\d{1,2}-\d{4}$/.test(value)) return "DD-MM-YYYY";
  if (/^\d{1,2}\s+[A-Za-z]{3,}\s+\d{4}$/.test(value)) return "DD Mon YYYY";
  if (/^[A-Za-z]{3,}\s+\d{1,2},?\s+\d{4}$/.test(value)) return "Mon DD, YYYY";
  return undefined;
}

function detectSingleFormat(
  sample: string,
  companyCountry?: string
): { format: string; ambiguous: boolean } | null {
  const cleaned = cleanValue(sample);

  if (/^\d{4}-\d{2}-\d{2}$/.test(cleaned)) {
    return { format: "YYYY-MM-DD", ambiguous: false };
  }

  if (/^\d{4}\/\d{1,2}\/\d{1,2}$/.test(cleaned)) {
    return { format: "YYYY/MM/DD", ambiguous: false };
  }

  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(cleaned)) {
    const [a, b, c] = cleaned.split("/").map((n) => parseInt(n, 10));
    const year = c;
    const mmddValid = isValidDate(year, a, b);
    const ddmmValid = isValidDate(year, b, a);
    if (mmddValid && ddmmValid) {
      const country = companyCountry?.toUpperCase();
      if (country === "US") return { format: "MM/DD/YYYY", ambiguous: true };
      if (country === "GB" || country === "EU")
        return { format: "DD/MM/YYYY", ambiguous: true };
      if (a > 12 && a <= 31)
        return { format: "DD/MM/YYYY", ambiguous: true };
      if (b > 12 && b <= 31)
        return { format: "MM/DD/YYYY", ambiguous: true };
      return { format: "DD/MM/YYYY", ambiguous: true };
    }
    if (ddmmValid) return { format: "DD/MM/YYYY", ambiguous: false };
    if (mmddValid) return { format: "MM/DD/YYYY", ambiguous: false };
    return null;
  }

  if (/^\d{1,2}\/\d{1,2}\/\d{2}$/.test(cleaned)) {
    const [a, b, c] = cleaned.split("/").map((n) => parseInt(n, 10));
    const year = expandTwoDigitYear(c);
    const mmddValid = isValidDate(year, a, b);
    const ddmmValid = isValidDate(year, b, a);
    if (mmddValid && ddmmValid) {
      const country = companyCountry?.toUpperCase();
      if (country === "US") return { format: "MM/DD/YY", ambiguous: true };
      if (country === "GB" || country === "EU")
        return { format: "DD/MM/YY", ambiguous: true };
      if (a > 12 && a <= 31) return { format: "DD/MM/YY", ambiguous: true };
      if (b > 12 && b <= 31) return { format: "MM/DD/YY", ambiguous: true };
      return { format: "DD/MM/YY", ambiguous: true };
    }
    if (ddmmValid) return { format: "DD/MM/YY", ambiguous: false };
    if (mmddValid) return { format: "MM/DD/YY", ambiguous: false };
    return null;
  }

  if (/^\d{1,2}\.\d{1,2}\.\d{4}$/.test(cleaned)) {
    const [d, m, y] = cleaned.split(".").map((n) => parseInt(n, 10));
    if (isValidDate(y, m, d)) return { format: "DD.MM.YYYY", ambiguous: false };
    return null;
  }

  if (/^\d{1,2}-\d{1,2}-\d{4}$/.test(cleaned)) {
    const [a, b, c] = cleaned.split("-").map((n) => parseInt(n, 10));
    const year = c;
    const mmddValid = isValidDate(year, a, b);
    const ddmmValid = isValidDate(year, b, a);
    if (mmddValid && ddmmValid) {
      const country = companyCountry?.toUpperCase();
      if (country === "US") return { format: "MM-DD-YYYY", ambiguous: true };
      if (country === "GB" || country === "EU")
        return { format: "DD-MM-YYYY", ambiguous: true };
      if (a > 12 && a <= 31)
        return { format: "DD-MM-YYYY", ambiguous: true };
      if (b > 12 && b <= 31)
        return { format: "MM-DD-YYYY", ambiguous: true };
      return { format: "DD-MM-YYYY", ambiguous: true };
    }
    if (ddmmValid) return { format: "DD-MM-YYYY", ambiguous: false };
    if (mmddValid) return { format: "MM-DD-YYYY", ambiguous: false };
    return null;
  }

  if (/^\d{1,2}\s+[A-Za-z]{3,}\s+\d{4}$/.test(cleaned)) {
    return { format: "DD Mon YYYY", ambiguous: false };
  }

  if (/^[A-Za-z]{3,}\s+\d{1,2},?\s+\d{4}$/.test(cleaned)) {
    return { format: "Mon DD, YYYY", ambiguous: false };
  }

  return null;
}

export function detectDateFormat(
  samples: string[],
  companyCountry?: string
): { format: string; confidence: number } {
  const formatCounts = new Map<string, number>();
  let ambiguousCount = 0;
  let matchedCount = 0;

  for (const sample of samples) {
    const result = detectSingleFormat(sample, companyCountry);
    if (result) {
      matchedCount++;
      formatCounts.set(
        result.format,
        (formatCounts.get(result.format) ?? 0) + 1
      );
      if (result.ambiguous) ambiguousCount++;
    }
  }

  let bestFormat = "unknown";
  let bestCount = 0;

  for (const [fmt, count] of formatCounts) {
    if (count > bestCount) {
      bestCount = count;
      bestFormat = fmt;
    }
  }

  if (bestFormat === "unknown" || matchedCount === 0) {
    return { format: "unknown", confidence: 0 };
  }

  const unanimous = bestCount === samples.length && ambiguousCount === 0;
  const confidence = unanimous ? 100 : 70;
  return { format: bestFormat, confidence };
}

export function normaliseDate(
  value: string,
  options?: {
    formatHints?: string[];
    companyCountry?: string;
    isPostedDate?: boolean;
  }
): DateNormalisationResult | null {
  const cleaned = cleanValue(value);
  if (!cleaned) return null;

  if (options?.formatHints && options.formatHints.length > 0) {
    for (const hint of options.formatHints) {
      const parsed = parseWithHint(cleaned, hint);
      if (parsed) {
        return {
          date: toISODate(parsed.year, parsed.month, parsed.day),
          format: hint,
          confidence: 100,
        };
      }
    }
  }

  const detected = detectDateFormat([cleaned], options?.companyCountry);
  if (detected.format !== "unknown") {
    const parsed = parseWithHint(cleaned, detected.format);
    if (parsed) {
      return {
        date: toISODate(parsed.year, parsed.month, parsed.day),
        format: detected.format,
        confidence: detected.confidence,
      };
    }
  }

  const fallback = parseDate(cleaned, options?.companyCountry);
  if (fallback.valid && fallback.date) {
    const format = inferFormat(cleaned);
    return {
      date: fallback.date,
      format,
      confidence: format ? 80 : 60,
    };
  }

  return null;
}

export function toISODate(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(
    2,
    "0"
  )}`;
}
