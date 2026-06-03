import type { ProviderAdapter } from "../adapter-types";

export const barclaysAdapter: ProviderAdapter = {
  id: "barclays",
  displayName: "Barclays",
  type: "bank",
  detection: {
    requiredHeaders: ["Date", "Account", "Amount"],
    optionalHeaders: ["Number", "Subcategory", "Memo"],
    minRequiredMatches: 2,
    minScore: 30,
    preamblePatterns: ["Number", "Subcategory", "Memo"],
  },
  headerAliases: [
    { field: "transactionDate", aliases: ["Date", "date", "Transaction Date", "transaction_date"], required: true },
    { field: "accountName", aliases: ["Account", "account", "account name", "account_name"], required: true },
    { field: "amount", aliases: ["Amount", "amount", "transaction amount", "value"], required: true },
    { field: "externalTransactionId", aliases: ["Number", "number", "transaction number", "transaction_number", "id", "ref no"] },
    { field: "category", aliases: ["Subcategory", "subcategory", "category", "type", "transaction type", "transaction_type"] },
    { field: "description", aliases: ["Memo", "memo", "description", "details", "narrative", "reference", "ref"] },
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
  transferPatterns: ["transfer", "between accounts", "barclays to barclays"],
  dateFormatHints: ["DD/MM/YYYY"],
  detectionWeight: 1.0,
};
