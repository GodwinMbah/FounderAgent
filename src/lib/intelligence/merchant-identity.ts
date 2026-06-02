/**
 * Merchant Identity Layer
 *
 * Provides a structured identity object for any merchant name, powering
 * logo display and future P4 AI reasoning about merchant relationships.
 *
 * P4 AI Schema Notes:
 * - normalisedKey enables cross-transaction merchant clustering
 * - confidence signals how certain we are about the identity mapping
 * - logoSource tracks provenance for audit and reliability scoring
 */

import { getProviderInfo } from "@/lib/providers/registry";
import {
  normaliseMerchant,
  enrichMerchant,
} from "@/lib/intelligence/merchant-enrichment";

/**
 * Resolved identity for a merchant, combining registry data, enrichment,
 * and deterministic fallbacks. Designed for both UI rendering and
 * downstream AI reasoning.
 */
export interface MerchantIdentity {
  /** Raw merchant name as it appears in transaction data */
  name: string;
  /** Canonical normalised key used for deterministic matching and clustering */
  normalisedKey: string;
  /** Human-readable display name for UI rendering */
  displayName: string;
  /** Known corporate domain, used for logo lookup and web enrichment */
  domain?: string;
  /** Resolved logo URL (Clearbit, local asset, or generated) */
  logoUrl?: string;
  /** Provenance of the logo — affects reliability confidence */
  logoSource: "registry" | "clearbit" | "generated" | "fallback";
  /** Suggested spend category based on merchant type */
  category?: string;
  /** Overall confidence in this identity mapping (0-100) */
  confidence: number;
  /** ISO date string of last enrichment; undefined if never enriched */
  lastEnriched?: string;
  /** 1-2 character fallback initials for avatar rendering */
  fallbackInitials: string;
  /** Tailwind background colour class for fallback avatar */
  fallbackColor: string;
  /** True if this merchant exists in the known provider registry */
  isKnown: boolean;
}

/**
 * Resolve a raw merchant string into a full MerchantIdentity.
 * Uses the enrichment pipeline and provider registry for known merchants,
 * falling back to deterministic generation for unknown ones.
 */
export function resolveMerchantIdentity(rawName: string): MerchantIdentity {
  const normalised = normaliseMerchant(rawName);
  const enriched = enrichMerchant(rawName);
  const info = getProviderInfo(normalised);

  const normalisedKey = normalised
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .trim();

  let logoUrl: string | undefined;
  let logoSource: MerchantIdentity["logoSource"] = "fallback";
  let confidence = 0;

  if (info) {
    // Known merchant from registry
    confidence = 95;
    logoSource = "registry";

    if (info.logoUrl) {
      logoUrl = info.logoUrl;
    } else if (info.domain) {
      logoUrl = `https://logo.clearbit.com/${info.domain}`;
      logoSource = "clearbit";
    }
  } else {
    // Unknown merchant — deterministic fallback
    confidence = 40;
    logoSource = "fallback";
  }

  return {
    name: rawName,
    normalisedKey,
    displayName: enriched.displayName,
    domain: info?.domain,
    logoUrl,
    logoSource,
    category: enriched.categoryHint,
    confidence,
    lastEnriched: new Date().toISOString(),
    fallbackInitials: enriched.initials,
    fallbackColor: enriched.color,
    isKnown: enriched.isKnown,
  };
}

/**
 * Get the best available logo URL for a merchant identity.
 * Falls back to Clearbit if a domain is known but no explicit logo is set.
 */
export function getMerchantLogoUrl(
  identity: MerchantIdentity
): string | undefined {
  if (identity.logoUrl) {
    return identity.logoUrl;
  }
  if (identity.domain) {
    return `https://logo.clearbit.com/${identity.domain}`;
  }
  return undefined;
}

/**
 * Get fallback avatar props (initials + colour) for a merchant identity.
 */
export function getMerchantInitialsAvatar(identity: MerchantIdentity): {
  initials: string;
  color: string;
} {
  return {
    initials: identity.fallbackInitials,
    color: identity.fallbackColor,
  };
}

/**
 * P4 AI Schema Object
 *
 * Structured documentation of the MerchantIdentity shape for AI reasoning.
 * This object can be fed into prompt contexts to help LLMs understand
 * merchant data semantics.
 */
export const MerchantIdentitySchema = {
  type: "object",
  description:
    "A resolved merchant identity containing display metadata, logo information, and confidence scores. Used for logo rendering and AI-driven merchant clustering.",
  properties: {
    name: {
      type: "string",
      description:
        "Raw merchant name as it appears in source transaction data.",
    },
    normalisedKey: {
      type: "string",
      description:
        "Canonical alphanumeric key derived from the merchant name. Use this for exact-match clustering and deduplication across transactions.",
    },
    displayName: {
      type: "string",
      description:
        "Human-readable merchant name optimised for UI display. May differ from raw name due to cleaning and variant mapping.",
    },
    domain: {
      type: "string",
      description:
        "Known corporate domain (e.g., 'stripe.com'). Enables logo lookup via Clearbit and web-based enrichment.",
    },
    logoUrl: {
      type: "string",
      description:
        "Direct URL to a merchant logo image. Sources may be the provider registry, Clearbit API, local SVG assets, or generated placeholders.",
    },
    logoSource: {
      type: "string",
      enum: ["registry", "clearbit", "generated", "fallback"],
      description:
        "Provenance of the logo. 'registry' = curated local data (highest trust), 'clearbit' = external logo API, 'generated' = programmatically created, 'fallback' = none available.",
    },
    category: {
      type: "string",
      description:
        "Suggested spend category (e.g., 'Software', 'Cloud Infrastructure'). Derived from registry hints or AI categorisation.",
    },
    confidence: {
      type: "number",
      description:
        "Confidence score (0-100) representing certainty in the identity mapping. Known merchants score ~95; unknown merchants score ~40.",
    },
    lastEnriched: {
      type: "string",
      description:
        "ISO 8601 timestamp of when this identity was last resolved. Useful for cache invalidation and freshness scoring.",
    },
    fallbackInitials: {
      type: "string",
      description:
        "1-2 character initials used when no logo image is available. Derived from display name.",
    },
    fallbackColor: {
      type: "string",
      description:
        "Tailwind CSS background colour class for the fallback avatar circle. Deterministic per merchant name.",
    },
    isKnown: {
      type: "boolean",
      description:
        "True if the merchant exists in the curated provider registry. Known merchants have higher data quality and richer metadata.",
    },
  },
};
