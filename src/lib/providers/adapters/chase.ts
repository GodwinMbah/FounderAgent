import type { ProviderAdapter } from "../adapter-types";

export const chaseAdapter: ProviderAdapter = {
  id: "chase",
  displayName: "Chase",
  type: "bank",
  detection: {
    requiredHeaders: ["Details", "Posting Date", "Description", "Amount"],
    optionalHeaders: ["Type", "Balance", "Check or Slip #"],
    minRequiredMatches: 2,
    minScore: 30,
    preamblePatterns: ["Details", "Check or Slip #"],
  },
  headerAliases: [
    { field: "transactionDate", aliases: ["Posting Date"], required: true },
    { field: "postedDate", aliases: ["Details"] },
    { field: "description", aliases: ["Description"], required: true },
    { field: "amount", aliases: ["Amount"], required: true },
    { field: "transactionType", aliases: ["Type"] },
    { field: "runningBalance", aliases: ["Balance"] },
    { field: "reference", aliases: ["Check or Slip #", "Check", "Slip #"] },
  ],
  signConvention: "uk_bank",
  feeHandling: "included_in_amount",
  detectionWeight: 1.0,
};
