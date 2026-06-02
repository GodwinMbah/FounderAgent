/**
 * Provider Adapter Registry
 * Declarative, provider-agnostic ingestion configuration.
 */

import type { ParsedCsv } from "@/lib/parser/csv-core";
import type {
  ProviderAdapter,
  ProviderMatch,
  CanonicalField,
} from "./adapter-types";

function normaliseHeader(h: string): string {
  return h.toLowerCase().trim().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ");
}

export function scoreHeaderMatch(header: string, patterns: string[]): number {
  const nh = normaliseHeader(header);
  for (const p of patterns) {
    const np = normaliseHeader(p);
    if (nh === np) return 100;
    if (nh.includes(np)) return 80;
    if (np.includes(nh) && nh.length > 2) return 60;
  }
  return 0;
}

function scoreProviderAgainstHeaders(
  provider: ProviderAdapter,
  headers: string[]
): ProviderMatch {
  let score = 0;
  const matchedHeaders: string[] = [];
  const requiredFields = new Set<CanonicalField>();
  const foundFields = new Set<CanonicalField>();

  const det = provider.detection;
  let requiredMatches = 0;
  for (const rh of det.requiredHeaders) {
    const best = Math.max(...headers.map((h) => scoreHeaderMatch(h, [rh])));
    if (best >= 80) {
      requiredMatches++;
      score += 15;
      matchedHeaders.push(rh);
    }
  }

  if (det.optionalHeaders) {
    for (const oh of det.optionalHeaders) {
      const best = Math.max(...headers.map((h) => scoreHeaderMatch(h, [oh])));
      if (best >= 60) {
        score += 5;
        matchedHeaders.push(oh);
      }
    }
  }

  for (const alias of provider.headerAliases) {
    if (alias.required) requiredFields.add(alias.field);
    const best = Math.max(...headers.map((h) => scoreHeaderMatch(h, alias.aliases)));
    if (best >= 60) {
      foundFields.add(alias.field);
      score += best >= 100 ? 10 : best >= 80 ? 7 : 5;
    }
  }

  const minReq = det.minRequiredMatches ?? 2;
  if (requiredMatches < minReq) {
    score = score * 0.3;
  }

  const weight = provider.detectionWeight ?? 1;
  score = Math.round(score * weight);

  const missingRequired = Array.from(requiredFields).filter((f) => !foundFields.has(f));

  return {
    provider,
    score,
    matchedHeaders: Array.from(new Set(matchedHeaders)),
    missingRequired,
  };
}

export function detectProvider(parsed: ParsedCsv): ProviderMatch[] {
  const headers = parsed.headers;
  const matches: ProviderMatch[] = [];

  for (const adapter of Object.values(ADAPTER_REGISTRY)) {
    const match = scoreProviderAgainstHeaders(adapter, headers);
    if (match.score >= (adapter.detection.minScore ?? 30)) {
      matches.push(match);
    }
  }

  matches.sort((a, b) => b.score - a.score);
  return matches;
}

export function getAdapter(providerId: string): ProviderAdapter | undefined {
  return ADAPTER_REGISTRY[providerId];
}

export function getAllAdapters(): ProviderAdapter[] {
  return Object.values(ADAPTER_REGISTRY);
}

export function resolveColumnIndex(
  headers: string[],
  adapter: ProviderAdapter,
  field: CanonicalField
): number {
  const alias = adapter.headerAliases.find((a) => a.field === field);
  if (!alias) return -1;

  let bestIdx = -1;
  let bestScore = 0;
  for (let i = 0; i < headers.length; i++) {
    const score = scoreHeaderMatch(headers[i], alias.aliases);
    if (score > bestScore) {
      bestScore = score;
      bestIdx = i;
    }
  }
  return bestIdx;
}

export function buildColumnMapping(
  headers: string[],
  adapter: ProviderAdapter
): Record<CanonicalField, { index: number; header: string; confidence: number }> {
  const mapping: Record<string, { index: number; header: string; confidence: number }> = {};

  for (const alias of adapter.headerAliases) {
    let bestIdx = -1;
    let bestScore = 0;
    let bestHeader = "";
    for (let i = 0; i < headers.length; i++) {
      const score = scoreHeaderMatch(headers[i], alias.aliases);
      if (score > bestScore) {
        bestScore = score;
        bestIdx = i;
        bestHeader = headers[i];
      }
    }
    if (bestIdx >= 0 && bestScore >= 50) {
      mapping[alias.field] = {
        index: bestIdx,
        header: bestHeader,
        confidence: bestScore,
      };
    }
  }

  return mapping as Record<CanonicalField, { index: number; header: string; confidence: number }>;
}

// ───────────────────────────────────────────────────────────────
// Registry imports
// ───────────────────────────────────────────────────────────────

import { revolutAdapter } from "./adapters/revolut";
import { tideAdapter } from "./adapters/tide";
import { monzoAdapter } from "./adapters/monzo";
import { starlingAdapter } from "./adapters/starling";
import { wiseAdapter } from "./adapters/wise";
import { barclaysAdapter } from "./adapters/barclays";
import { hsbcAdapter } from "./adapters/hsbc";
import { lloydsAdapter } from "./adapters/lloyds";
import { natwestAdapter } from "./adapters/natwest";
import { chaseAdapter } from "./adapters/chase";
import { genericBankAdapter } from "./adapters/generic-bank";
import { stripeAdapter } from "./adapters/stripe";
import { paypalAdapter } from "./adapters/paypal";
import { squareAdapter } from "./adapters/square";
import { gocardlessAdapter } from "./adapters/gocardless";
import { shopifyAdapter } from "./adapters/shopify";
import { genericCsvAdapter } from "./adapters/generic-csv";

const ADAPTER_REGISTRY: Record<string, ProviderAdapter> = {
  [revolutAdapter.id]: revolutAdapter,
  [tideAdapter.id]: tideAdapter,
  [monzoAdapter.id]: monzoAdapter,
  [starlingAdapter.id]: starlingAdapter,
  [wiseAdapter.id]: wiseAdapter,
  [barclaysAdapter.id]: barclaysAdapter,
  [hsbcAdapter.id]: hsbcAdapter,
  [lloydsAdapter.id]: lloydsAdapter,
  [natwestAdapter.id]: natwestAdapter,
  [chaseAdapter.id]: chaseAdapter,
  [genericBankAdapter.id]: genericBankAdapter,
  [stripeAdapter.id]: stripeAdapter,
  [paypalAdapter.id]: paypalAdapter,
  [squareAdapter.id]: squareAdapter,
  [gocardlessAdapter.id]: gocardlessAdapter,
  [shopifyAdapter.id]: shopifyAdapter,
  [genericCsvAdapter.id]: genericCsvAdapter,
};
