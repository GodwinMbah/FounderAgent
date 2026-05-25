/**
 * Multi-format date parser with locale-aware ambiguity resolution
 */

// Countries that typically use DD/MM/YYYY
const DD_MM_COUNTRIES = new Set([
  "GB", "UK", "AU", "NZ", "IE", "IN", "DE", "FR", "IT", "ES", "NL", "BE", "PT", "AT", "CH",
  "DK", "NO", "SE", "FI", "PL", "CZ", "HU", "RO", "BG", "HR", "SI", "SK", "LT", "LV", "EE",
  "GR", "CY", "MT", "LU", "IS", "LI", "MC", "SM", "VA", "AD", "GI", "IM", "JE", "GG",
]);

// Countries that typically use MM/DD/YYYY
const MM_DD_COUNTRIES = new Set(["US", "CA"]);

export interface DateParseResult {
  valid: boolean;
  date?: string; // YYYY-MM-DD
  error?: string;
  original: string;
}

function isValidDate(y: number, m: number, d: number): boolean {
  if (m < 1 || m > 12) return false;
  if (d < 1 || d > 31) return false;
  const daysInMonth = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  // Leap year
  if (m === 2 && ((y % 4 === 0 && y % 100 !== 0) || y % 400 === 0)) {
    return d <= 29;
  }
  return d <= daysInMonth[m - 1];
}

function parseSlashDate(parts: string[], companyCountry?: string): { date: string; format: string } | null {
  const [a, b, c] = parts.map((p) => parseInt(p, 10));
  const year = c >= 100 ? c : (c >= 50 ? 1900 + c : 2000 + c);

  // Try MM/DD/YYYY
  const mmddValid = isValidDate(year, a, b);
  // Try DD/MM/YYYY
  const ddmmValid = isValidDate(year, b, a);

  if (mmddValid && !ddmmValid) {
    return { date: `${year}-${String(a).padStart(2, "0")}-${String(b).padStart(2, "0")}`, format: "MM/DD/YYYY" };
  }
  if (ddmmValid && !mmddValid) {
    return { date: `${year}-${String(b).padStart(2, "0")}-${String(a).padStart(2, "0")}`, format: "DD/MM/YYYY" };
  }
  if (mmddValid && ddmmValid) {
    // Ambiguous — use company country
    const country = companyCountry?.toUpperCase();
    if (country && DD_MM_COUNTRIES.has(country)) {
      return { date: `${year}-${String(b).padStart(2, "0")}-${String(a).padStart(2, "0")}`, format: "DD/MM/YYYY" };
    }
    if (country && MM_DD_COUNTRIES.has(country)) {
      return { date: `${year}-${String(a).padStart(2, "0")}-${String(b).padStart(2, "0")}`, format: "MM/DD/YYYY" };
    }
    // Default: prefer DD/MM/YYYY (more common globally)
    return { date: `${year}-${String(b).padStart(2, "0")}-${String(a).padStart(2, "0")}`, format: "DD/MM/YYYY" };
  }
  return null;
}

export function parseDate(dateStr: string, companyCountry?: string): DateParseResult {
  const cleaned = dateStr.trim();

  if (!cleaned) {
    return { valid: false, error: "Empty date", original: dateStr };
  }

  // ISO format: YYYY-MM-DD or YYYY-MM-DDTHH:mm:ss
  const isoMatch = cleaned.match(/^(\d{4})-(\d{2})-(\d{2})(?:T|$)/);
  if (isoMatch) {
    const y = parseInt(isoMatch[1], 10);
    const m = parseInt(isoMatch[2], 10);
    const d = parseInt(isoMatch[3], 10);
    if (isValidDate(y, m, d)) {
      return { valid: true, date: `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`, original: dateStr };
    }
    return { valid: false, error: `Invalid date: ${cleaned}`, original: dateStr };
  }

  // Slash format: MM/DD/YYYY or DD/MM/YYYY
  const slashMatch = cleaned.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slashMatch) {
    const result = parseSlashDate([slashMatch[1], slashMatch[2], slashMatch[3]], companyCountry);
    if (result) {
      return { valid: true, date: result.date, original: dateStr };
    }
    return { valid: false, error: `Invalid date: ${cleaned}`, original: dateStr };
  }

  // YYYY/MM/DD
  const ymdSlashMatch = cleaned.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/);
  if (ymdSlashMatch) {
    const y = parseInt(ymdSlashMatch[1], 10);
    const m = parseInt(ymdSlashMatch[2], 10);
    const d = parseInt(ymdSlashMatch[3], 10);
    if (isValidDate(y, m, d)) {
      return { valid: true, date: `${ymdSlashMatch[1]}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`, original: dateStr };
    }
    return { valid: false, error: `Invalid date: ${cleaned}`, original: dateStr };
  }

  // Dash format: DD-MM-YYYY or MM-DD-YYYY
  const dashMatch = cleaned.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (dashMatch) {
    const result = parseSlashDate([dashMatch[1], dashMatch[2], dashMatch[3]], companyCountry);
    if (result) {
      return { valid: true, date: result.date, original: dateStr };
    }
    return { valid: false, error: `Invalid date: ${cleaned}`, original: dateStr };
  }

  // Dot format (European): DD.MM.YYYY
  const dotMatch = cleaned.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (dotMatch) {
    const d = parseInt(dotMatch[1], 10);
    const m = parseInt(dotMatch[2], 10);
    const y = parseInt(dotMatch[3], 10);
    if (isValidDate(y, m, d)) {
      return { valid: true, date: `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`, original: dateStr };
    }
    return { valid: false, error: `Invalid date: ${cleaned}`, original: dateStr };
  }

  // Named month formats
  const namedMatch1 = cleaned.match(/^(\d{1,2})\s+([A-Za-z]{3,})\s+(\d{4})$/);
  if (namedMatch1) {
    const month = parseMonthName(namedMatch1[2]);
    const d = parseInt(namedMatch1[1], 10);
    const y = parseInt(namedMatch1[3], 10);
    const m = parseInt(month, 10);
    if (isValidDate(y, m, d)) {
      return { valid: true, date: `${y}-${month}-${String(d).padStart(2, "0")}`, original: dateStr };
    }
    return { valid: false, error: `Invalid date: ${cleaned}`, original: dateStr };
  }

  const namedMatch2 = cleaned.match(/^([A-Za-z]{3,})\s+(\d{1,2}),?\s+(\d{4})$/);
  if (namedMatch2) {
    const month = parseMonthName(namedMatch2[1]);
    const d = parseInt(namedMatch2[2], 10);
    const y = parseInt(namedMatch2[3], 10);
    const m = parseInt(month, 10);
    if (isValidDate(y, m, d)) {
      return { valid: true, date: `${y}-${month}-${String(d).padStart(2, "0")}`, original: dateStr };
    }
    return { valid: false, error: `Invalid date: ${cleaned}`, original: dateStr };
  }

  // Try generic Date parsing as fallback
  const generic = new Date(cleaned);
  if (!isNaN(generic.getTime())) {
    const y = generic.getFullYear();
    const m = String(generic.getMonth() + 1).padStart(2, "0");
    const d = String(generic.getDate()).padStart(2, "0");
    if (isValidDate(y, parseInt(m, 10), parseInt(d, 10))) {
      return { valid: true, date: `${y}-${m}-${d}`, original: dateStr };
    }
  }

  return { valid: false, error: `Unrecognised date format: ${cleaned}`, original: dateStr };
}

function parseMonthName(name: string): string {
  const months: Record<string, string> = {
    jan: "01", january: "01",
    feb: "02", february: "02",
    mar: "03", march: "03",
    apr: "04", april: "04",
    may: "05",
    jun: "06", june: "06",
    jul: "07", july: "07",
    aug: "08", august: "08",
    sep: "09", sept: "09", september: "09",
    oct: "10", october: "10",
    nov: "11", november: "11",
    dec: "12", december: "12",
  };
  return months[name.toLowerCase().trim()] ?? "01";
}

/**
 * Detect the most likely date format from a sample of date strings
 */
export function detectDateFormat(dates: string[], companyCountry?: string): { format: string; confidence: number } {
  const formatCounts = new Map<string, number>();

  for (const dateStr of dates) {
    const cleaned = dateStr.trim();

    // Try each format
    if (/^\d{4}-\d{2}-\d{2}/.test(cleaned)) {
      formatCounts.set("YYYY-MM-DD", (formatCounts.get("YYYY-MM-DD") ?? 0) + 1);
    } else if (/^\d{4}\/\d{1,2}\/\d{1,2}$/.test(cleaned)) {
      formatCounts.set("YYYY/MM/DD", (formatCounts.get("YYYY/MM/DD") ?? 0) + 1);
    } else if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(cleaned)) {
      const parts = cleaned.split("/");
      const a = parseInt(parts[0], 10);
      const b = parseInt(parts[1], 10);
      const y = parseInt(parts[2], 10);
      const mmddValid = isValidDate(y, a, b);
      const ddmmValid = isValidDate(y, b, a);
      if (mmddValid && ddmmValid) {
        // Ambiguous
        const country = companyCountry?.toUpperCase();
        if (country && DD_MM_COUNTRIES.has(country)) {
          formatCounts.set("DD/MM/YYYY", (formatCounts.get("DD/MM/YYYY") ?? 0) + 1);
        } else if (country && MM_DD_COUNTRIES.has(country)) {
          formatCounts.set("MM/DD/YYYY", (formatCounts.get("MM/DD/YYYY") ?? 0) + 1);
        } else {
          formatCounts.set("DD/MM/YYYY", (formatCounts.get("DD/MM/YYYY") ?? 0) + 1);
        }
      } else if (ddmmValid) {
        formatCounts.set("DD/MM/YYYY", (formatCounts.get("DD/MM/YYYY") ?? 0) + 1);
      } else if (mmddValid) {
        formatCounts.set("MM/DD/YYYY", (formatCounts.get("MM/DD/YYYY") ?? 0) + 1);
      }
    } else if (/^\d{1,2}\.\d{1,2}\.\d{4}$/.test(cleaned)) {
      formatCounts.set("DD.MM.YYYY", (formatCounts.get("DD.MM.YYYY") ?? 0) + 1);
    } else if (/^\d{1,2}-\d{1,2}-\d{4}$/.test(cleaned)) {
      formatCounts.set("DD-MM-YYYY", (formatCounts.get("DD-MM-YYYY") ?? 0) + 1);
    } else if (/^\d{1,2}\s+[A-Za-z]{3,}\s+\d{4}$/.test(cleaned) || /^[A-Za-z]{3,}\s+\d{1,2},?\s+\d{4}$/.test(cleaned)) {
      formatCounts.set("Named Month", (formatCounts.get("Named Month") ?? 0) + 1);
    }
  }

  let bestFormat = "unknown";
  let bestCount = 0;

  for (const [format, count] of formatCounts) {
    if (count > bestCount) {
      bestCount = count;
      bestFormat = format;
    }
  }

  const confidence = dates.length > 0 ? Math.round((bestCount / dates.length) * 100) : 0;
  return { format: bestFormat, confidence };
}

export function getDateFormatLabel(format: string): string {
  const labels: Record<string, string> = {
    "YYYY-MM-DD": "YYYY-MM-DD",
    "YYYY/MM/DD": "YYYY/MM/DD",
    "MM/DD/YYYY": "MM/DD/YYYY",
    "DD/MM/YYYY": "DD/MM/YYYY",
    "DD.MM.YYYY": "DD.MM.YYYY",
    "DD-MM-YYYY": "DD-MM-YYYY",
    "Named Month": "Named Month (e.g. 1 Jan 2024)",
    unknown: "Auto-detect",
  };
  return labels[format] ?? format;
}
