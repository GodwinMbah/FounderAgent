import type { ProviderAdapter } from "../adapter-types";

export const genericBankAdapter: ProviderAdapter = {
  id: "generic_bank",
  displayName: "Generic Bank",
  type: "bank",
  detection: {
    requiredHeaders: ["Date", "Description"],
    optionalHeaders: [
      "Amount",
      "Balance",
      "Reference",
      "Type",
      "Currency",
      "Debit",
      "Credit",
      "Money In",
      "Money Out",
      "Paid In",
      "Paid Out",
    ],
    minRequiredMatches: 2,
    minScore: 15,
  },
  headerAliases: [
    {
      field: "transactionDate",
      aliases: [
        "Date",
        "Transaction Date",
        "Posted Date",
        "Posting Date",
        "Value Date",
        "Completed Date",
        "Date Completed",
      ],
      required: true,
    },
    {
      field: "postedDate",
      aliases: ["Posted Date", "Posting Date", "Value Date", "Settlement Date"],
    },
    {
      field: "description",
      aliases: [
        "Description",
        "Details",
        "Narrative",
        "Memo",
        "Transaction Details",
        "Payment Details",
      ],
      required: true,
    },
    {
      field: "amount",
      aliases: ["Amount", "Value", "Transaction Amount", "Total"],
    },
    {
      field: "debitAmount",
      aliases: ["Debit", "Money Out", "Paid Out", "Withdrawal", "Outflow"],
    },
    {
      field: "creditAmount",
      aliases: ["Credit", "Money In", "Paid In", "Deposit", "Inflow"],
    },
    {
      field: "runningBalance",
      aliases: ["Balance", "Running Balance", "Account Balance", "Closing Balance"],
    },
    {
      field: "currency",
      aliases: ["Currency", "Currency Code", "CCY"],
    },
    {
      field: "reference",
      aliases: ["Reference", "Ref", "Transaction Reference"],
    },
    {
      field: "externalTransactionId",
      aliases: ["ID", "Transaction ID", "Txn ID", "Reference ID", "Payment ID", "Trans ID"],
    },
    {
      field: "transactionType",
      aliases: ["Type", "Transaction Type"],
    },
    {
      field: "accountName",
      aliases: ["Account", "Account Name"],
    },
    {
      field: "merchantName",
      aliases: ["Merchant", "Payee", "Name", "Counter Party", "Counterparty"],
    },
    {
      field: "feeAmount",
      aliases: ["Fee", "Transaction Fee", "Charges"],
    },
    {
      field: "status",
      aliases: ["Status", "State"],
    },
  ],
  signConvention: "unknown",
  feeHandling: "separate_column",
  hasSplitAmountColumns: true,
  detectionWeight: 0.5,
};
