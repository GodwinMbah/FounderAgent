/**
 * Personal Name Detector
 * Identifies transactions where the merchant/counterparty looks like a person's name
 * and suggests appropriate categories based on context (amount direction, reference).
 */

export interface NameDetectionResult {
  isPersonalName: boolean;
  confidence: number; // 0-100
  suggestedCategories: string[];
  reason: string;
}

const PERSON_NAME_RE = /^[A-Z][a-z]+\s+[A-Z][a-z]+$/;
const PERSON_NAME_INITIAL_RE = /^[A-Z]\.?\s*[A-Z][a-z]+$/;

const KNOWN_COMPANY_WORDS = new Set([
  "ltd", "limited", "plc", "inc", "corp", "corporation", "llc", "llp", "group",
  "bank", "building society", "credit union", "insurance", "broker",
  "restaurant", "cafe", "hotel", "shop", "store", "market", "supermarket",
]);

function looksLikePersonalName(text: string): boolean {
  const trimmed = text.trim();
  if (trimmed.length < 3) return false;
  // Reject if trailing digits or extra words
  const words = trimmed.split(/\s+/);
  if (words.length !== 2) return false;
  // Reject if any word contains digits
  if (words.some((w) => /\d/.test(w))) return false;
  if (PERSON_NAME_RE.test(trimmed) || PERSON_NAME_INITIAL_RE.test(trimmed)) {
    const lower = trimmed.toLowerCase();
    for (const cw of KNOWN_COMPANY_WORDS) {
      if (lower.includes(cw)) return false;
    }
    return true;
  }
  return false;
}

export function detectPersonalName(
  text: string,
  amount?: number,
  reference?: string
): NameDetectionResult {
  // If the full text contains digits, do not extract embedded names
  // to avoid matching names in references like "John Smith 123"
  const hasDigits = /\d/.test(text);
  const nameMatch = !hasDigits ? text.match(/([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,2})/) : null;
  const namePart = nameMatch ? nameMatch[1] : text;

  if (!looksLikePersonalName(namePart)) {
    return {
      isPersonalName: false,
      confidence: 0,
      suggestedCategories: [],
      reason: "Not a personal name",
    };
  }

  const refLower = (reference || "").toLowerCase();
  const categories: string[] = [];

  // If amount and reference provided, infer category
  if (amount !== undefined && reference !== undefined) {
    if (amount > 0) {
      if (refLower.includes("invoice") || refLower.includes("payment") || refLower.includes("fee")) {
        categories.push("Revenue");
        categories.push("Contractors");
      } else if (refLower.includes("refund") || refLower.includes("reversal")) {
        categories.push("Refunds");
      }
    } else {
      if (refLower.includes("salary") || refLower.includes("wage") || refLower.includes("payroll")) {
        categories.push("Payroll");
      } else if (refLower.includes("dividend") || refLower.includes("drawing")) {
        categories.push("Owner Drawings");
      } else if (refLower.includes("family") || refLower.includes("support")) {
        categories.push("Family Support");
      } else if (refLower.includes("contract") || refLower.includes("freelance") || refLower.includes("consult")) {
        categories.push("Contractors");
      }
    }
  }

  const isHighConfidence = PERSON_NAME_RE.test(namePart);
  return {
    isPersonalName: true,
    confidence: isHighConfidence ? 85 : 60,
    suggestedCategories: categories,
    reason: categories.length > 0
      ? `Personal name (${isHighConfidence ? "First Last" : "Initial Last"}) with context → ${categories.join(", ")}`
      : `Personal name (${isHighConfidence ? "First Last" : "Initial Last"}) — review needed`,
  };
}
