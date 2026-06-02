import {
  getCompanySettings,
  updateCompanySettings,
  type CompanySettings,
} from "@/lib/db/company_settings";

export interface CorrectionInput {
  description: string;
  merchant?: string | null;
  reference?: string | null;
  previousCategory: string;
  newCategory: string;
  provider?: string | null;
  type?: "income" | "expense" | null;
}

/**
 * Build a merchant pattern from transaction description/merchant/reference.
 * Uses the most specific non-empty field (merchant > reference > description).
 * For descriptions, extracts the first 2 words (lowercased, alphanumeric only).
 */
export function buildMerchantPattern(input: {
  description: string;
  merchant?: string | null;
  reference?: string | null;
}): string {
  if (input.merchant && input.merchant.trim().length > 0) {
    return input.merchant.trim().toLowerCase();
  }
  if (input.reference && input.reference.trim().length > 0) {
    return input.reference.trim().toLowerCase();
  }

  const words = input.description
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 0);

  return words.slice(0, 2).join(" ");
}

/**
 * Extract multiple signals from a correction for richer rule matching.
 */
export function buildRuleSignals(input: {
  description: string;
  merchant?: string | null;
  reference?: string | null;
  provider?: string | null;
  type?: "income" | "expense" | null;
}): {
  merchantPattern?: string;
  descriptionPattern?: string;
  referencePattern?: string;
  provider?: string;
  direction?: "income" | "expense";
} {
  const signals: ReturnType<typeof buildRuleSignals> = {};

  if (input.merchant && input.merchant.trim().length > 0) {
    signals.merchantPattern = input.merchant.trim().toLowerCase();
  }

  if (input.reference && input.reference.trim().length > 0) {
    const ref = input.reference.trim().toLowerCase();
    // Use reference if it's specific (not just a generic number)
    if (ref.length > 3 && !/^\d+$/.test(ref)) {
      signals.referencePattern = ref;
    }
  }

  // Use description as fallback when merchant and reference aren't specific
  if (!signals.merchantPattern && !signals.referencePattern) {
    const words = input.description
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((w) => w.length > 0);
    signals.descriptionPattern = words.slice(0, 2).join(" ");
  }

  if (input.provider && input.provider.trim().length > 0) {
    signals.provider = input.provider.trim().toLowerCase();
  }

  if (input.type === "income" || input.type === "expense") {
    signals.direction = input.type;
  }

  return signals;
}

/**
 * Apply a correction to existing settings and return the updated rules.
 * Pure helper — testable without DB calls.
 */
export function applyCategoryCorrection(
  settings: CompanySettings,
  correction: CorrectionInput
): { categoryRules: NonNullable<CompanySettings["categoryRules"]> } {
  const signals = buildRuleSignals(correction);
  const existingRules = settings.categoryRules ?? [];

  // Match on any existing signal overlap
  const existingIndex = existingRules.findIndex((r) => {
    if (
      signals.merchantPattern &&
      r.merchantPattern === signals.merchantPattern
    )
      return true;
    if (
      signals.referencePattern &&
      r.referencePattern === signals.referencePattern
    )
      return true;
    if (
      signals.descriptionPattern &&
      r.descriptionPattern === signals.descriptionPattern
    )
      return true;
    return false;
  });

  const newRule: NonNullable<CompanySettings["categoryRules"]>[number] = {
    id:
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `rule-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    ...(signals.merchantPattern
      ? { merchantPattern: signals.merchantPattern }
      : {}),
    ...(signals.descriptionPattern
      ? { descriptionPattern: signals.descriptionPattern }
      : {}),
    ...(signals.referencePattern
      ? { referencePattern: signals.referencePattern }
      : {}),
    ...(signals.provider ? { provider: signals.provider } : {}),
    ...(signals.direction ? { direction: signals.direction } : {}),
    category: correction.newCategory,
    confidenceBoost: 15,
    createdAt: new Date().toISOString(),
  };

  let updatedRules: typeof existingRules;
  if (existingIndex >= 0) {
    updatedRules = [...existingRules];
    updatedRules[existingIndex] = newRule;
  } else {
    updatedRules = [...existingRules, newRule];
  }

  return { categoryRules: updatedRules };
}

/**
 * Record a user category correction and derive a reusable rule.
 * Returns the updated company settings or null.
 */
export async function recordCategoryCorrection(
  companyId: string,
  correction: CorrectionInput
): Promise<CompanySettings | null> {
  const settings = await getCompanySettings(companyId);
  if (!settings) return null;

  const { categoryRules } = applyCategoryCorrection(settings, correction);
  return updateCompanySettings(companyId, { categoryRules });
}

/**
 * Get user rules formatted for categoriser v3 context.
 */
export function getUserRulesForCategoriser(
  settings: CompanySettings | null
): Array<{
  merchantPattern?: string;
  descriptionPattern?: string;
  referencePattern?: string;
  provider?: string;
  direction?: "income" | "expense";
  category: string;
  confidenceBoost: number;
}> {
  if (!settings || !settings.categoryRules) return [];

  return settings.categoryRules.map((rule) => ({
    ...(rule.merchantPattern ? { merchantPattern: rule.merchantPattern } : {}),
    ...(rule.descriptionPattern
      ? { descriptionPattern: rule.descriptionPattern }
      : {}),
    ...(rule.referencePattern
      ? { referencePattern: rule.referencePattern }
      : {}),
    ...(rule.provider ? { provider: rule.provider } : {}),
    ...(rule.direction ? { direction: rule.direction } : {}),
    category: rule.category,
    confidenceBoost: 15,
  }));
}
