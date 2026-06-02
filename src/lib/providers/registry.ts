/**
 * Provider & Merchant Registry
 * Static mapping of known providers/merchants to display metadata.
 * No external HTTP requests — all data is local.
 */

export interface ProviderInfo {
  displayName: string;
  fallbackInitials: string;
  fallbackColor: string; // Tailwind colour class
  categoryHint?: string;
  domain?: string; // Known corporate domain for logo lookup
  logoUrl?: string; // Explicit logo URL (overrides Clearbit)
}

const PROVIDER_REGISTRY: Record<string, ProviderInfo> = {
  // Payment processors
  stripe: {
    displayName: "Stripe",
    fallbackInitials: "ST",
    fallbackColor: "bg-violet-500",
    categoryHint: "Revenue",
    domain: "stripe.com",
    logoUrl: "https://logo.clearbit.com/stripe.com",
  },
  paypal: {
    displayName: "PayPal",
    fallbackInitials: "PP",
    fallbackColor: "bg-blue-600",
    categoryHint: "Revenue",
    domain: "paypal.com",
    logoUrl: "https://logo.clearbit.com/paypal.com",
  },
  klarna: {
    displayName: "Klarna",
    fallbackInitials: "KL",
    fallbackColor: "bg-pink-500",
    categoryHint: "Payment Processor Fees",
  },

  // Software / SaaS
  highlevel: {
    displayName: "HighLevel",
    fallbackInitials: "HL",
    fallbackColor: "bg-indigo-500",
    categoryHint: "Software",
  },
  gohighlevel: {
    displayName: "HighLevel",
    fallbackInitials: "HL",
    fallbackColor: "bg-indigo-500",
    categoryHint: "Software",
  },
  openai: {
    displayName: "OpenAI",
    fallbackInitials: "OA",
    fallbackColor: "bg-emerald-600",
    categoryHint: "AI Tools",
    domain: "openai.com",
    logoUrl: "https://logo.clearbit.com/openai.com",
  },
  chatgpt: {
    displayName: "ChatGPT",
    fallbackInitials: "CG",
    fallbackColor: "bg-emerald-600",
    categoryHint: "AI Tools",
  },
  anthropic: {
    displayName: "Anthropic",
    fallbackInitials: "AN",
    fallbackColor: "bg-orange-500",
    categoryHint: "AI Tools",
  },
  claude: {
    displayName: "Claude",
    fallbackInitials: "CL",
    fallbackColor: "bg-orange-500",
    categoryHint: "AI Tools",
  },
  kimi: {
    displayName: "Kimi",
    fallbackInitials: "KM",
    fallbackColor: "bg-cyan-500",
    categoryHint: "AI Tools",
  },
  slack: {
    displayName: "Slack",
    fallbackInitials: "SL",
    fallbackColor: "bg-amber-600",
    categoryHint: "Software",
    domain: "slack.com",
    logoUrl: "https://logo.clearbit.com/slack.com",
  },
  notion: {
    displayName: "Notion",
    fallbackInitials: "NO",
    fallbackColor: "bg-neutral-600",
    categoryHint: "Software",
    domain: "notion.so",
    logoUrl: "https://logo.clearbit.com/notion.so",
  },
  figma: {
    displayName: "Figma",
    fallbackInitials: "FI",
    fallbackColor: "bg-purple-500",
    categoryHint: "Software",
    domain: "figma.com",
    logoUrl: "https://logo.clearbit.com/figma.com",
  },
  zoom: {
    displayName: "Zoom",
    fallbackInitials: "ZM",
    fallbackColor: "bg-blue-500",
    categoryHint: "Software",
    domain: "zoom.us",
    logoUrl: "https://logo.clearbit.com/zoom.us",
  },
  "google workspace": {
    displayName: "Google",
    fallbackInitials: "G",
    fallbackColor: "bg-red-500",
    categoryHint: "Software",
    domain: "google.com",
    logoUrl: "https://logo.clearbit.com/google.com",
  },
  google: {
    displayName: "Google",
    fallbackInitials: "G",
    fallbackColor: "bg-red-500",
    categoryHint: "Software",
    domain: "google.com",
    logoUrl: "https://logo.clearbit.com/google.com",
  },
  microsoft: {
    displayName: "Microsoft",
    fallbackInitials: "MS",
    fallbackColor: "bg-blue-700",
    categoryHint: "Software",
    domain: "microsoft.com",
    logoUrl: "https://logo.clearbit.com/microsoft.com",
  },
  apple: {
    displayName: "Apple",
    fallbackInitials: "AP",
    fallbackColor: "bg-neutral-800",
    categoryHint: "Software",
    domain: "apple.com",
    logoUrl: "https://logo.clearbit.com/apple.com",
  },

  // Cloud
  aws: {
    displayName: "AWS",
    fallbackInitials: "AW",
    fallbackColor: "bg-amber-700",
    categoryHint: "Cloud Infrastructure",
    domain: "aws.amazon.com",
    logoUrl: "https://logo.clearbit.com/aws.amazon.com",
  },
  vercel: {
    displayName: "Vercel",
    fallbackInitials: "VC",
    fallbackColor: "bg-neutral-900",
    categoryHint: "Cloud Infrastructure",
    domain: "vercel.com",
    logoUrl: "https://logo.clearbit.com/vercel.com",
  },
  cloudflare: {
    displayName: "Cloudflare",
    fallbackInitials: "CF",
    fallbackColor: "bg-orange-600",
    categoryHint: "Cloud Infrastructure",
    domain: "cloudflare.com",
    logoUrl: "https://logo.clearbit.com/cloudflare.com",
  },

  // Advertising
  "google ads": {
    displayName: "Google Ads",
    fallbackInitials: "GA",
    fallbackColor: "bg-red-500",
    categoryHint: "Advertising",
  },
  meta: {
    displayName: "Meta",
    fallbackInitials: "M",
    fallbackColor: "bg-blue-700",
    categoryHint: "Advertising",
    domain: "meta.com",
    logoUrl: "https://logo.clearbit.com/meta.com",
  },
  facebook: {
    displayName: "Facebook",
    fallbackInitials: "FB",
    fallbackColor: "bg-blue-700",
    categoryHint: "Advertising",
  },
  instagram: {
    displayName: "Instagram",
    fallbackInitials: "IG",
    fallbackColor: "bg-pink-600",
    categoryHint: "Advertising",
  },

  // Marketplaces / General
  amazon: {
    displayName: "Amazon",
    fallbackInitials: "AM",
    fallbackColor: "bg-amber-500",
    categoryHint: "Office",
    domain: "amazon.com",
    logoUrl: "https://logo.clearbit.com/amazon.com",
  },
  shopify: {
    displayName: "Shopify",
    fallbackInitials: "SH",
    fallbackColor: "bg-green-700",
    categoryHint: "Revenue",
    domain: "shopify.com",
    logoUrl: "https://logo.clearbit.com/shopify.com",
  },
  airbnb: {
    displayName: "Airbnb",
    fallbackInitials: "AB",
    fallbackColor: "bg-rose-500",
    categoryHint: "Travel",
  },

  // Finance
  "capital on tap": {
    displayName: "Capital On Tap",
    fallbackInitials: "CT",
    fallbackColor: "bg-teal-600",
    categoryHint: "Credit Card Payment",
  },
  "capital one": {
    displayName: "Capital One",
    fallbackInitials: "CO",
    fallbackColor: "bg-blue-700",
    categoryHint: "Credit Card Payment",
    domain: "capitalone.com",
  },
  "amex": {
    displayName: "American Express",
    fallbackInitials: "AX",
    fallbackColor: "bg-blue-600",
    categoryHint: "Credit Card Payment",
    domain: "americanexpress.com",
    logoUrl: "https://logo.clearbit.com/americanexpress.com",
  },
  "american express": {
    displayName: "American Express",
    fallbackInitials: "AX",
    fallbackColor: "bg-blue-600",
    categoryHint: "Credit Card Payment",
    domain: "americanexpress.com",
    logoUrl: "https://logo.clearbit.com/americanexpress.com",
  },
  "barclaycard": {
    displayName: "Barclaycard",
    fallbackInitials: "BC",
    fallbackColor: "bg-blue-800",
    categoryHint: "Credit Card Payment",
    domain: "barclaycard.co.uk",
  },
  "lloyds card services": {
    displayName: "Lloyds Card Services",
    fallbackInitials: "LC",
    fallbackColor: "bg-green-700",
    categoryHint: "Credit Card Payment",
  },
  hmrc: {
    displayName: "HMRC",
    fallbackInitials: "HM",
    fallbackColor: "bg-green-700",
    categoryHint: "Tax",
  },

  // Banking
  revolut: {
    displayName: "Revolut",
    fallbackInitials: "R",
    fallbackColor: "bg-violet-600",
    domain: "revolut.com",
    logoUrl: "https://logo.clearbit.com/revolut.com",
  },
  tide: {
    displayName: "Tide",
    fallbackInitials: "TD",
    fallbackColor: "bg-blue-500",
    categoryHint: "Bank Fees",
    domain: "tide.co",
    logoUrl: "https://logo.clearbit.com/tide.co",
  },
  wise: {
    displayName: "Wise",
    fallbackInitials: "WI",
    fallbackColor: "bg-teal-500",
    categoryHint: "Bank Fees",
    domain: "wise.com",
    logoUrl: "https://logo.clearbit.com/wise.com",
  },
  monzo: {
    displayName: "Monzo",
    fallbackInitials: "MZ",
    fallbackColor: "bg-pink-500",
    categoryHint: "Bank Fees",
    domain: "monzo.com",
    logoUrl: "https://logo.clearbit.com/monzo.com",
  },
  starling: {
    displayName: "Starling",
    fallbackInitials: "ST",
    fallbackColor: "bg-purple-600",
    categoryHint: "Bank Fees",
    domain: "starlingbank.com",
    logoUrl: "https://logo.clearbit.com/starlingbank.com",
  },
  gocardless: {
    displayName: "GoCardless",
    fallbackInitials: "GC",
    fallbackColor: "bg-indigo-600",
    categoryHint: "Payment Processor Fees",
    domain: "gocardless.com",
    logoUrl: "https://logo.clearbit.com/gocardless.com",
  },
  square: {
    displayName: "Square",
    fallbackInitials: "SQ",
    fallbackColor: "bg-neutral-800",
    categoryHint: "Payment Processor Fees",
    domain: "squareup.com",
    logoUrl: "https://logo.clearbit.com/squareup.com",
  },

  // Additional Software / SaaS
  base44: { displayName: "Base44", fallbackInitials: "B4", fallbackColor: "bg-indigo-500", categoryHint: "Software" },
  make: { displayName: "Make", fallbackInitials: "MK", fallbackColor: "bg-purple-500", categoryHint: "Software" },
  zapier: { displayName: "Zapier", fallbackInitials: "ZP", fallbackColor: "bg-orange-500", categoryHint: "Software" },
  n8n: { displayName: "n8n", fallbackInitials: "N8", fallbackColor: "bg-red-500", categoryHint: "Software" },
  airtable: { displayName: "Airtable", fallbackInitials: "AT", fallbackColor: "bg-yellow-500", categoryHint: "Software" },
  github: { displayName: "GitHub", fallbackInitials: "GH", fallbackColor: "bg-neutral-800", categoryHint: "Software", domain: "github.com", logoUrl: "https://logo.clearbit.com/github.com" },
  gitlab: { displayName: "GitLab", fallbackInitials: "GL", fallbackColor: "bg-orange-600", categoryHint: "Software" },
  bitbucket: { displayName: "Bitbucket", fallbackInitials: "BB", fallbackColor: "bg-blue-600", categoryHint: "Software" },
  salesforce: { displayName: "Salesforce", fallbackInitials: "SF", fallbackColor: "bg-sky-600", categoryHint: "Software", domain: "salesforce.com", logoUrl: "https://logo.clearbit.com/salesforce.com" },
  hubspot: { displayName: "HubSpot", fallbackInitials: "HS", fallbackColor: "bg-orange-500", categoryHint: "Software", domain: "hubspot.com", logoUrl: "https://logo.clearbit.com/hubspot.com" },
  pipedrive: { displayName: "Pipedrive", fallbackInitials: "PD", fallbackColor: "bg-green-500", categoryHint: "Software" },
  xero: { displayName: "Xero", fallbackInitials: "XE", fallbackColor: "bg-sky-500", categoryHint: "Software", domain: "xero.com", logoUrl: "https://logo.clearbit.com/xero.com" },
  quickbooks: { displayName: "QuickBooks", fallbackInitials: "QB", fallbackColor: "bg-green-600", categoryHint: "Software", domain: "quickbooks.intuit.com", logoUrl: "https://logo.clearbit.com/quickbooks.intuit.com" },
  sage: { displayName: "Sage", fallbackInitials: "SG", fallbackColor: "bg-emerald-600", categoryHint: "Software" },
  freeagent: { displayName: "FreeAgent", fallbackInitials: "FA", fallbackColor: "bg-pink-500", categoryHint: "Software" },
  loom: { displayName: "Loom", fallbackInitials: "LM", fallbackColor: "bg-purple-500", categoryHint: "Software" },
  calendly: { displayName: "Calendly", fallbackInitials: "CL", fallbackColor: "bg-blue-500", categoryHint: "Software" },
  typeform: { displayName: "Typeform", fallbackInitials: "TF", fallbackColor: "bg-pink-500", categoryHint: "Software" },

  // Design tools
  adobe: { displayName: "Adobe", fallbackInitials: "AD", fallbackColor: "bg-red-600", categoryHint: "Software" },
  sketch: { displayName: "Sketch", fallbackInitials: "SK", fallbackColor: "bg-yellow-500", categoryHint: "Software" },
  canva: { displayName: "Canva", fallbackInitials: "CV", fallbackColor: "bg-teal-500", categoryHint: "Software" },
  invision: { displayName: "InVision", fallbackInitials: "IV", fallbackColor: "bg-pink-500", categoryHint: "Software" },

  // Communication
  discord: { displayName: "Discord", fallbackInitials: "DC", fallbackColor: "bg-indigo-500", categoryHint: "Software" },
  teams: { displayName: "Microsoft Teams", fallbackInitials: "TM", fallbackColor: "bg-blue-600", categoryHint: "Software" },
  webex: { displayName: "Webex", fallbackInitials: "WX", fallbackColor: "bg-green-600", categoryHint: "Software" },

  // Marketing
  mailchimp: { displayName: "Mailchimp", fallbackInitials: "MC", fallbackColor: "bg-yellow-500", categoryHint: "Marketing", domain: "mailchimp.com", logoUrl: "https://logo.clearbit.com/mailchimp.com" },
  convertkit: { displayName: "ConvertKit", fallbackInitials: "CK", fallbackColor: "bg-red-500", categoryHint: "Marketing" },
  klaviyo: { displayName: "Klaviyo", fallbackInitials: "KV", fallbackColor: "bg-purple-500", categoryHint: "Marketing" },
  buffer: { displayName: "Buffer", fallbackInitials: "BF", fallbackColor: "bg-blue-500", categoryHint: "Marketing" },
  hootsuite: { displayName: "Hootsuite", fallbackInitials: "HS", fallbackColor: "bg-orange-500", categoryHint: "Marketing" },

  // Food delivery
  deliveroo: { displayName: "Deliveroo", fallbackInitials: "DL", fallbackColor: "bg-teal-500", categoryHint: "Food and Meals" },
  "just eat": { displayName: "Just Eat", fallbackInitials: "JE", fallbackColor: "bg-orange-500", categoryHint: "Food and Meals" },
  foodpanda: { displayName: "Foodpanda", fallbackInitials: "FP", fallbackColor: "bg-pink-500", categoryHint: "Food and Meals" },
  grubhub: { displayName: "Grubhub", fallbackInitials: "GH", fallbackColor: "bg-orange-600", categoryHint: "Food and Meals" },
  doordash: { displayName: "DoorDash", fallbackInitials: "DD", fallbackColor: "bg-red-500", categoryHint: "Food and Meals" },

  // Transport
  lyft: { displayName: "Lyft", fallbackInitials: "LY", fallbackColor: "bg-pink-500", categoryHint: "Travel" },
  bolt: { displayName: "Bolt", fallbackInitials: "BT", fallbackColor: "bg-green-500", categoryHint: "Travel" },

  // Accommodation
  "booking.com": { displayName: "Booking.com", fallbackInitials: "BC", fallbackColor: "bg-blue-700", categoryHint: "Accommodation" },
  hostelworld: { displayName: "Hostelworld", fallbackInitials: "HW", fallbackColor: "bg-pink-500", categoryHint: "Accommodation" },
  marriott: { displayName: "Marriott", fallbackInitials: "MW", fallbackColor: "bg-red-700", categoryHint: "Accommodation" },
  hilton: { displayName: "Hilton", fallbackInitials: "HL", fallbackColor: "bg-blue-800", categoryHint: "Accommodation" },

  // Travel
  trainline: { displayName: "Trainline", fallbackInitials: "TL", fallbackColor: "bg-green-600", categoryHint: "Travel" },
  "national rail": { displayName: "National Rail", fallbackInitials: "NR", fallbackColor: "bg-red-600", categoryHint: "Travel" },
  eurostar: { displayName: "Eurostar", fallbackInitials: "ES", fallbackColor: "bg-yellow-600", categoryHint: "Travel" },
  easyjet: { displayName: "easyJet", fallbackInitials: "EJ", fallbackColor: "bg-orange-500", categoryHint: "Travel" },
  ryanair: { displayName: "Ryanair", fallbackInitials: "RY", fallbackColor: "bg-blue-700", categoryHint: "Travel" },

  // Education
  udemy: { displayName: "Udemy", fallbackInitials: "UD", fallbackColor: "bg-purple-600", categoryHint: "Training and Education" },
  coursera: { displayName: "Coursera", fallbackInitials: "CS", fallbackColor: "bg-blue-600", categoryHint: "Training and Education" },
  codecademy: { displayName: "Codecademy", fallbackInitials: "CC", fallbackColor: "bg-violet-500", categoryHint: "Training and Education" },
  pluralsight: { displayName: "Pluralsight", fallbackInitials: "PS", fallbackColor: "bg-pink-500", categoryHint: "Training and Education" },
  skillshare: { displayName: "Skillshare", fallbackInitials: "SS", fallbackColor: "bg-green-500", categoryHint: "Training and Education" },
  masterclass: { displayName: "MasterClass", fallbackInitials: "MC", fallbackColor: "bg-red-600", categoryHint: "Training and Education" },

  // Insurance
  aviva: { displayName: "Aviva", fallbackInitials: "AV", fallbackColor: "bg-blue-700", categoryHint: "Insurance" },
  axa: { displayName: "AXA", fallbackInitials: "AX", fallbackColor: "bg-red-700", categoryHint: "Insurance" },
  "direct line": { displayName: "Direct Line", fallbackInitials: "DL", fallbackColor: "bg-red-600", categoryHint: "Insurance" },
  allianz: { displayName: "Allianz", fallbackInitials: "AL", fallbackColor: "bg-blue-800", categoryHint: "Insurance" },
  prudential: { displayName: "Prudential", fallbackInitials: "PR", fallbackColor: "bg-blue-900", categoryHint: "Insurance" },

  // Shipping
  evri: { displayName: "Evri", fallbackInitials: "EV", fallbackColor: "bg-pink-500", categoryHint: "Shipping and Fulfilment" },
  parcel: { displayName: "Parcel", fallbackInitials: "PC", fallbackColor: "bg-orange-500", categoryHint: "Shipping and Fulfilment" },
  courier: { displayName: "Courier", fallbackInitials: "CR", fallbackColor: "bg-blue-500", categoryHint: "Shipping and Fulfilment" },

  // Ecommerce
  "bigcommerce": { displayName: "BigCommerce", fallbackInitials: "BC", fallbackColor: "bg-purple-600", categoryHint: "Revenue" },
  "woocommerce": { displayName: "WooCommerce", fallbackInitials: "WC", fallbackColor: "bg-purple-700", categoryHint: "Revenue" },
};

function normaliseKey(key: string): string {
  return key.toLowerCase().replace(/[^a-z0-9]/g, "").trim();
}

export function getProviderInfo(name: string): ProviderInfo | null {
  const key = normaliseKey(name);
  if (PROVIDER_REGISTRY[key]) return PROVIDER_REGISTRY[key];
  for (const [k, v] of Object.entries(PROVIDER_REGISTRY)) {
    if (key.includes(k) || k.includes(key)) return v;
  }
  return null;
}

export function getMerchantInitials(name: string): string {
  if (!name) return "?";
  const words = name.trim().split(/\s+/);
  if (words.length === 1) {
    return words[0].slice(0, 2).toUpperCase();
  }
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

export function getMerchantColor(name: string): string {
  const info = getProviderInfo(name);
  if (info) return info.fallbackColor;
  const colours = [
    "bg-slate-500", "bg-zinc-500", "bg-neutral-500", "bg-stone-500",
    "bg-red-500", "bg-orange-500", "bg-amber-500", "bg-yellow-500",
    "bg-lime-500", "bg-green-500", "bg-emerald-500", "bg-teal-500",
    "bg-cyan-500", "bg-sky-500", "bg-blue-500", "bg-indigo-500",
    "bg-violet-500", "bg-purple-500", "bg-fuchsia-500", "bg-pink-500",
    "bg-rose-500",
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colours[Math.abs(hash) % colours.length];
}
