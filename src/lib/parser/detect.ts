/**
 * Provider/source detection from CSV headers.
 * Now delegates to the adapter registry for multi-provider support.
 * Kept for backward compatibility — new code should use adapter-registry directly.
 */

import type { ParsedCsv } from "./csv-core";
import { detectProvider } from "@/lib/providers/adapter-registry";
import type { UploadSource } from "@/lib/types";

export function detectCsvSource(headers: string[]): UploadSource {
  // Build a minimal ParsedCsv for the adapter registry
  const parsed: ParsedCsv = {
    headers,
    rows: [],
    delimiter: ",",
    rowCount: 0,
    columnCount: headers.length,
  };

  const matches = detectProvider(parsed);
  if (matches.length > 0) {
    const providerId = matches[0].provider.id;
    const bankProviders = ["revolut_business_csv", "tide", "monzo", "starling", "wise", "barclays", "hsbc", "lloyds", "natwest", "chase", "generic_bank"];
    const paymentProviders = ["stripe_csv", "paypal_csv", "square_csv", "gocardless_csv", "shopify_payouts_csv"];
    const accountingProviders = ["quickbooks", "xero"];

    if (bankProviders.includes(providerId)) return "bank_statement_csv";
    if (paymentProviders.includes(providerId)) return "payment_processor_csv";
    if (accountingProviders.includes(providerId)) return "accounting_export_csv";
  }

  return "manual_csv";
}
