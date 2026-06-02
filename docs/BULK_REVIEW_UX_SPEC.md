# Bulk Review UX Design Specification

**Author:** Amelia Grant, Product Intelligence Architect  
**Date:** 2026-05-28  
**Status:** Draft → Implementation  
**Related:** Upload Preview Wizard (Daniel — Frontend UX Architect)

---

## 1. Overview

The upload preview currently shows a flat table of transactions with individual category dropdowns. When a user edits one row and clicks "Apply to similar", the change is applied silently to other rows with no visibility into what happened.

This spec introduces a **Smart Suggestions** panel and an **enhanced Apply-to-Similar flow** that make bulk categorisation explicit, transparent, and confidence-scored.

---

## 2. Goals

1. **Visibility** — Users must see *why* a bulk change is suggested and *which* rows are affected.
2. **Control** — Every bulk suggestion can be approved or rejected individually or in aggregate.
3. **Trust** — Confidence scoring tells the user how much to trust each suggestion.
4. **Speed** — High-confidence suggestions (≥90%) with ≥5 rows are auto-applied but still surfaced as "Applied".
5. **Learning** — User edits can be saved as persistent rules for future uploads.

---

## 3. Suggestions Panel

### 3.1 Placement
- Renders **above** the preview table on the `preview` step of the upload wizard.
- Collapsible on mobile via a chevron toggle.

### 3.2 Panel Header
- **Title:** "Smart Suggestions"
- **Badge:** Count of pending suggestions (excludes auto-applied and hidden)
- **Actions (right-aligned):**
  - "Approve All" — primary accent button
  - "Dismiss All" — ghost button

### 3.3 Suggestion Card

Each card represents a detected pattern across multiple preview rows.

#### Layout
```
┌─────────────────────────────────────────────────────────────┐
│ 🏢  We found 5 similar transactions from Highlevel Inc.      │
│     Suggested category: Software                             │
│                                                        [✓] [✗]│
│     ████████████████░░░░  85% confidence                     │
│     ▼ 3 affected rows (expandable)                          │
└─────────────────────────────────────────────────────────────┘
```

#### Elements

| Element | Spec |
|---------|------|
| **Icon (left)** | Match-type icon: 🏢 merchant, 🔤 reference, 🔑 keyword, 💳 processor |
| **Message (middle)** | "We found **{count}** similar transactions from **{matchValue}**. Suggested category: **{category}**." |
| **Approve button** | Check icon, accent color. Approves the suggestion and applies the category to affected rows. |
| **Reject button** | Cross icon, muted. Rejects the suggestion; rows keep existing categories. |
| **Confidence bar** | Horizontal progress bar. Color: green ≥90, yellow 70-89, red <70. Label shows "% confidence". |
| **Expandable rows** | Click card body (not buttons) to expand. Shows first 3 affected rows as mini-table (date, merchant, amount). "+N more" if additional. |

#### Auto-apply States

| Confidence | Row Count | Behaviour | Card State |
|------------|-----------|-----------|------------|
| ≥ 90 | ≥ 5 | Auto-applied on import. Still shown in panel. | "Applied" badge (success variant) + disabled approve button |
| 70 – 89 | any | Shown for manual review. | "Pending" badge (warning variant) |
| < 70 | any | Hidden from panel entirely. | — |

#### Responsive
- **Desktop:** Horizontal layout — icon | message | buttons stacked right.
- **Mobile (<640px):** Vertical layout — icon + message on top, buttons below, confidence bar full width.

---

## 4. Apply-to-Similar Enhancement

When a user edits a category in the preview table and clicks "Apply to similar":

### 4.1 Inline Confirmation Modal
- **Trigger:** Click "Apply to similar" on a row.
- **Type:** Small inline modal / popover anchored near the triggering row (or centered toast on mobile).
- **Content:**
  - Headline: "Apply '**{category}**' to **{count}** similar transactions?"
  - Match rule: "Matched by **{matchType}**: **{matchValue}**"
  - Affected rows list: first 3 rows (date + merchant + amount), then "+{N} more".
  - Actions: **[Apply]** (primary) | **[Cancel]** (ghost)

### 4.2 Post-Confirmation Feedback
1. **Row flash:** Affected rows flash yellow (`bg-[var(--warning)]/20`) for 2 seconds.
2. **Toast:** "Applied to {count} similar transactions" (top-right, auto-dismiss 4s).
3. **Save rule checkbox:** Appears inside the toast or inline below the modal:
   - Label: "Save as rule for future uploads"
   - Default: **checked**

### 4.3 State Transition Diagram
```
User edits category
        ↓
Clicks "Apply to similar"
        ↓
Show confirmation modal
        ↓
┌───────────────┬───────────────┐
│    Apply      │    Cancel     │
│       ↓       │       ↓       │
│ Apply to rows │  Close modal  │
│ Flash rows    │  (no-op)      │
│ Show toast    │               │
│ Offer save    │               │
└───────────────┴───────────────┘
```

---

## 5. Pattern Confidence Scoring

The `buildPatternSuggestions` algorithm scores each detected pattern as follows:

### Base Scores

| Pattern | Base Score | Prerequisites |
|---------|-----------|---------------|
| Merchant exact match | 90 | ≥ 3 rows, same category across ≥ 80% of rows |
| Reference prefix match | 75 | ≥ 3 rows, consistent prefix (e.g. "INV-2026") |
| Description keyword match | 70 | ≥ 3 rows, shared keyword, same category |
| Known processor pattern | 85 – 95 | Detected processor (Stripe, PayPal, etc.) with known category mapping |

### Boosts

| Condition | Boost |
|-----------|-------|
| Amount direction consistent (all income or all expense) | +10 |
| User has previously corrected this merchant to this category | +15 |

### Final Score
```
finalScore = baseScore + boosts
finalScore = min(100, finalScore)
```

### Thresholds

| Final Score | Action |
|-------------|--------|
| ≥ 90 + ≥ 5 rows | Auto-apply; show as "Applied" |
| 70 – 89 | Show for user review |
| < 70 | Suppress (do not show) |

---

## 6. Component Inventory

| Component | File | Responsibility |
|-----------|------|----------------|
| `SuggestionsPanel` | `src/components/features/upload/SuggestionsPanel.tsx` | Container: header, bulk actions, renders list of `SuggestionCard`s. |
| `SuggestionCard` | `src/components/features/upload/SuggestionCard.tsx` | Single suggestion: icon, message, approve/reject, confidence bar, expandable row previews. |
| `ApplyToSimilarConfirm` | `src/components/features/upload/ApplyToSimilarConfirm.tsx` | Inline confirmation modal for apply-to-similar action. |
| `usePatternSuggestions` | `src/components/features/upload/usePatternSuggestions.ts` | Hook: wraps `buildPatternSuggestions`, returns filtered suggestions and status maps. |
| `buildPatternSuggestions` | *(Naomi's module)* | Pure function: accepts `PreviewRow[]`, returns `PatternSuggestion[]` scored per §5. |

---

## 7. Type Definitions

```typescript
// src/components/features/upload/types.ts
export type MatchType = "merchant" | "reference" | "keyword" | "processor";

export interface PatternSuggestion {
  id: string;
  matchType: MatchType;
  matchValue: string;
  suggestedCategory: string;
  confidence: number;
  affectedRowIds: number[];   // rowNumber values from PreviewRow
  status: "pending" | "approved" | "rejected" | "applied";
}

// Props interfaces
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
```

---

## 8. Accessibility

- All buttons have `aria-label` descriptive text.
- Confidence bar uses `role="progressbar"` with `aria-valuenow`, `aria-valuemin`, `aria-valuemax`.
- Expandable section uses `aria-expanded` and `aria-controls`.
- Colour is never the sole indicator of state (icons + text always accompany colour).
- Focus trap inside `ApplyToSimilarConfirm` while open.

---

## 9. Mobile Considerations

- SuggestionsPanel collapses to a summary bar with count; tap to expand.
- SuggestionCard stacks vertically.
- Confidence bar becomes full width.
- ApplyToSimilarConfirm becomes a bottom sheet instead of inline popover on viewports < 640px.

---

## 10. Analytics Events

| Event | Payload |
|-------|---------|
| `suggestion_approved` | `{ suggestion_id, match_type, confidence, row_count }` |
| `suggestion_rejected` | `{ suggestion_id, match_type, confidence, row_count }` |
| `suggestion_approve_all` | `{ count }` |
| `suggestion_dismiss_all` | `{ count }` |
| `apply_to_similar_confirmed` | `{ category, row_count, match_type, save_as_rule }` |
| `apply_to_similar_cancelled` | `{ category, row_count }` |

---

## 11. Integration Notes for Daniel

1. Import `SuggestionsPanel` into the preview step of the wizard.
2. Pass `previewRows` from `WizardPreview` state.
3. Wire `onApprove` / `onReject` to update the preview table rows' categories.
4. Wire `onApproveAll` / `onDismissAll` to batch-update.
5. For "Apply to similar" in the table, render `ApplyToSimilarConfirm` inline.
6. Call `usePatternSuggestions(previewRows)` to generate suggestions on mount / when rows change.

---

## 12. Acceptance Criteria

- [ ] Design spec file exists at `docs/BULK_REVIEW_UX_SPEC.md`.
- [ ] `SuggestionCard.tsx` renders correctly with all props, including expansion.
- [ ] `SuggestionsPanel.tsx` renders a scrollable list of suggestions with bulk actions.
- [ ] `ApplyToSimilarConfirm.tsx` displays confirmation UI, affected rows, and save-as-rule checkbox.
- [ ] Components are responsive (stack on mobile, horizontal on desktop).
- [ ] `npm run build` passes without errors.
- [ ] `npm run lint` introduces no new errors.
