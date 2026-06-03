import type { ProviderAdapter } from "../adapter-types";

export const starlingAdapter: ProviderAdapter = {
  id: "starling",
  displayName: "Starling Bank",
  type: "bank",
  detection: {
    requiredHeaders: ["Date", "Counter Party", "Amount", "Balance"],
    optionalHeaders: ["Reference", "Type", "Spending category", "Notes"],
    minRequiredMatches: 2,
    minScore: 30,
    preamblePatterns: ["Counter Party", "Spending category", "Starling"],
  },
  headerAliases: [
    { field: "transactionDate", aliases: ["Date", "date", "Transaction Date", "transaction_date"], required: true },
    { field: "counterpartyName", aliases: ["Counter Party", "counter party", "counter_party", "counterparty", "merchant", "name"], required: true },
    { field: "reference", aliases: ["Reference", "reference", "ref", "payment reference", "payment_reference"] },
    { field: "transactionType", aliases: ["Type", "type", "transaction type", "transaction_type", "Spending category", "spending_category", "category"] },
    { field: "amount", aliases: ["Amount", "amount", "transaction amount", "value"], required: true },
    { field: "runningBalance", aliases: ["Balance", "balance", "running balance", "running_balance", "Account Balance"], required: true },
    { field: "description", aliases: ["Notes", "notes", "description", "memo", "narrative", "details"] },
  ],
  signConvention: "uk_bank",
  feeHandling: "included_in_amount",
  hasSplitAmountColumns: false,
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
  transferPatterns: ["transfer", "between accounts", "starling to starling"],
  dateFormatHints: ["DD/MM/YYYY"],
  detectionWeight: 1.0,
};
