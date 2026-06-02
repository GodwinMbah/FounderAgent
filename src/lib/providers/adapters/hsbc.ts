import type { ProviderAdapter } from "../adapter-types";

export const hsbcAdapter: ProviderAdapter = {
  id: "hsbc",
  displayName: "HSBC",
  type: "bank",
  detection: {
    requiredHeaders: ["Date", "Description", "Paid out", "Paid in"],
    optionalHeaders: ["Type", "Balance"],
    minRequiredMatches: 2,
    minScore: 30,
  },
  headerAliases: [
    { field: "transactionDate", aliases: ["Date", "date", "Transaction Date", "transaction_date"], required: true },
    { field: "description", aliases: ["Description", "description", "details", "narrative", "memo"], required: true },
    { field: "transactionType", aliases: ["Type", "type", "transaction type", "transaction_type", "category"] },
    { field: "debitAmount", aliases: ["Paid out", "paid out", "paid_out", "Money Out", "money out", "money_out", "debit"], required: true },
    { field: "creditAmount", aliases: ["Paid in", "paid in", "paid_in", "Money In", "money in", "money_in", "credit"], required: true },
    { field: "runningBalance", aliases: ["Balance", "balance", "running balance", "running_balance", "Account Balance"] },
  ],
  signConvention: "uk_bank",
  feeHandling: "included_in_amount",
  hasSplitAmountColumns: true,
  knownTransactionTypes: {
    "Direct Debit": { direction: "expense" },
    "Standing Order": { direction: "expense" },
    Transfer: { direction: "transfer" },
    Deposit: { direction: "income" },
    "Card Payment": { direction: "expense" },
    Withdrawal: { direction: "expense" },
    Fee: { direction: "fee", category: "Bank Fees" },
    Refund: { direction: "income" },
  },
  transferPatterns: ["transfer", "between accounts", "hsbc to hsbc"],
  dateFormatHints: ["DD/MM/YYYY"],
  detectionWeight: 1.0,
};
