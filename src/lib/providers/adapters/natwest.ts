import type { ProviderAdapter } from "../adapter-types";

export const natwestAdapter: ProviderAdapter = {
  id: "natwest",
  displayName: "NatWest",
  type: "bank",
  detection: {
    requiredHeaders: ["Date", "Type", "Description", "Value"],
    optionalHeaders: ["Balance", "Account Name", "Account Number"],
    minRequiredMatches: 2,
    minScore: 30,
  },
  headerAliases: [
    { field: "transactionDate", aliases: ["Date"], required: true },
    { field: "description", aliases: ["Description"], required: true },
    { field: "amount", aliases: ["Value"], required: true },
    { field: "transactionType", aliases: ["Type"] },
    { field: "runningBalance", aliases: ["Balance", "Running Balance"] },
    { field: "accountName", aliases: ["Account Name"] },
    { field: "accountNumber", aliases: ["Account Number"] },
  ],
  signConvention: "uk_bank",
  feeHandling: "included_in_amount",
  detectionWeight: 1.0,
};
