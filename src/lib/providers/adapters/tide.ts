import type { ProviderAdapter } from "../adapter-types";

export const tideAdapter: ProviderAdapter = {
  id: "tide",
  displayName: "Tide Business",
  type: "bank",
  detection: {
    requiredHeaders: ["Date", "Description", "Money In", "Money Out"],
    optionalHeaders: ["Category", "Balance", "Reference"],
    minRequiredMatches: 4,
    minScore: 30,
  },
  headerAliases: [
    { field: "transactionDate", aliases: ["Date", "Transaction Date", "date", "transaction_date"], required: true },
    { field: "description", aliases: ["Description", "description", "details", "narrative", "memo"], required: true },
    { field: "transactionType", aliases: ["Category", "category", "type", "transaction_type", "transaction type"] },
    { field: "creditAmount", aliases: ["Money In", "money in", "money_in", "Paid In", "paid in", "paid_in"], required: true },
    { field: "debitAmount", aliases: ["Money Out", "money out", "money_out", "Paid Out", "paid out", "paid_out"], required: true },
    { field: "runningBalance", aliases: ["Balance", "balance", "running balance", "running_balance", "Account Balance"] },
    { field: "reference", aliases: ["Reference", "reference", "ref", "transaction reference", "transaction_reference"] },
  ],
  signConvention: "uk_bank",
  feeHandling: "included_in_amount",
  hasSplitAmountColumns: true,
  dateFormatHints: ["DD/MM/YYYY"],
  detectionWeight: 1.0,
};
