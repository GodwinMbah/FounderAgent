export type SourceKind =
  | "processor_transaction"
  | "open_banking_credit_card"
  | "open_banking_bank"
  | "csv_statement"
  | "bank_payout_summary"
  | "manual_entry"
  | "unknown";

export interface SourcePriorityInput {
  sourceKind: SourceKind;
  sourceProvider?: string;
  accountType?: string;
  isPayoutSummary?: boolean;
  hasLineItemDetail?: boolean;
}

const SOURCE_PRIORITY: Record<SourceKind, number> = {
  processor_transaction: 100,
  open_banking_credit_card: 90,
  open_banking_bank: 80,
  csv_statement: 50,
  bank_payout_summary: 40,
  manual_entry: 30,
  unknown: 10,
};

export function getSourcePriority(input: SourcePriorityInput): number {
  if (input.isPayoutSummary) return SOURCE_PRIORITY.bank_payout_summary;
  if (input.hasLineItemDetail && input.sourceKind === "processor_transaction") return SOURCE_PRIORITY.processor_transaction;
  return SOURCE_PRIORITY[input.sourceKind] ?? SOURCE_PRIORITY.unknown;
}

export function choosePreferredSource<T extends SourcePriorityInput>(candidate: T, existing: T): "candidate" | "existing" | "tie" {
  const candidateScore = getSourcePriority(candidate);
  const existingScore = getSourcePriority(existing);
  if (candidateScore > existingScore) return "candidate";
  if (existingScore > candidateScore) return "existing";
  return "tie";
}

