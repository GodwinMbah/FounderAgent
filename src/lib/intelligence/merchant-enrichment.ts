/**
 * Merchant Enrichment Pipeline
 *
 * Normalises raw merchant strings into clean display names,
 * maps known variants to canonical names, and enriches with
 * metadata from the provider registry.
 */

import {
  getProviderInfo,
  getMerchantInitials as registryGetMerchantInitials,
  getMerchantColor as registryGetMerchantColor,
} from "@/lib/providers/registry";

export interface MerchantEnrichment {
  cleanName: string; // normalised for storage/matching
  displayName: string; // human-readable
  categoryHint?: string; // suggested category
  initials: string; // 1-2 character fallback
  color: string; // Tailwind bg class
  isKnown: boolean; // true if in registry
}

/* ── Prefixes stripped from the start of raw names ── */
const PREFIXES = [
  "DEBIT CARD PAYMENT TO",
  "PURCHASED FROM",
  "DIRECT DEBIT",
  "STANDING ORDER",
  "BILL PAYMENT",
  "CONTACTLESS",
  "PAYMENT",
  "TRANSFER",
  "PURCHASE",
  "ONLINE",
  "POS",
  "CARD",
];

/* ── Common city names removed when trailing ── */
const COMMON_CITIES = new Set([
  "LONDON",
  "MANCHESTER",
  "BIRMINGHAM",
  "LEEDS",
  "GLASGOW",
  "EDINBURGH",
  "BRISTOL",
  "LIVERPOOL",
  "NEWCASTLE",
  "SHEFFIELD",
  "YORK",
  "CAMBRIDGE",
  "OXFORD",
  "BRIGHTON",
  "CARDIFF",
  "BELFAST",
  "NOTTINGHAM",
  "LEICESTER",
  "COVENTRY",
  "READING",
  "PORTSMOUTH",
  "SOUTHAMPTON",
  "PLYMOUTH",
  "NORWICH",
  "DERBY",
  "STOKE",
  "WOLVERHAMPTON",
  "SWANSEA",
  "ABERDEEN",
  "DUNDEE",
]);

/* ── Variant → canonical name map (keys are fully normalised) ── */
const VARIANT_MAP: Record<string, string> = {
  // Amazon
  amazoncom: "Amazon",
  amazonmarketplace: "Amazon",
  amazonprime: "Amazon",
  amazondigital: "Amazon",
  amazon: "Amazon",

  // AWS
  amazonwebservices: "AWS",
  awsamazon: "AWS",
  aws: "AWS",

  // OpenAI
  chatgpt: "OpenAI",
  openaiinc: "OpenAI",
  openai: "OpenAI",

  // HighLevel
  gohighlevel: "HighLevel",
  highlevel: "HighLevel",
  ghl: "HighLevel",

  // Google Ads
  googleads: "Google Ads",
  googleadwords: "Google Ads",
  googleadvertising: "Google Ads",

  // Meta
  metaplatforms: "Meta",
  fb: "Meta",
  facebook: "Meta",
  instagram: "Meta",
  whatsapp: "Meta",

  // Microsoft
  microsoft365: "Microsoft",
  msft: "Microsoft",
  microsoftcorporation: "Microsoft",

  // Google Workspace
  googleworkspace: "Google Workspace",
  gsuite: "Google Workspace",
  gsuit: "Google Workspace",

  // Stripe
  stripeinc: "Stripe",
  stripecom: "Stripe",
  stripe: "Stripe",

  // PayPal
  paypal: "PayPal",
  paypalinc: "PayPal",

  // Notion
  notionlabs: "Notion",
  notion: "Notion",

  // Slack
  slacktechnologies: "Slack",
  slack: "Slack",

  // Figma
  figmainc: "Figma",
  figma: "Figma",

  // Zoom
  zoomvideo: "Zoom",
  zoom: "Zoom",

  // HubSpot
  hubspotinc: "HubSpot",
  hubspot: "HubSpot",

  // Shopify
  shopifyinc: "Shopify",
  shopify: "Shopify",

  // Klarna
  klarnabank: "Klarna",
  klarna: "Klarna",
  klarnaamazon: "Amazon",

  // Airbnb
  airbnb: "Airbnb",

  // Capital On Tap
  capitalontap: "Capital On Tap",

  // HMRC
  ukhmrevenue: "HMRC",
  hmrevenue: "HMRC",
  hmrc: "HMRC",

  // Tide
  tideplatform: "Tide",
  tidebank: "Tide",
  tide: "Tide",

  // Revolut
  revolutltd: "Revolut",
  revolutbank: "Revolut",
  revolut: "Revolut",

  // Wise
  wisepayments: "Wise",
  transferwise: "Wise",
  wise: "Wise",

  // Monzo
  monzobank: "Monzo",
  monzoltd: "Monzo",
  monzo: "Monzo",

  // Starling
  starlingbank: "Starling",
  starling: "Starling",

  // Barclays
  barclaysbank: "Barclays",
  barclaysuk: "Barclays",
  barclays: "Barclays",

  // HSBC
  hsbcuk: "HSBC",
  hsbcbank: "HSBC",
  hsbc: "HSBC",

  // Lloyds
  lloydsbank: "Lloyds",
  lloydstsb: "Lloyds",
  lloyds: "Lloyds",

  // NatWest
  natwestbank: "NatWest",
  natwestgroup: "NatWest",
  natwest: "NatWest",

  // Chase
  chasebank: "Chase",
  jpmorganchase: "Chase",
  chase: "Chase",

  // Square
  squareinc: "Square",
  squareup: "Square",
  square: "Square",

  // GoCardless
  gocardlessltd: "GoCardless",
  gocardless: "GoCardless",

  // Base44
  base44: "Base44",

  // Make / Integromat
  make: "Make",
  integromat: "Make",

  // Zapier
  zapier: "Zapier",
  zapierinc: "Zapier",

  // n8n
  n8n: "n8n",

  // Airtable
  airtable: "Airtable",

  // GitHub
  github: "GitHub",
  githubinc: "GitHub",

  // GitLab
  gitlab: "GitLab",

  // Bitbucket
  bitbucket: "Bitbucket",

  // Salesforce
  salesforce: "Salesforce",
  salesforcecom: "Salesforce",
  salesforcementoring: "Salesforce Mentoring",

  // Pipedrive
  pipedrive: "Pipedrive",

  // Xero
  xero: "Xero",

  // QuickBooks
  quickbooks: "QuickBooks",
  quickbooksintuit: "QuickBooks",

  // Sage
  sage: "Sage",

  // FreeAgent
  freeagent: "FreeAgent",

  // Loom
  loom: "Loom",
  loomcom: "Loom",

  // Calendly
  calendly: "Calendly",

  // Typeform
  typeform: "Typeform",

  // Adobe
  adobe: "Adobe",
  adobeinc: "Adobe",
  adobesystems: "Adobe",

  // Sketch
  sketch: "Sketch",

  // Canva
  canva: "Canva",
  canvacom: "Canva",

  // InVision
  invision: "InVision",

  // Discord
  discord: "Discord",

  // Microsoft Teams
  teams: "Microsoft Teams",
  microsoftteams: "Microsoft Teams",

  // Webex
  webex: "Webex",

  // Mailchimp
  mailchimp: "Mailchimp",
  mailchimpcom: "Mailchimp",

  // ConvertKit
  convertkit: "ConvertKit",

  // Klaviyo
  klaviyo: "Klaviyo",

  // Buffer
  buffer: "Buffer",

  // Hootsuite
  hootsuite: "Hootsuite",

  // Deliveroo
  deliveroo: "Deliveroo",

  // Just Eat
  justeat: "Just Eat",
  justeattakeaway: "Just Eat",

  // Foodpanda
  foodpanda: "Foodpanda",

  // Grubhub
  grubhub: "Grubhub",

  // DoorDash
  doordash: "DoorDash",

  // Lyft
  lyft: "Lyft",

  // Bolt
  bolt: "Bolt",

  // Booking.com
  bookingcom: "Booking.com",
  booking: "Booking.com",

  // Hostelworld
  hostelworld: "Hostelworld",

  // Marriott
  marriott: "Marriott",

  // Hilton
  hilton: "Hilton",

  // Trainline
  trainline: "Trainline",

  // National Rail
  nationalrail: "National Rail",

  // Eurostar
  eurostar: "Eurostar",

  // easyJet
  easyjet: "easyJet",

  // Ryanair
  ryanair: "Ryanair",

  // Udemy
  udemy: "Udemy",

  // Coursera
  coursera: "Coursera",

  // Codecademy
  codecademy: "Codecademy",

  // Pluralsight
  pluralsight: "Pluralsight",

  // Skillshare
  skillshare: "Skillshare",

  // MasterClass
  masterclass: "MasterClass",

  // Aviva
  aviva: "Aviva",

  // AXA
  axa: "AXA",

  // Direct Line
  directline: "Direct Line",

  // Allianz
  allianz: "Allianz",

  // Prudential
  prudential: "Prudential",

  // Evri
  evri: "Evri",
  hermes: "Evri",

  // BigCommerce
  bigcommerce: "BigCommerce",

  // WooCommerce
  woocommerce: "WooCommerce",

  // Manus AI
  manus: "Manus AI",
  manusai: "Manus AI",

  // Skool
  skool: "Skool",
  skoolcom: "Skool",

  // Asda
  asda: "Asda",

  // Tesco
  tesco: "Tesco",

  // Sainsbury's
  sainsburys: "Sainsbury's",
  sainsbury: "Sainsbury's",

  // Remitly
  remitly: "Remitly",

  // Bumper
  bumper: "Bumper",
  bumpercouk: "Bumper",

  // Ades
  ades: "Ades",
  adesltd: "Ades",
  adesltdcharlton: "Ades",

  // Wrapped/payment-context merchants
  stppdfhouse: "PDFHouse",
  pdfhouse: "PDFHouse",
  gfsnapfitnessco: "Snap Fitness",
  snapfitness: "Snap Fitness",
  gammaapp: "Gamma.app",
  picsartinc: "Picsart",
};

/* ── Helpers ── */

function normaliseKey(key: string): string {
  return key.toLowerCase().replace(/[^a-z0-9]/g, "").trim();
}

function toTitleCase(str: string): string {
  if (!str) return str;
  return str
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/* ── Exported functions ── */

/**
 * Strip noise from a raw merchant string and return a human-readable name.
 */
export function cleanMerchantName(raw: string): string {
  if (!raw || !raw.trim()) return "Unknown";

  let cleaned = raw.trim().toUpperCase();

  // 1. Remove common prefixes (anchored to start, longest first)
  for (const prefix of PREFIXES) {
    const escaped = prefix.replace(/\s+/g, "\\s+");
    const re = new RegExp(`^${escaped}\\s*`, "i");
    cleaned = cleaned.replace(re, "");
  }

  // 2. Remove domain extensions (.COM, .CO.UK, etc.)
  cleaned = cleaned.replace(/\.(COM|CO\.UK|NET|ORG|IO)/gi, "");

  // 3. Remove UK postcodes
  cleaned = cleaned.replace(/\b[A-Z]{1,2}\d[A-Z0-9]?\s?\d[A-Z]{2}\b/gi, "");

  // 4. Remove trailing codes that look like random identifiers (contain a digit)
  cleaned = cleaned.replace(/\s*[*#]\s*[A-Z0-9]*\d[A-Z0-9]*$/i, "");

  // 5. Remove trailing REF / STORE numbers
  cleaned = cleaned.replace(/\s*(REF|STORE)\s*\d+$/i, "");

  // 6. Remove trailing standalone numbers
  cleaned = cleaned.replace(/\s+\d+$/g, "");

  // 7. Remove common trailing cities
  const words = cleaned.trim().split(/\s+/).filter(Boolean);
  if (words.length > 1 && COMMON_CITIES.has(words[words.length - 1])) {
    words.pop();
    cleaned = words.join(" ");
  }

  cleaned = cleaned.trim();

  if (!cleaned) return "Unknown";

  return toTitleCase(cleaned);
}

/**
 * Clean a merchant name and map known variants to a canonical name.
 */
export function normaliseMerchant(name: string): string {
  const cleaned = cleanMerchantName(name);
  const key = normaliseKey(cleaned);

  if (VARIANT_MAP[key]) {
    return VARIANT_MAP[key];
  }

  return cleaned;
}

/**
 * Enrich a merchant name with display metadata.
 * Looks up the provider registry for known merchants and falls back
 * to deterministic initials / colours for unknown ones.
 */
export function enrichMerchant(name: string): MerchantEnrichment {
  const normalised = normaliseMerchant(name);
  const info = getProviderInfo(normalised);

  if (info) {
    return {
      cleanName: normalised,
      displayName: info.displayName,
      categoryHint: info.categoryHint,
      initials: info.fallbackInitials,
      color: info.fallbackColor,
      isKnown: true,
    };
  }

  return {
    cleanName: normalised,
    displayName: normalised,
    categoryHint: undefined,
    initials: registryGetMerchantInitials(normalised),
    color: registryGetMerchantColor(normalised),
    isKnown: false,
  };
}

/**
 * Derive 1–2 character initials from a merchant name.
 * Re-exported from the provider registry.
 */
export function getMerchantInitials(name: string): string {
  return registryGetMerchantInitials(name);
}

/**
 * Derive a deterministic Tailwind background colour from a merchant name.
 * Re-exported from the provider registry.
 */
export function getMerchantColor(name: string): string {
  return registryGetMerchantColor(name);
}

/**
 * Detect whether a merchant name looks like a personal name
 * (two words, both capitalised, no business indicators like Ltd, Inc, LLC, Limited).
 */
export function isPersonalName(name: string): boolean {
  const trimmed = name.trim();
  if (trimmed.length < 3) return false;

  const words = trimmed.split(/\s+/);
  if (words.length !== 2) return false;

  // Reject if any word contains digits
  if (words.some((w) => /\d/.test(w))) return false;

  // Reject business indicators
  const businessIndicators = ["Ltd", "Inc", "LLC", "Limited", "PLC", "Corp", "Group", "LLP"];
  const upper = trimmed.toUpperCase();
  for (const indicator of businessIndicators) {
    if (upper.includes(indicator.toUpperCase())) return false;
  }

  // Two capitalised words
  const PERSON_NAME_RE = /^[A-Z][a-z]+\s+[A-Z][a-z]+$/;
  return PERSON_NAME_RE.test(trimmed);
}
