import type { UploadSource } from "@/lib/types";

export function detectCsvSource(headers: string[]): UploadSource {
  const h = headers.map((h) => h.toLowerCase().trim());

  // Stripe
  if (
    h.includes("id") &&
    h.includes("amount") &&
    h.includes("currency") &&
    h.includes("created")
  ) {
    return "stripe";
  }

  // PayPal
  if (
    (h.includes("transaction id") || h.includes("transaction_id")) &&
    (h.includes("gross") || h.includes("fee")) &&
    h.includes("currency")
  ) {
    return "paypal";
  }

  // QuickBooks
  if (h.includes("txn_type") || (h.includes("account") && h.includes("split"))) {
    return "quickbooks";
  }

  // Xero
  if (
    h.includes("amount") &&
    h.includes("reference") &&
    (h.includes("bank_account") || h.includes("bank account"))
  ) {
    return "xero";
  }

  // Revolut Business
  const revolutColumns = [
    "date started utc",
    "date completed utc",
    "orig currency",
    "orig amount",
    "payment currency",
    "total amount",
    "balance",
    "mcc",
    "type",
    "state",
    "related transaction id",
  ];
  const revolutMatchCount = revolutColumns.filter((col) => h.includes(col)).length;
  if (revolutMatchCount >= 4) {
    return "revolut_business_csv";
  }

  // Bank statement CSV
  if (
    (h.includes("date") ||
      h.includes("transaction date") ||
      h.includes("posting date")) &&
    (h.includes("description") ||
      h.includes("payee") ||
      h.includes("memo") ||
      h.includes("name")) &&
    (h.includes("amount") ||
      h.includes("debit") ||
      h.includes("credit") ||
      h.includes("transaction amount"))
  ) {
    return "bank_statement_csv";
  }

  return "manual_csv";
}
