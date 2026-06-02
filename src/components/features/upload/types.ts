/**
 * Bulk Review UX — shared types for upload preview suggestions
 */

import type { PreviewRow } from "@/lib/upload/wizard-types";

export type MatchType = "merchant" | "reference" | "keyword" | "processor";

export interface PatternSuggestion {
  id: string;
  matchType: MatchType;
  matchValue: string;
  suggestedCategory: string;
  /** Confidence that the GROUPING is correct (rows are similar) */
  groupConfidence: number;
  /** Confidence that the CATEGORY is correct for this merchant/pattern */
  categoryConfidence: number;
  /** Human-readable reason for the suggestion */
  reason: string;
  affectedRowIds: number[]; // rowNumber values from PreviewRow
  status: "pending" | "approved" | "rejected" | "applied";
}

export interface SuggestionCardProps {
  suggestion: PatternSuggestion;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  previewRows: PreviewRow[];
}

export interface SuggestionsPanelProps {
  suggestions: PatternSuggestion[];
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  onApproveAll: () => void;
  onDismissAll: () => void;
  previewRows: PreviewRow[];
}

export interface ApplyToSimilarConfirmProps {
  category: string;
  count: number;
  matchType: MatchType;
  matchValue: string;
  affectedRows: PreviewRow[];
  onApply: (saveAsRule: boolean) => void;
  onCancel: () => void;
}
