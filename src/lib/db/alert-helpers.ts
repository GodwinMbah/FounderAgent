/**
 * Alert category normalization helper.
 * Ensures pipeline-generated alerts use valid enum values
 * compatible with the current live schema.
 */

const VALID_CATEGORIES = [
  "spending",
  "subscription",
  "revenue",
  "cash_flow",
  "budget",
  "security",
  "compliance",
] as const;

type ValidCategory = (typeof VALID_CATEGORIES)[number];

/**
 * Normalizes an alert category to a valid enum value.
 * Falls back to "spending" if the category is not yet supported by the live schema.
 */
export function normalizeAlertCategory(category: string): ValidCategory {
  const normalized = category.toLowerCase().trim();

  if (VALID_CATEGORIES.includes(normalized as ValidCategory)) {
    return normalized as ValidCategory;
  }

  // Map near-matches to valid categories
  if (normalized === "currency" || normalized === "foreign_currency") {
    return "spending"; // Fallback until migration 018 adds "currency"
  }
  if (normalized === "anomaly" || normalized === "unusual") {
    return "spending"; // Fallback until migration 018 adds "anomaly"
  }
  if (normalized === "duplicate") {
    return "spending"; // Fallback until migration 018 adds "duplicate"
  }

  return "spending"; // Ultimate fallback
}
