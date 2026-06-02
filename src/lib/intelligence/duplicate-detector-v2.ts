export interface DuplicateDetectionResult {
  isDuplicate: boolean;
  duplicateOf?: string; // externalTransactionId or file hash
  confidence: number;
  reason: string;
}

interface Transaction {
  transactionDate: string;
  amount: number;
  currency: string;
  merchantName: string;
  reference?: string;
  externalTransactionId?: string;
  accountName?: string;
  sourceProvider: string;
  sourceFileId?: string;
}

function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16);
}

export function generateTransactionHash(transaction: {
  transactionDate: string;
  amount: number;
  currency: string;
  merchantName: string;
  reference?: string;
  accountName?: string;
  sourceProvider: string;
}): string {
  const payload = [
    transaction.transactionDate,
    transaction.amount.toFixed(2),
    transaction.currency.toUpperCase(),
    transaction.merchantName.trim().toLowerCase(),
    (transaction.accountName || "").trim().toLowerCase(),
    transaction.sourceProvider.trim().toLowerCase(),
  ].join("|");

  return simpleHash(payload);
}

function parseDate(dateStr: string): Date {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) {
    throw new Error(`Invalid date: ${dateStr}`);
  }
  return d;
}

function datesWithinDays(a: string, b: string, days: number): boolean {
  const da = parseDate(a);
  const db = parseDate(b);
  const diffMs = Math.abs(da.getTime() - db.getTime());
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  return diffDays <= days;
}

export function detectDuplicate(
  transaction: Transaction,
  existingTransactions: Array<Transaction>
): DuplicateDetectionResult {
  const txFileId = transaction.sourceFileId;
  const txExternalId = transaction.externalTransactionId;
  const txReference = transaction.reference;
  const txHash = generateTransactionHash(transaction);

  for (const existing of existingTransactions) {
    // 1. Same file duplicate (confidence 100)
    if (
      txFileId &&
      existing.sourceFileId &&
      txFileId === existing.sourceFileId &&
      txExternalId &&
      existing.externalTransactionId &&
      txExternalId === existing.externalTransactionId
    ) {
      return {
        isDuplicate: true,
        duplicateOf: existing.externalTransactionId || txExternalId,
        confidence: 100,
        reason: "Exact duplicate within same source file",
      };
    }

    // 2. External ID match across files (confidence 100)
    if (
      txExternalId &&
      existing.externalTransactionId &&
      txExternalId === existing.externalTransactionId
    ) {
      return {
        isDuplicate: true,
        duplicateOf: existing.externalTransactionId,
        confidence: 100,
        reason: "Matching external transaction ID across files",
      };
    }

    // 3. Hash match (confidence 95)
    const existingHash = generateTransactionHash(existing);
    if (txHash === existingHash) {
      return {
        isDuplicate: true,
        duplicateOf: existing.externalTransactionId || existingHash,
        confidence: 95,
        reason: "Transaction hash match",
      };
    }

    // 4. Reference match (confidence 90)
    if (
      txReference &&
      existing.reference &&
      txReference.trim().toLowerCase() === existing.reference.trim().toLowerCase()
    ) {
      return {
        isDuplicate: true,
        duplicateOf: existing.externalTransactionId || existing.reference,
        confidence: 90,
        reason: "Matching reference number",
      };
    }

    // 5. Fuzzy match (confidence 80)
    const sameAmount = Math.abs(transaction.amount - existing.amount) <= 0.01;
    const sameCurrency =
      transaction.currency.toUpperCase() === existing.currency.toUpperCase();
    const sameMerchant =
      transaction.merchantName.trim().toLowerCase() ===
      existing.merchantName.trim().toLowerCase();
    const dateClose = datesWithinDays(
      transaction.transactionDate,
      existing.transactionDate,
      1
    );
    const differentProvider =
      transaction.sourceProvider.trim().toLowerCase() !==
      existing.sourceProvider.trim().toLowerCase();

    if (sameAmount && sameCurrency && sameMerchant && dateClose && differentProvider) {
      return {
        isDuplicate: true,
        duplicateOf: existing.externalTransactionId || txHash,
        confidence: 80,
        reason: "Fuzzy match: same amount, currency, merchant, and date across different providers",
      };
    }
  }

  return {
    isDuplicate: false,
    confidence: 0,
    reason: "",
  };
}
