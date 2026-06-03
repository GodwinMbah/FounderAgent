/**
 * Merchant Identity Layer
 *
 * Provides a structured identity object for any merchant name, powering
 * logo/branded-avatar display and audited merchant matching.
 *
 * No browser-side external logo lookups are performed here. Known merchants
 * get deterministic branded identities, and imports never depend on logo
 * network success.
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
  /** Known aliases that should resolve to the same merchant identity */
  aliases: string[];
  /** Known corporate domain, used for logo lookup and web enrichment */
  domain?: string;
  /** Safe local/data logo URL if one exists. External logo URLs are omitted. */
  logoUrl?: string;
  /** Provenance of the visible merchant mark — affects reliability confidence */
  logoSource: "registry" | "branded_identity" | "cached" | "fallback";
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

const IDENTITY_CACHE = new Map<string, MerchantIdentity>();

const KNOWN_ALIASES: Record<string, string[]> = {
  stripe: ["Stripe Payments", "Stripe Payments UK LTD", "Stripe Inc"],
  paypal: ["PayPal UK", "PayPal Europe"],
  shopify: ["Shopify Payments", "Shopify Payouts"],
  meta: ["Facebook", "Instagram", "Meta Platforms"],
  facebook: ["Meta", "Facebook Ads"],
  google: ["Google Workspace", "Google Ads", "Google Cloud"],
  googleads: ["Google Ads", "AdWords"],
  apple: ["Apple.com", "Apple Services", "iCloud"],
  canva: ["Canva Pro", "Canva Pty"],
  gammaapp: ["Gamma", "Gamma.app"],
  manusai: ["Manus", "Manus AI"],
  anthropic: ["Claude", "Anthropic AI"],
  netflix: ["Netflix"],
  highlevel: ["GoHighLevel", "HighLevel Inc"],
  gohighlevel: ["HighLevel", "HighLevel Inc"],
  aws: ["Amazon Web Services", "AWS EMEA"],
  microsoft: ["Microsoft 365", "Office 365", "Azure"],
  notion: ["Notion Labs"],
  slack: ["Slack Technologies"],
  zoom: ["Zoom Video"],
  hubspot: ["HubSpot Inc"],
  salesforce: ["Salesforce.com"],
  klarna: ["Klarna Bank", "Klarna*"],
  amazon: ["Amazon Marketplace", "Amazon Prime"],
  capitalontap: ["Capital On Tap"],
  capitalone: ["Capital One"],
  remitly: ["Remitly Money Transfer"],
  asda: ["Asda Petrol", "Asda Stores"],
  moneyway: ["Moneyway Finance"],
  bumpercouk: ["Bumper", "Bumper.co.uk"],
  tide: ["Tide Business", "Tide Platform"],
  revolut: ["Revolut Business", "Revolut Ltd"],
  wise: ["TransferWise", "Wise Payments"],
  monzo: ["Monzo Bank"],
  starling: ["Starling Bank"],
  hmrc: ["HM Revenue", "HM Revenue & Customs"],
};

function cacheKey(rawName: string): string {
  return rawName.toLowerCase().replace(/\s+/g, " ").trim();
}

function isSafeLogoUrl(logoUrl?: string): boolean {
  if (!logoUrl) return false;
  return logoUrl.startsWith("/") || logoUrl.startsWith("data:image/");
}

function aliasesFor(normalisedKey: string, displayName: string): string[] {
  const aliases = new Set<string>([displayName]);
  for (const alias of KNOWN_ALIASES[normalisedKey] ?? []) aliases.add(alias);
  return [...aliases];
}

/**
 * Resolve a raw merchant string into a full MerchantIdentity.
 * Uses the enrichment pipeline and provider registry for known merchants,
 * falling back to deterministic generation for unknown ones.
 */
export function resolveMerchantIdentity(rawName: string): MerchantIdentity {
  const key = cacheKey(rawName);
  const cached = IDENTITY_CACHE.get(key);
  if (cached) return { ...cached, logoSource: cached.logoSource === "fallback" ? "fallback" : "cached" };

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
    confidence = 95;
    logoSource = "branded_identity";
    if (isSafeLogoUrl(info.logoUrl)) {
      logoUrl = info.logoUrl;
      logoSource = "registry";
    }
  } else {
    confidence = 40;
    logoSource = "fallback";
  }

  const identity: MerchantIdentity = {
    name: rawName,
    normalisedKey,
    displayName: enriched.displayName,
    aliases: aliasesFor(normalisedKey, enriched.displayName),
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

  IDENTITY_CACHE.set(key, identity);
  return identity;
}

/**
 * Get the best available logo URL for a merchant identity.
 */
export function getMerchantLogoUrl(
  identity: MerchantIdentity
): string | undefined {
  return isSafeLogoUrl(identity.logoUrl) ? identity.logoUrl : undefined;
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
 * Merchant Identity Schema Object
 *
 * Structured documentation of the MerchantIdentity shape for UI rendering,
 * caching and import-review trust explanations.
 */
export const MerchantIdentitySchema = {
  type: "object",
  description:
    "A resolved merchant identity containing display metadata, logo/branded-avatar information, aliases, and confidence scores.",
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
    aliases: {
      type: "array",
      description:
        "Known merchant aliases that resolve to the same identity.",
    },
    domain: {
      type: "string",
      description:
        "Known corporate domain (e.g., 'stripe.com'). Enables logo lookup via Clearbit and web-based enrichment.",
    },
    logoUrl: {
      type: "string",
      description:
        "Safe local or data URL for a merchant logo image when available. External lookup URLs are intentionally omitted from browser rendering.",
    },
    logoSource: {
      type: "string",
      enum: ["registry", "branded_identity", "cached", "fallback"],
      description:
        "Provenance of the visible merchant mark. 'registry' = safe local/data image, 'branded_identity' = curated local identity rendered as initials, 'cached' = reused local resolution, 'fallback' = deterministic unknown merchant initials.",
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
