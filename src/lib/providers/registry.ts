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
}

const PROVIDER_REGISTRY: Record<string, ProviderInfo> = {
  // Payment processors
  stripe: {
    displayName: "Stripe",
    fallbackInitials: "ST",
    fallbackColor: "bg-violet-500",
    categoryHint: "Revenue",
  },
  paypal: {
    displayName: "PayPal",
    fallbackInitials: "PP",
    fallbackColor: "bg-blue-600",
    categoryHint: "Revenue",
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
  },
  notion: {
    displayName: "Notion",
    fallbackInitials: "NO",
    fallbackColor: "bg-neutral-600",
    categoryHint: "Software",
  },
  figma: {
    displayName: "Figma",
    fallbackInitials: "FI",
    fallbackColor: "bg-purple-500",
    categoryHint: "Software",
  },
  zoom: {
    displayName: "Zoom",
    fallbackInitials: "ZM",
    fallbackColor: "bg-blue-500",
    categoryHint: "Software",
  },
  "google workspace": {
    displayName: "Google",
    fallbackInitials: "G",
    fallbackColor: "bg-red-500",
    categoryHint: "Software",
  },

  // Cloud
  aws: {
    displayName: "AWS",
    fallbackInitials: "AW",
    fallbackColor: "bg-amber-700",
    categoryHint: "Cloud Infrastructure",
  },
  vercel: {
    displayName: "Vercel",
    fallbackInitials: "VC",
    fallbackColor: "bg-neutral-900",
    categoryHint: "Cloud Infrastructure",
  },
  cloudflare: {
    displayName: "Cloudflare",
    fallbackInitials: "CF",
    fallbackColor: "bg-orange-600",
    categoryHint: "Cloud Infrastructure",
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
    categoryHint: "Bank Fees",
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
  },
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
