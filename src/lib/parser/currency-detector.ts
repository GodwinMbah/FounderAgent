/**
 * Currency detection from CSV columns, symbols, and company settings
 * Country-aware fallback so UK companies never silently get USD
 */

import { extractCurrencySymbol } from "./amount-parser";

export interface CurrencyDetectionResult {
  currency: string;
  source: "column" | "symbol" | "company_settings" | "fallback";
  confidence: number;
}

const COUNTRY_CURRENCY: Record<string, string> = {
  GB: "GBP",
  UK: "GBP",
  US: "USD",
  CA: "CAD",
  AU: "AUD",
  NZ: "NZD",
  JP: "JPY",
  IN: "INR",
  // European Union
  DE: "EUR", FR: "EUR", IT: "EUR", ES: "EUR", NL: "EUR", BE: "EUR",
  AT: "EUR", PT: "EUR", IE: "EUR", FI: "EUR", GR: "EUR", LU: "EUR",
  // Nordic
  SE: "SEK", NO: "NOK", DK: "DKK", IS: "ISK",
  // Others
  CH: "CHF", PL: "PLN", CZ: "CZK",
};

function getFallbackCurrency(companyCountry?: string): string {
  if (companyCountry) {
    const cc = companyCountry.toUpperCase();
    if (COUNTRY_CURRENCY[cc]) return COUNTRY_CURRENCY[cc];
  }
  return "GBP";
}

export function detectCurrency(
  headers: string[],
  rows: string[][],
  currencyColumnIndex?: number,
  companyCurrency?: string,
  companyCountry?: string
): CurrencyDetectionResult {
  // 1. Check explicit currency column
  if (currencyColumnIndex !== undefined && currencyColumnIndex >= 0) {
    for (const row of rows.slice(0, 10)) {
      const val = row[currencyColumnIndex]?.trim().toUpperCase();
      if (val && /^[A-Z]{3}$/.test(val)) {
        return { currency: val, source: "column", confidence: 95 };
      }
    }
  }

  // 2. Check for currency symbols in amount columns
  const symbolSet = new Set<string>();
  for (const row of rows.slice(0, 20)) {
    for (const cell of row) {
      const symbol = extractCurrencySymbol(cell);
      if (symbol) symbolSet.add(symbol);
    }
  }

  if (symbolSet.size === 1) {
    return { currency: Array.from(symbolSet)[0], source: "symbol", confidence: 85 };
  }

  // 3. Use company default currency (always trust this if set)
  if (companyCurrency) {
    return { currency: companyCurrency, source: "company_settings", confidence: 70 };
  }

  // 4. Country-aware fallback (UK → GBP, never silent USD)
  const fallback = getFallbackCurrency(companyCountry);
  return { currency: fallback, source: "fallback", confidence: 50 };
}
