export interface BalanceExtractionResult {
  latestBalance?: number;
  balanceDate?: string;
  accountName?: string;
  isConfirmed: boolean;
}

interface Transaction {
  runningBalance?: number;
  transactionDate: string;
  accountName?: string;
  status: string;
}

const EXCLUDED_STATUSES = new Set([
  "failed",
  "declined",
  "reversed",
  "cancelled",
  "pending_reversal",
  "chargeback",
]);

export function extractLatestBalance(
  transactions: Array<Transaction>
): BalanceExtractionResult {
  // Filter out transactions without runningBalance
  const withBalance = transactions.filter(
    (tx) => tx.runningBalance !== undefined && tx.runningBalance !== null
  );

  // Filter out failed/declined/reversed transactions
  const valid = withBalance.filter((tx) => {
    const status = tx.status.toLowerCase().trim();
    return !EXCLUDED_STATUSES.has(status);
  });

  if (valid.length === 0) {
    return { isConfirmed: false };
  }

  // Sort by transactionDate descending (most recent first)
  const sorted = valid.sort((a, b) => {
    const dateA = new Date(a.transactionDate);
    const dateB = new Date(b.transactionDate);
    return dateB.getTime() - dateA.getTime();
  });

  const mostRecent = sorted[0];

  return {
    latestBalance: mostRecent.runningBalance,
    balanceDate: mostRecent.transactionDate,
    accountName: mostRecent.accountName,
    isConfirmed: true,
  };
}
