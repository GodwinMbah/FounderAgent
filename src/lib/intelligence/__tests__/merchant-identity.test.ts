import { describe, it, expect } from "vitest";
import {
  resolveMerchantIdentity,
  getMerchantLogoUrl,
  getMerchantInitialsAvatar,
  MerchantIdentitySchema,
} from "../merchant-identity";

describe("resolveMerchantIdentity", () => {
  it("resolves a known merchant with full metadata", () => {
    const identity = resolveMerchantIdentity("Stripe");

    expect(identity.name).toBe("Stripe");
    expect(identity.displayName).toBe("Stripe");
    expect(identity.normalisedKey).toBe("stripe");
    expect(identity.domain).toBe("stripe.com");
    expect(identity.aliases).toContain("Stripe Payments UK LTD");
    expect(identity.logoUrl).toBeUndefined();
    expect(identity.logoSource).toBe("branded_identity");
    expect(identity.category).toBe("Revenue");
    expect(identity.confidence).toBe(95);
    expect(identity.fallbackInitials).toBe("ST");
    expect(identity.fallbackColor).toBe("bg-violet-500");
    expect(identity.isKnown).toBe(true);
    expect(identity.lastEnriched).toBeDefined();
  });

  it("resolves a known merchant via variant mapping", () => {
    const identity = resolveMerchantIdentity("Stripe Inc");

    expect(identity.displayName).toBe("Stripe");
    expect(identity.normalisedKey).toBe("stripe");
    expect(identity.isKnown).toBe(true);
    expect(identity.logoUrl).toBeUndefined();
    expect(identity.aliases).toContain("Stripe Inc");
  });

  it("resolves an unknown merchant with fallback values", () => {
    const identity = resolveMerchantIdentity("ACME Corp");

    expect(identity.name).toBe("ACME Corp");
    expect(identity.displayName).toBe("Acme Corp");
    expect(identity.normalisedKey).toBe("acmecorp");
    expect(identity.domain).toBeUndefined();
    expect(identity.logoUrl).toBeUndefined();
    expect(identity.logoSource).toBe("fallback");
    expect(identity.category).toBeUndefined();
    expect(identity.confidence).toBe(40);
    expect(identity.fallbackInitials).toBe("AC");
    expect(identity.isKnown).toBe(false);
  });

  it("resolves all top-30 merchants as known", () => {
    const topMerchants = [
      "Stripe",
      "PayPal",
      "Shopify",
      "Amazon",
      "AWS",
      "OpenAI",
      "Meta",
      "Google",
      "Slack",
      "Notion",
      "HubSpot",
      "Salesforce",
      "GitHub",
      "Figma",
      "Zoom",
      "Microsoft",
      "Apple",
      "GoCardless",
      "Square",
      "Tide",
      "Revolut",
      "Wise",
      "Monzo",
      "Starling",
      "Xero",
      "QuickBooks",
      "Mailchimp",
      "Vercel",
      "Cloudflare",
    ];

    for (const merchant of topMerchants) {
      const identity = resolveMerchantIdentity(merchant);
      expect(identity.isKnown).toBe(true);
      expect(identity.confidence).toBe(95);
      expect(identity.aliases.length).toBeGreaterThan(0);
      expect(identity.logoSource === "branded_identity" || identity.logoSource === "cached").toBe(true);
      expect(identity.logoUrl).toBeUndefined();
    }
  });

  it("does not synthesize external logo URLs from known domains", () => {
    const identity = resolveMerchantIdentity("Stripe");
    expect(identity.domain).toBe("stripe.com");
    expect(identity.logoUrl).toBeUndefined();
    expect(getMerchantLogoUrl(identity)).toBeUndefined();
  });

  it("returns correct fallback for completely unknown merchants", () => {
    const identity = resolveMerchantIdentity("XYZ Unknown Vendor 123");

    expect(identity.name).toBe("XYZ Unknown Vendor 123");
    // enrichMerchant may clean/display-name the raw input
    expect(identity.displayName).toBeTruthy();
    // normaliseMerchant strips non-alphabetic characters for the key
    expect(identity.normalisedKey).toMatch(/xyzunknownvendor/);
    expect(identity.domain).toBeUndefined();
    expect(identity.logoUrl).toBeUndefined();
    expect(identity.logoSource).toBe("fallback");
    expect(identity.category).toBeUndefined();
    expect(identity.confidence).toBe(40);
    expect(identity.fallbackInitials).toBe("XV");
    expect(identity.isKnown).toBe(false);
    expect(identity.fallbackColor.startsWith("bg-")).toBe(true);
  });
});

describe("getMerchantLogoUrl", () => {
  it("returns safe local logoUrl when available", () => {
    const identity = resolveMerchantIdentity("Stripe");
    const url = getMerchantLogoUrl({
      ...identity,
      logoUrl: "/merchant-logos/stripe.svg",
    });
    expect(url).toBe("/merchant-logos/stripe.svg");
  });

  it("does not fall back to external logo providers in browser-rendered identity", () => {
    const identity = resolveMerchantIdentity("Stripe");
    const url = getMerchantLogoUrl({
      ...identity,
      logoUrl: "https://logo.clearbit.com/stripe.com",
    });
    expect(url).toBeUndefined();
  });

  it("returns undefined when no logo or domain is available", () => {
    const identity = resolveMerchantIdentity("Unknown Merchant XYZ");
    const url = getMerchantLogoUrl(identity);
    expect(url).toBeUndefined();
  });
});

describe("getMerchantInitialsAvatar", () => {
  it("returns initials and color for a known merchant", () => {
    const identity = resolveMerchantIdentity("GitHub");
    const avatar = getMerchantInitialsAvatar(identity);
    expect(avatar.initials).toBe("GH");
    expect(avatar.color).toBe("bg-neutral-800");
  });

  it("returns initials and color for an unknown merchant", () => {
    const identity = resolveMerchantIdentity("Bobs Burgers");
    const avatar = getMerchantInitialsAvatar(identity);
    expect(avatar.initials).toBe("BB");
    expect(avatar.color).toBeTruthy();
    expect(avatar.color.startsWith("bg-")).toBe(true);
  });
});

describe("MerchantIdentitySchema", () => {
  it("exports a structured schema object for merchant identity rendering", () => {
    expect(MerchantIdentitySchema).toBeDefined();
    expect(MerchantIdentitySchema.type).toBe("object");
    expect(MerchantIdentitySchema.description).toContain("merchant identity");
    expect(MerchantIdentitySchema.properties).toBeDefined();
    expect(MerchantIdentitySchema.properties.name).toBeDefined();
    expect(MerchantIdentitySchema.properties.normalisedKey).toBeDefined();
    expect(MerchantIdentitySchema.properties.logoSource).toBeDefined();
    expect(MerchantIdentitySchema.properties.logoSource.enum).toContain(
      "registry"
    );
    expect(MerchantIdentitySchema.properties.logoSource.enum).toContain("branded_identity");
    expect(MerchantIdentitySchema.properties.logoSource.enum).toContain("cached");
    expect(MerchantIdentitySchema.properties.logoSource.enum).toContain(
      "fallback"
    );
  });
});
