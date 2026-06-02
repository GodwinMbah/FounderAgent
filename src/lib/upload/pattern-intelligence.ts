/**
 * Pattern Intelligence Layer
 * Builds categorisation suggestions from preview rows by detecting
 * merchant clusters, reference prefixes, description keywords, and
 * known processor patterns.
 */

export interface PreviewRow {
  rowNumber: number;
  merchant?: string;
  description?: string;
  reference?: string;
  amount: number;
  category?: string;
  confidenceScore?: number;
  status?: string;
  type?: "income" | "expense";
}

export interface PatternSuggestion {
  id: string; // deterministic hash
  matchType:
    | "merchant"
    | "reference_prefix"
    | "description_keyword"
    | "amount_direction_merchant"
    | "processor_pattern";
  matchValue: string; // the merchant name, prefix, keyword, etc.
  suggestedCategory: string;
  confidence: number; // 0-100
  affectedRows: number[]; // rowNumbers
  reason: string; // human-readable explanation
}

const STOP_WORDS = new Set([
  "the",
  "to",
  "from",
  "payment",
  "of",
  "a",
  "an",
  "and",
  "or",
  "for",
  "with",
  "on",
  "at",
  "by",
  "in",
  "is",
  "it",
  "as",
  "this",
  "that",
]);

function hashString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16).padStart(8, "0");
}

function getCategoryFrequency(
  categories: (string | undefined)[]
): { category: string; count: number } | null {
  const counts: Record<string, number> = {};
  for (const cat of categories) {
    if (!cat) continue;
    counts[cat] = (counts[cat] || 0) + 1;
  }
  let best: { category: string; count: number } | null = null;
  for (const [category, count] of Object.entries(counts)) {
    if (!best || count > best.count) {
      best = { category, count };
    }
  }
  return best;
}

function allSameType(rows: PreviewRow[]): "income" | "expense" | null {
  const types = new Set(rows.map((r) => r.type).filter(Boolean));
  if (types.size === 1) {
    return rows[0].type ?? null;
  }
  return null;
}

export function buildPatternSuggestions(
  rows: PreviewRow[],
  editedCategories?: Record<number, string>
): PatternSuggestion[] {
  const suggestions: PatternSuggestion[] = [];

  // Use edited categories if available
  const getCategory = (row: PreviewRow): string | undefined => {
    if (editedCategories && row.rowNumber in editedCategories) {
      return editedCategories[row.rowNumber];
    }
    return row.category;
  };

  // ── 1. Merchant exact match ──
  const merchantGroups: Record<string, PreviewRow[]> = {};
  for (const row of rows) {
    const merchant = row.merchant?.trim().toLowerCase();
    if (!merchant) continue;
    if (!merchantGroups[merchant]) merchantGroups[merchant] = [];
    merchantGroups[merchant].push(row);
  }
  for (const [merchant, group] of Object.entries(merchantGroups)) {
    if (group.length < 3) continue;
    const categories = group.map(getCategory).filter(Boolean);
    const freq = getCategoryFrequency(categories);
    if (freq && freq.count >= 3) {
      const affectedRows = group.map((r) => r.rowNumber);
      let confidence = 90;
      // Boost if all same direction
      const sameType = allSameType(group);
      if (sameType) confidence = Math.min(100, confidence + 5);

      suggestions.push({
        id: hashString(`merchant:${merchant}:${freq.category}`),
        matchType: "merchant",
        matchValue: group[0].merchant!,
        suggestedCategory: freq.category,
        confidence,
        affectedRows,
        reason: `${group.length} transactions from "${group[0].merchant}" are categorised as ${freq.category}`,
      });
    }
  }

  // ── 2. Reference prefix match ──
  const refGroups: Record<string, PreviewRow[]> = {};
  for (const row of rows) {
    const ref = row.reference?.trim();
    if (!ref || ref.length < 8) continue;
    const prefix = ref.slice(0, 8).toUpperCase();
    if (!refGroups[prefix]) refGroups[prefix] = [];
    refGroups[prefix].push(row);
  }
  for (const [prefix, group] of Object.entries(refGroups)) {
    if (group.length < 3) continue;
    const categories = group.map(getCategory).filter(Boolean);
    const freq = getCategoryFrequency(categories);
    if (freq && freq.count >= Math.max(2, Math.floor(group.length * 0.6))) {
      suggestions.push({
        id: hashString(`ref:${prefix}:${freq.category}`),
        matchType: "reference_prefix",
        matchValue: prefix,
        suggestedCategory: freq.category,
        confidence: 75,
        affectedRows: group.map((r) => r.rowNumber),
        reason: `${group.length} transactions share reference prefix "${prefix}" → ${freq.category}`,
      });
    }
  }

  // ── 3. Description keyword match ──
  const keywordGroups: Record<string, PreviewRow[]> = {};
  for (const row of rows) {
    const desc = row.description?.toLowerCase() || "";
    const words = desc
      .split(/\s+/)
      .filter((w) => w.length > 2 && !STOP_WORDS.has(w));
    const seen = new Set<string>();
    for (const word of words) {
      if (seen.has(word)) continue;
      seen.add(word);
      if (!keywordGroups[word]) keywordGroups[word] = [];
      keywordGroups[word].push(row);
    }
  }
  for (const [keyword, group] of Object.entries(keywordGroups)) {
    if (group.length < 3) continue;
    const categories = group.map(getCategory).filter(Boolean);
    const freq = getCategoryFrequency(categories);
    if (freq && freq.count >= 3) {
      suggestions.push({
        id: hashString(`keyword:${keyword}:${freq.category}`),
        matchType: "description_keyword",
        matchValue: keyword,
        suggestedCategory: freq.category,
        confidence: 70,
        affectedRows: group.map((r) => r.rowNumber),
        reason: `${group.length} transactions contain "${keyword}" → ${freq.category}`,
      });
    }
  }

  // ── 4. Processor pattern ──
  const processorPatterns: Array<{
    pattern: RegExp;
    category: string;
    confidence: number;
    reason: string;
  }> = [
    {
      pattern: /\bstripe\b/i,
      category: "Revenue",
      confidence: 95,
      reason: "Stripe processor detected → Revenue",
    },
    {
      pattern: /\bcapital on tap\b/i,
      category: "Credit Card Payment",
      confidence: 90,
      reason: "Capital On Tap detected → Credit Card Payment",
    },
    {
      pattern: /\bcapital one\b/i,
      category: "Credit Card Payment",
      confidence: 90,
      reason: "Capital One detected → Credit Card Payment",
    },
    {
      pattern: /\bamex\b/i,
      category: "Credit Card Payment",
      confidence: 90,
      reason: "Amex detected → Credit Card Payment",
    },
    {
      pattern: /\bamerican express\b/i,
      category: "Credit Card Payment",
      confidence: 90,
      reason: "American Express detected → Credit Card Payment",
    },
    {
      pattern: /\bbarclaycard\b/i,
      category: "Credit Card Payment",
      confidence: 90,
      reason: "Barclaycard detected → Credit Card Payment",
    },
    {
      pattern: /\blloyds card\b/i,
      category: "Credit Card Payment",
      confidence: 90,
      reason: "Lloyds Card detected → Credit Card Payment",
    },
    {
      pattern: /\btide credit\b/i,
      category: "Credit Card Payment",
      confidence: 90,
      reason: "Tide Credit detected → Credit Card Payment",
    },
    {
      pattern: /\bklarna\b/i,
      category: "Payment Processor Fees",
      confidence: 75,
      reason: "Klarna detected → Payment Processor Fees",
    },
    {
      pattern: /\bgoogle\s*\*\b/i,
      category: "Software",
      confidence: 90,
      reason: "Google * pattern detected → Software",
    },
    {
      pattern: /\bgoogle\s+llc\b/i,
      category: "Software",
      confidence: 90,
      reason: "Google LLC detected → Software",
    },
    {
      pattern: /\bamazon\b/i,
      category: "Office Costs",
      confidence: 80,
      reason: "Amazon detected → Office Costs",
    },
  ];

  for (const pp of processorPatterns) {
    const matchedRows: PreviewRow[] = [];
    for (const row of rows) {
      const text = `${row.description || ""} ${row.reference || ""} ${row.merchant || ""}`;
      if (pp.pattern.test(text)) {
        matchedRows.push(row);
      }
    }
    if (matchedRows.length >= 3) {
      suggestions.push({
        id: hashString(`processor:${pp.pattern.source}:${pp.category}`),
        matchType: "processor_pattern",
        matchValue: pp.pattern.source,
        suggestedCategory: pp.category,
        confidence: pp.confidence,
        affectedRows: matchedRows.map((r) => r.rowNumber),
        reason: `${matchedRows.length} transactions match ${pp.reason}`,
      });
    }
  }

  // ── 5. Amount direction + merchant ──
  const directionMerchantGroups: Record<string, PreviewRow[]> = {};
  for (const row of rows) {
    const merchant = row.merchant?.trim().toLowerCase();
    if (!merchant || !row.type) continue;
    const key = `${merchant}:${row.type}`;
    if (!directionMerchantGroups[key]) directionMerchantGroups[key] = [];
    directionMerchantGroups[key].push(row);
  }
  for (const [key, group] of Object.entries(directionMerchantGroups)) {
    if (group.length < 3) continue;
    const categories = group.map(getCategory).filter(Boolean);
    const freq = getCategoryFrequency(categories);
    if (freq && freq.count >= 3) {
      const merchant = group[0].merchant!;
      suggestions.push({
        id: hashString(`direction:${key}:${freq.category}`),
        matchType: "amount_direction_merchant",
        matchValue: merchant,
        suggestedCategory: freq.category,
        confidence: 85,
        affectedRows: group.map((r) => r.rowNumber),
        reason: `${group.length} ${group[0].type} transactions from "${merchant}" consistently categorised as ${freq.category}`,
      });
    }
  }

  // ── Deduplication ──
  // If a row appears in multiple suggestions, keep only the highest-confidence one.
  const rowBestSuggestion = new Map<number, PatternSuggestion>();
  for (const sug of suggestions) {
    for (const rn of sug.affectedRows) {
      const existing = rowBestSuggestion.get(rn);
      if (!existing || sug.confidence > existing.confidence) {
        rowBestSuggestion.set(rn, sug);
      }
    }
  }

  // Rebuild suggestions with only their winning rows
  const rebuilt = new Map<string, PatternSuggestion>();
  for (const [rn, bestSug] of rowBestSuggestion.entries()) {
    const existing = rebuilt.get(bestSug.id);
    if (existing) {
      if (!existing.affectedRows.includes(rn)) {
        existing.affectedRows.push(rn);
      }
    } else {
      rebuilt.set(bestSug.id, { ...bestSug, affectedRows: [rn] });
    }
  }

  return Array.from(rebuilt.values())
    .filter((s) => s.affectedRows.length > 0)
    .sort((a, b) => b.confidence - a.confidence);
}

export function getAutoApplyCandidates(
  suggestions: PatternSuggestion[]
): PatternSuggestion[] {
  return suggestions.filter(
    (s) => s.confidence >= 90 && s.affectedRows.length >= 5
  );
}
