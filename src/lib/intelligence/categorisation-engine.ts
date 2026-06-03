/**
 * Universal Categorisation Engine v2
 *
 * Multi-layered categorisation that reads ALL transaction fields and
 * combines signals intelligently. Works for ANY business model.
 *
 * Architecture:
 *   1. Extract signals from all transaction fields
 *   2. Run each layer independently to gather evidence
 *   3. Combine evidence using weighted aggregation
 *   4. Produce honest confidence score + explanation
 */

import { detectPersonalName } from "./personal-name-detector";
import { normaliseMerchant } from "./merchant-enrichment";

export type BusinessModel =
  | "saas"
  | "ecommerce"
  | "services"
  | "consultancy"
  | "agency"
  | "coaching"
  | "marketplace"
  | "subscription"
  | "physical_products"
  | "mixed"
  | "unknown";

export interface TransactionContext {
  description?: string;
  merchant?: string;
  reference?: string;
  amount: number;
  type: "income" | "expense";
  currency?: string;
  transactionType?: string; // card_payment, transfer, topup, etc.
  date?: string;
  provider?: string; // revolut, stripe, etc.
  metadata?: Record<string, unknown>;
  rawData?: Record<string, unknown>;
  // Extended signals
  feeAmount?: number;
  originalCurrency?: string;
  merchantCategoryCode?: string;
  counterpartyName?: string;
  payerName?: string;
  payeeName?: string;
  accountName?: string;
  cardDetails?: string;
  relatedTransactionId?: string;
  isTransfer?: boolean;
  isFee?: boolean;
}

export interface BusinessContext {
  model: BusinessModel;
  industry?: string;
  currency?: string;
  country?: string;
  userRules: UserCorrectionRule[];
}

export interface UserCorrectionRule {
  merchantPattern?: string;
  descriptionPattern?: string;
  referencePattern?: string;
  provider?: string;
  direction?: "income" | "expense";
  category: string;
  confidenceBoost: number;
}

export interface CategoryEvidence {
  category: string;
  confidence: number; // 0-100
  source: EvidenceSource;
  reason: string;
}

export type EvidenceSource =
  | "user_rule"
  | "merchant_registry"
  | "reference_pattern"
  | "description_keyword"
  | "description_phrase"
  | "processor_detection"
  | "transfer_detection"
  | "transaction_type"
  | "recurrence_pattern"
  | "business_model_boost"
  | "personal_name"
  | "amount_pattern"
  | "provider_hint"
  | "merchant_extraction"
  | "raw_field_signal"
  | "payment_method_context"
  | "review_guard";

export interface CategorisationResult {
  category: string;
  subcategory?: string;
  confidence: number;
  categoryConfidence: number;
  groupingConfidence: number;
  status: "categorised" | "ai_suggested" | "needs_review";
  reviewStatus: "auto_categorised" | "suggested" | "needs_review";
  reason: string;
  evidence: CategoryEvidence[];
  originalMerchant?: string;
  normalisedMerchant?: string;
  displayMerchant?: string;
  description?: string;
  reference?: string;
  transactionType?: string;
  kpiTreatment: "included" | "excluded";
  incomeExpenseStatus: "income" | "expense";
  businessMeaning?: string;
  isTransfer: boolean;
  isCreditCardRepayment: boolean;
  isSubscription: boolean;
  isRecurring: boolean;
  isPersonalName: boolean;
}

// ─── Universal Merchant Registry ──────────────────────────────────────

interface RegistryEntry {
  category: string;
  confidence: number;
  reason: string;
  businessModels?: BusinessModel[]; // If specified, only match these models
  incomeCategory?: string; // Different category for income vs expense
  expenseCategory?: string;
}

const UNIVERSAL_MERCHANT_REGISTRY: Record<string, RegistryEntry> = {
  // Payment processors
  stripe: { category: "Revenue", confidence: 90, reason: "Stripe is a payment processor — incoming likely payout/revenue", incomeCategory: "Revenue", expenseCategory: "Payment Processor Fees" },
  paypal: { category: "Revenue", confidence: 85, reason: "PayPal is a payment processor — incoming likely payout/revenue", incomeCategory: "Revenue", expenseCategory: "Payment Processor Fees" },
  square: { category: "Revenue", confidence: 85, reason: "Square is a payment processor — incoming likely payout/revenue", incomeCategory: "Revenue", expenseCategory: "Payment Processor Fees" },
  gocardless: { category: "Revenue", confidence: 80, reason: "GoCardless is a payment processor — incoming likely payout/revenue", incomeCategory: "Revenue", expenseCategory: "Bank Fees" },
  sumup: { category: "Revenue", confidence: 80, reason: "SumUp is a payment processor — incoming likely payout/revenue", incomeCategory: "Revenue", expenseCategory: "Payment Processor Fees" },
  worldpay: { category: "Revenue", confidence: 80, reason: "Worldpay is a payment processor — incoming likely payout/revenue", incomeCategory: "Revenue", expenseCategory: "Payment Processor Fees" },
  shopify: { category: "Revenue", confidence: 90, reason: "Shopify is an ecommerce platform — incoming likely sales revenue", incomeCategory: "Revenue", expenseCategory: "Software" },
  woocommerce: { category: "Revenue", confidence: 85, reason: "WooCommerce is an ecommerce platform — incoming likely sales revenue", incomeCategory: "Revenue", expenseCategory: "Software" },

  // Ecommerce marketplaces
  amazon: { category: "Revenue", confidence: 85, reason: "Amazon is a marketplace — incoming likely sales revenue", incomeCategory: "Revenue", expenseCategory: "Office Costs" },
  ebay: { category: "Revenue", confidence: 80, reason: "eBay is a marketplace — incoming likely sales revenue", incomeCategory: "Revenue", expenseCategory: "Office Costs" },
  etsy: { category: "Revenue", confidence: 80, reason: "Etsy is a marketplace — incoming likely sales revenue", incomeCategory: "Revenue", expenseCategory: "Office Costs" },

  // Cloud infrastructure
  aws: { category: "Cloud Infrastructure", confidence: 95, reason: "AWS is cloud infrastructure" },
  "amazon web services": { category: "Cloud Infrastructure", confidence: 95, reason: "AWS is cloud infrastructure" },
  vercel: { category: "Cloud Infrastructure", confidence: 90, reason: "Vercel is cloud hosting" },
  cloudflare: { category: "Cloud Infrastructure", confidence: 90, reason: "Cloudflare is cloud/CDN infrastructure" },
  "google cloud": { category: "Cloud Infrastructure", confidence: 90, reason: "Google Cloud is cloud infrastructure" },
  azure: { category: "Cloud Infrastructure", confidence: 90, reason: "Azure is cloud infrastructure" },
  heroku: { category: "Cloud Infrastructure", confidence: 85, reason: "Heroku is cloud hosting" },
  digitalocean: { category: "Cloud Infrastructure", confidence: 85, reason: "DigitalOcean is cloud hosting" },
  linode: { category: "Cloud Infrastructure", confidence: 85, reason: "Linode is cloud hosting" },
  fastly: { category: "Cloud Infrastructure", confidence: 85, reason: "Fastly is CDN infrastructure" },
  akamai: { category: "Cloud Infrastructure", confidence: 85, reason: "Akamai is CDN infrastructure" },

  // AI tools
  openai: { category: "AI Tools", confidence: 95, reason: "OpenAI provides AI/LLM services" },
  anthropic: { category: "AI Tools", confidence: 95, reason: "Anthropic provides AI/LLM services" },
  claude: { category: "AI Tools", confidence: 95, reason: "Claude is an AI assistant" },
  perplexity: { category: "AI Tools", confidence: 85, reason: "Perplexity is an AI search tool" },
  groq: { category: "AI Tools", confidence: 85, reason: "Groq provides AI inference" },
  replicate: { category: "AI Tools", confidence: 85, reason: "Replicate provides AI model hosting" },
  huggingface: { category: "AI Tools", confidence: 85, reason: "Hugging Face provides AI models" },
  cohere: { category: "AI Tools", confidence: 85, reason: "Cohere provides AI/LLM services" },
  kimi: { category: "AI Tools", confidence: 85, reason: "Kimi is an AI assistant" },

  // Software / SaaS
  notion: { category: "Software", confidence: 90, reason: "Notion is productivity SaaS" },
  figma: { category: "Software", confidence: 90, reason: "Figma is design SaaS" },
  slack: { category: "Software", confidence: 90, reason: "Slack is communication SaaS" },
  zoom: { category: "Software", confidence: 90, reason: "Zoom is video conferencing SaaS" },
  loom: { category: "Software", confidence: 85, reason: "Loom is video messaging SaaS" },
  calendly: { category: "Software", confidence: 85, reason: "Calendly is scheduling SaaS" },
  typeform: { category: "Software", confidence: 85, reason: "Typeform is form builder SaaS" },
  airtable: { category: "Software", confidence: 85, reason: "Airtable is database SaaS" },
  github: { category: "Software", confidence: 90, reason: "GitHub is developer SaaS" },
  gitlab: { category: "Software", confidence: 90, reason: "GitLab is developer SaaS" },
  bitbucket: { category: "Software", confidence: 85, reason: "Bitbucket is developer SaaS" },
  docker: { category: "Software", confidence: 85, reason: "Docker is developer infrastructure" },
  zapier: { category: "Software", confidence: 85, reason: "Zapier is automation SaaS" },
  "make.com": { category: "Software", confidence: 85, reason: "Make is automation SaaS" },
  n8n: { category: "Software", confidence: 85, reason: "n8n is automation SaaS" },
  pipedrive: { category: "Software", confidence: 80, reason: "Pipedrive is CRM SaaS" },
  hubspot: { category: "Software", confidence: 80, reason: "HubSpot is CRM/marketing SaaS" },
  salesforce: { category: "Software", confidence: 80, reason: "Salesforce is CRM SaaS" },
  "close.io": { category: "Software", confidence: 80, reason: "Close is CRM SaaS" },
  outreach: { category: "Software", confidence: 80, reason: "Outreach is sales SaaS" },
  apollo: { category: "Software", confidence: 80, reason: "Apollo is sales intelligence SaaS" },
  zoominfo: { category: "Software", confidence: 80, reason: "ZoomInfo is sales intelligence SaaS" },

  // Marketing tools
  mailchimp: { category: "Marketing", confidence: 85, reason: "Mailchimp is email marketing SaaS" },
  klaviyo: { category: "Marketing", confidence: 85, reason: "Klaviyo is email marketing SaaS" },
  activecampaign: { category: "Marketing", confidence: 85, reason: "ActiveCampaign is marketing automation" },
  convertkit: { category: "Marketing", confidence: 85, reason: "ConvertKit is email marketing" },
  beehiiv: { category: "Marketing", confidence: 85, reason: "Beehiiv is email newsletter SaaS" },
  substack: { category: "Marketing", confidence: 80, reason: "Substack is newsletter platform" },
  semrush: { category: "Marketing", confidence: 85, reason: "SEMrush is SEO/marketing tool" },
  ahrefs: { category: "Marketing", confidence: 85, reason: "Ahrefs is SEO tool" },

  // Accounting
  xero: { category: "Professional Services", confidence: 90, reason: "Xero is accounting software" },
  quickbooks: { category: "Professional Services", confidence: 90, reason: "QuickBooks is accounting software" },
  sage: { category: "Professional Services", confidence: 90, reason: "Sage is accounting software" },
  freeagent: { category: "Professional Services", confidence: 85, reason: "FreeAgent is accounting software" },

  // Communication
  twilio: { category: "Software", confidence: 85, reason: "Twilio is communication API" },
  sendgrid: { category: "Software", confidence: 85, reason: "SendGrid is email API" },
  postmark: { category: "Software", confidence: 85, reason: "Postmark is email API" },

  // Advertising
  "google ads": { category: "Advertising", confidence: 95, reason: "Google Ads is advertising spend" },
  "facebook ads": { category: "Advertising", confidence: 95, reason: "Facebook Ads is advertising spend" },
  meta: { category: "Advertising", confidence: 90, reason: "Meta is an advertising/social platform" },
  "meta platforms": { category: "Advertising", confidence: 90, reason: "Meta Platforms is commonly advertising spend for businesses" },
  facebook: { category: "Advertising", confidence: 88, reason: "Facebook is commonly advertising/social spend for businesses" },
  instagram: { category: "Advertising", confidence: 88, reason: "Instagram is commonly advertising/social spend for businesses" },
  "instagram ads": { category: "Advertising", confidence: 95, reason: "Instagram Ads is advertising spend" },
  "linkedin ads": { category: "Advertising", confidence: 95, reason: "LinkedIn Ads is advertising spend" },
  "twitter ads": { category: "Advertising", confidence: 95, reason: "Twitter/X Ads is advertising spend" },
  "x ads": { category: "Advertising", confidence: 95, reason: "X Ads is advertising spend" },
  "tiktok ads": { category: "Advertising", confidence: 95, reason: "TikTok Ads is advertising spend" },
  "snapchat ads": { category: "Advertising", confidence: 95, reason: "Snapchat Ads is advertising spend" },
  "pinterest ads": { category: "Advertising", confidence: 95, reason: "Pinterest Ads is advertising spend" },
  "microsoft advertising": { category: "Advertising", confidence: 90, reason: "Microsoft Ads is advertising spend" },

  // Apple
  apple: { category: "Software", confidence: 75, reason: "Apple — likely Software, Subscriptions, Cloud Services, or Hardware depending on amount/recurrence" },
  "apple.com": { category: "Software", confidence: 80, reason: "Apple.com — likely Software or Subscriptions unless amount suggests hardware" },
  "apple music": { category: "Subscriptions", confidence: 85, reason: "Apple Music is subscription" },
  "apple tv": { category: "Subscriptions", confidence: 85, reason: "Apple TV is subscription" },
  icloud: { category: "Cloud Infrastructure", confidence: 85, reason: "iCloud is cloud storage" },

  // Microsoft
  microsoft: { category: "Software", confidence: 85, reason: "Microsoft — likely Software or Cloud Services" },
  "microsoft 365": { category: "Software", confidence: 90, reason: "Microsoft 365 is productivity SaaS" },
  "office 365": { category: "Software", confidence: 90, reason: "Office 365 is productivity SaaS" },
  onedrive: { category: "Cloud Infrastructure", confidence: 85, reason: "OneDrive is cloud storage" },

  // Google
  google: { category: "Software", confidence: 75, reason: "Google — likely Software, Ads, or Cloud Services" },
  "google workspace": { category: "Software", confidence: 90, reason: "Google Workspace is productivity SaaS" },
  "gsuite": { category: "Software", confidence: 90, reason: "G Suite is productivity SaaS" },
  gmail: { category: "Software", confidence: 80, reason: "Gmail is communication SaaS" },

  // Design / Creative
  adobe: { category: "Software", confidence: 90, reason: "Adobe is creative software" },
  canva: { category: "Software", confidence: 90, reason: "Canva is creative/design SaaS" },
  sketch: { category: "Software", confidence: 85, reason: "Sketch is design software" },
  invision: { category: "Software", confidence: 85, reason: "InVision is design SaaS" },
  picsart: { category: "Software", confidence: 80, reason: "Picsart is creative/design software" },
  "gamma.app": { category: "Software", confidence: 85, reason: "Gamma.app is presentation/design software" },
  gamma: { category: "Software", confidence: 75, reason: "Gamma is likely presentation/design software when used as a merchant" },
  pdfhouse: { category: "Software", confidence: 70, reason: "PDFHouse is likely document/PDF software" },

  // Credit cards
  "capital on tap": { category: "Credit Card Payment", confidence: 90, reason: "Capital On Tap is a business credit card provider" },
  "capital one": { category: "Credit Card Payment", confidence: 90, reason: "Capital One is a credit card provider" },
  amex: { category: "Credit Card Payment", confidence: 90, reason: "American Express is a credit card provider" },
  "american express": { category: "Credit Card Payment", confidence: 90, reason: "American Express is a credit card provider" },
  barclaycard: { category: "Credit Card Payment", confidence: 90, reason: "Barclaycard is a credit card provider" },
  "lloyds card": { category: "Credit Card Payment", confidence: 90, reason: "Lloyds Card is a credit card provider" },
  "tide credit": { category: "Credit Card Payment", confidence: 90, reason: "Tide Credit is a business credit card" },
  "revolut card": { category: "Credit Card Payment", confidence: 90, reason: "Revolut Card is a credit card provider" },

  // Shipping
  fedex: { category: "Shipping and Fulfilment", confidence: 90, reason: "FedEx is shipping/courier" },
  ups: { category: "Shipping and Fulfilment", confidence: 90, reason: "UPS is shipping/courier" },
  dhl: { category: "Shipping and Fulfilment", confidence: 90, reason: "DHL is shipping/courier" },
  "royal mail": { category: "Shipping and Fulfilment", confidence: 90, reason: "Royal Mail is postal service" },
  usps: { category: "Shipping and Fulfilment", confidence: 90, reason: "USPS is postal service" },
  "parcel force": { category: "Shipping and Fulfilment", confidence: 85, reason: "Parcelforce is courier" },
  hermes: { category: "Shipping and Fulfilment", confidence: 85, reason: "Hermes/Evri is courier" },
  evri: { category: "Shipping and Fulfilment", confidence: 85, reason: "Evri is courier" },

  // Utilities
  "british gas": { category: "Utilities", confidence: 85, reason: "British Gas is energy utility" },
  "octopus energy": { category: "Utilities", confidence: 85, reason: "Octopus Energy is energy utility" },
  edf: { category: "Utilities", confidence: 85, reason: "EDF is energy utility" },
  eon: { category: "Utilities", confidence: 85, reason: "E.ON is energy utility" },
  "scottish power": { category: "Utilities", confidence: 85, reason: "Scottish Power is energy utility" },
  npower: { category: "Utilities", confidence: 85, reason: "npower is energy utility" },
  bulb: { category: "Utilities", confidence: 85, reason: "Bulb is energy utility" },
  bt: { category: "Utilities", confidence: 85, reason: "BT is telecom utility" },
  "virgin media": { category: "Utilities", confidence: 85, reason: "Virgin Media is telecom utility" },
  sky: { category: "Utilities", confidence: 80, reason: "Sky is telecom/media" },
  o2: { category: "Utilities", confidence: 80, reason: "O2 is mobile telecom" },
  vodafone: { category: "Utilities", confidence: 80, reason: "Vodafone is mobile telecom" },
  ee: { category: "Utilities", confidence: 80, reason: "EE is mobile telecom" },
  three: { category: "Utilities", confidence: 80, reason: "Three is mobile telecom" },

  // Insurance
  aviva: { category: "Insurance", confidence: 85, reason: "Aviva is insurance provider" },
  axa: { category: "Insurance", confidence: 85, reason: "AXA is insurance provider" },
  allianz: { category: "Insurance", confidence: 85, reason: "Allianz is insurance provider" },
  "direct line": { category: "Insurance", confidence: 85, reason: "Direct Line is insurance provider" },
  admiral: { category: "Insurance", confidence: 85, reason: "Admiral is insurance provider" },
  hiscox: { category: "Insurance", confidence: 85, reason: "Hiscox is insurance provider" },
  qbe: { category: "Insurance", confidence: 85, reason: "QBE is insurance provider" },
  zurich: { category: "Insurance", confidence: 85, reason: "Zurich is insurance provider" },

  // Tax
  hmrc: { category: "Tax", confidence: 95, reason: "HMRC is UK tax authority" },
  irs: { category: "Tax", confidence: 95, reason: "IRS is US tax authority" },
  vat: { category: "Tax", confidence: 85, reason: "VAT is tax payment" },

  // Food delivery
  deliveroo: { category: "Food and Meals", confidence: 80, reason: "Deliveroo is food delivery" },
  ubereats: { category: "Food and Meals", confidence: 80, reason: "Uber Eats is food delivery" },
  "uber eats": { category: "Food and Meals", confidence: 80, reason: "Uber Eats is food delivery" },
  "just eat": { category: "Food and Meals", confidence: 80, reason: "Just Eat is food delivery" },

  // Travel
  trainline: { category: "Travel", confidence: 85, reason: "Trainline is rail ticketing" },
  "british airways": { category: "Travel", confidence: 85, reason: "British Airways is airline" },
  easyjet: { category: "Travel", confidence: 85, reason: "EasyJet is airline" },
  ryanair: { category: "Travel", confidence: 85, reason: "Ryanair is airline" },
  "virgin atlantic": { category: "Travel", confidence: 85, reason: "Virgin Atlantic is airline" },
  airbnb: { category: "Travel", confidence: 85, reason: "Airbnb is accommodation" },
  booking: { category: "Travel", confidence: 85, reason: "Booking.com is accommodation" },

  // Subscriptions
  netflix: { category: "Subscriptions", confidence: 85, reason: "Netflix is subscription" },
  spotify: { category: "Subscriptions", confidence: 85, reason: "Spotify is subscription" },
  disney: { category: "Subscriptions", confidence: 85, reason: "Disney+ is subscription" },
  "youtube premium": { category: "Subscriptions", confidence: 85, reason: "YouTube Premium is subscription" },
  "amazon prime": { category: "Subscriptions", confidence: 85, reason: "Amazon Prime is subscription" },
  "snap fitness": { category: "Personal Spending", confidence: 65, reason: "Fitness/gym membership is often personal unless the user marks it as business-related" },

  // Education
  udemy: { category: "Training and Education", confidence: 75, reason: "Udemy is online learning" },
  coursera: { category: "Training and Education", confidence: 75, reason: "Coursera is online learning" },
  skillshare: { category: "Training and Education", confidence: 75, reason: "Skillshare is online learning" },
  pluralsight: { category: "Training and Education", confidence: 75, reason: "Pluralsight is tech learning" },

  // Specific known merchants
  fiverr: { category: "Contractors", confidence: 82, reason: "Fiverr is a freelance/contractor marketplace" },
  upwork: { category: "Contractors", confidence: 82, reason: "Upwork is a freelance/contractor marketplace" },
  highlevel: { category: "Software", confidence: 92, reason: "HighLevel (GoHighLevel) is marketing automation SaaS" },
  "highlevel inc": { category: "Software", confidence: 92, reason: "HighLevel Inc is marketing automation SaaS" },
  "highlevel agency sub": { category: "Software", confidence: 92, reason: "HighLevel agency subscription is marketing automation SaaS" },
  gohighlevel: { category: "Software", confidence: 92, reason: "GoHighLevel is marketing automation SaaS" },
  eventsconnecter: { category: "Software", confidence: 75, reason: "Eventsconnecter is event management platform" },
  gusto: { category: "Software", confidence: 85, reason: "Gusto is payroll/HR SaaS" },
  deel: { category: "Software", confidence: 85, reason: "Deel is payroll/HR SaaS" },
  "remote.com": { category: "Software", confidence: 85, reason: "Remote.com is payroll/HR SaaS" },
  wholesaler: { category: "COGS", confidence: 70, reason: "Wholesaler/supplier — likely inventory or COGS" },
  supplier: { category: "COGS", confidence: 70, reason: "Supplier — likely inventory or COGS" },

  // AI tools
  manus: { category: "AI Tools", confidence: 90, reason: "Manus AI is an AI tool" },
  "manus ai": { category: "AI Tools", confidence: 90, reason: "Manus AI is an AI tool" },
  "fireflies.ai": { category: "AI Tools", confidence: 90, reason: "Fireflies.ai is AI meeting software" },
  fireflies: { category: "AI Tools", confidence: 85, reason: "Fireflies is AI meeting software" },

  // Software
  skool: { category: "Software", confidence: 85, reason: "Skool is a community platform" },
  "skool.com": { category: "Software", confidence: 85, reason: "Skool is a community platform" },
  base44: { category: "Software", confidence: 90, reason: "Base44 is a no-code platform" },
  digitbook: { category: "Software", confidence: 70, reason: "Digitbook appears to be digital/software spend" },

  // Groceries
  asda: { category: "Food and Meals", confidence: 85, reason: "Asda is a grocery store" },
  tesco: { category: "Food and Meals", confidence: 85, reason: "Tesco is a grocery store" },
  sainsburys: { category: "Food and Meals", confidence: 85, reason: "Sainsbury's is a grocery store" },
  "sainsbury's": { category: "Food and Meals", confidence: 85, reason: "Sainsbury's is a grocery store" },
  sainsbury: { category: "Food and Meals", confidence: 85, reason: "Sainsbury's is a grocery store" },

  // Financial / Transfer
  remitly: { category: "Transfers", confidence: 85, reason: "Remitly is a money transfer service" },
  lemfi: { category: "Transfers", confidence: 85, reason: "LemFi is a money transfer service" },
  bumper: { category: "Financial Services", confidence: 80, reason: "Bumper is a financial services provider" },
  "bumper.co.uk": { category: "Financial Services", confidence: 80, reason: "Bumper is a financial services provider" },

  // Shopping
  klarna: { category: "Ambiguous", confidence: 35, reason: "Klarna is payment method context; inspect underlying merchant before categorising" },
  "klarna*amazon": { category: "Office Costs", confidence: 78, reason: "Amazon purchase via Klarna; Klarna is payment method context" },
  "nyx*asda": { category: "Shopping", confidence: 70, reason: "Purchase via Asda" },
  primark: { category: "Personal Spending", confidence: 60, reason: "Primark retail spend is usually personal unless confirmed as business-related" },
  prima: { category: "Personal Spending", confidence: 55, reason: "Retail/leisure merchant is unclear and likely personal unless confirmed" },
  "must have ideas": { category: "Shopping", confidence: 65, reason: "Retail/product merchant spend" },

  // Restaurant
  ades: { category: "Food and Meals", confidence: 70, reason: "Ades Ltd is a restaurant/cafe" },
  "ades ltd": { category: "Food and Meals", confidence: 70, reason: "Ades Ltd is a restaurant/cafe" },
  mcdonalds: { category: "Food and Meals", confidence: 75, reason: "McDonald's is food and meals" },
  "mcdonald's": { category: "Food and Meals", confidence: 75, reason: "McDonald's is food and meals" },
  efes: { category: "Food and Meals", confidence: 70, reason: "Efes is likely restaurant/food spend" },
  aldi: { category: "Food and Meals", confidence: 75, reason: "Aldi is a grocery retailer" },
  boots: { category: "Office Costs", confidence: 65, reason: "Boots is pharmacy/retail; likely office or staff supplies if business-related" },
  ikea: { category: "Office Costs", confidence: 70, reason: "IKEA is furniture/homeware; often office or premises cost if business-related" },
  dunelm: { category: "Office Costs", confidence: 65, reason: "Dunelm is homeware/furnishings; likely office or premises cost if business-related" },
  "marks&spencer": { category: "Food and Meals", confidence: 70, reason: "Marks & Spencer food/grocery spend" },
  "m&s": { category: "Food and Meals", confidence: 70, reason: "M&S food/grocery spend" },
  "market butchers": { category: "Food and Meals", confidence: 70, reason: "Butcher/food retailer spend" },
  "all fresh food market": { category: "Food and Meals", confidence: 70, reason: "Food market spend" },
  "ksn foods": { category: "Food and Meals", confidence: 70, reason: "Food merchant spend" },

  // Automotive
  "greenhithe hand car wash": { category: "Automotive", confidence: 75, reason: "Car wash service" },
  ncp: { category: "Travel", confidence: 75, reason: "NCP is car parking/travel spend" },
  "ncp limited": { category: "Travel", confidence: 75, reason: "NCP is car parking/travel spend" },
  "gatwick airport": { category: "Travel", confidence: 78, reason: "Airport spend is travel-related" },
  "canary wharf car parks": { category: "Travel", confidence: 75, reason: "Car park spend is travel/parking" },
  dvla: { category: "Automotive", confidence: 70, reason: "DVLA is vehicle administration/tax context" },
  cex: { category: "Office Costs", confidence: 65, reason: "CeX is electronics retail; likely equipment/office cost if business-related" },
  companieshouse: { category: "Professional Services", confidence: 75, reason: "Companies House filing/admin fee" },
  "companies house": { category: "Professional Services", confidence: 75, reason: "Companies House filing/admin fee" },
  "zam call": { category: "Utilities", confidence: 65, reason: "Call/telecom spend" },

  // Leisure / likely personal unless confirmed as business-related
  "national trust": { category: "Personal Spending", confidence: 60, reason: "National Trust/leisure spend is usually personal unless confirmed as business-related" },
  "vue entertainment": { category: "Personal Spending", confidence: 60, reason: "Cinema/leisure spend is usually personal unless confirmed as business-related" },
  "gravity max": { category: "Personal Spending", confidence: 60, reason: "Leisure spend is usually personal unless confirmed as business-related" },
  "historic royal": { category: "Personal Spending", confidence: 60, reason: "Leisure/tourism spend is usually personal unless confirmed as business-related" },
  "hist royal palaces": { category: "Personal Spending", confidence: 60, reason: "Leisure/tourism spend is usually personal unless confirmed as business-related" },
};

// ─── Keyword/Phrase Intelligence ─────────────────────────────────────

interface KeywordPattern {
  keywords: string[];
  category: string;
  confidence: number;
  reason: string;
  amountCondition?: "positive" | "negative";
  businessModels?: BusinessModel[];
}

const KEYWORD_PATTERNS: KeywordPattern[] = [
  // Revenue signals
  { keywords: ["payout", "payouts", "settlement"], category: "Revenue", confidence: 80, reason: "Payout/settlement usually indicates revenue from processor" },
  { keywords: ["sales", "order payment", "customer payment"], category: "Revenue", confidence: 85, reason: "Sales/customer payment is revenue" },
  { keywords: ["client payment", "client fee", "retainer payment", "monthly retainer", "retainer"], category: "Revenue", confidence: 85, reason: "Client payment is revenue" },
  { keywords: ["consultancy fee payment", "consulting fee received"], category: "Revenue", confidence: 85, reason: "Consultancy fee payment is revenue" },
  { keywords: ["refund received", "refund incoming", "chargeback reversed"], category: "Revenue", confidence: 75, reason: "Incoming refund/chargeback reversal" },
  { keywords: ["dividend", "dividends"], category: "Owner Drawings", confidence: 80, reason: "Dividend payment" },
  { keywords: ["capital injection", "investment received", "funding received"], category: "Capital Injection", confidence: 85, reason: "Investment or funding received", amountCondition: "positive" },
  { keywords: ["loan received", "loan drawdown"], category: "Capital Injection", confidence: 75, reason: "Loan received" },

  // Expense signals
  { keywords: ["commission received", "sales commission received", "affiliate commission received"], category: "Revenue", confidence: 82, reason: "Incoming commission received is revenue", amountCondition: "positive" },
  { keywords: ["sales rep commission", "marketing commission", "commission payout", "affiliate payout", "referal pay out", "referral pay out", "referral payout", "sales commission", "commission"], category: "Sales Commission", confidence: 86, reason: "Commission payout is a sales/marketing commission expense", amountCondition: "negative" },
  { keywords: ["consultancy", "consulting fee", "consultant fee", "advisory fee"], category: "Professional Services", confidence: 80, reason: "Consultancy/advisory fee" },
  { keywords: ["director fee", "directors fee", "board fee"], category: "Professional Services", confidence: 75, reason: "Director/board fee" },
  { keywords: ["salary", "wages", "payroll", "employee pay", "engagement manager"], category: "Payroll", confidence: 90, reason: "Salary/wages payment" },
  { keywords: ["pension", "auto-enrolment", "workplace pension"], category: "Payroll", confidence: 90, reason: "Pension contribution" },
  { keywords: ["rent", "lease", "lease payment", "property rent"], category: "Office Costs", confidence: 85, reason: "Rent/lease payment" },
  { keywords: ["tax", "corporation tax", "income tax", "self assessment"], category: "Tax", confidence: 90, reason: "Tax payment" },
  { keywords: ["vat", "vat payment", "vat return"], category: "Tax", confidence: 90, reason: "VAT payment" },
  { keywords: ["insurance premium", "policy payment", "insurance"], category: "Insurance", confidence: 80, reason: "Insurance premium" },
  { keywords: ["software", "saas", "app subscription", "license"], category: "Software", confidence: 80, reason: "Software/SaaS payment" },
  { keywords: ["cloud hosting", "server hosting", "hosting"], category: "Cloud Infrastructure", confidence: 80, reason: "Hosting/cloud infrastructure" },
  { keywords: ["advertising", "ads", "ad spend", "campaign", "ppc"], category: "Advertising", confidence: 85, reason: "Advertising spend" },
  { keywords: ["marketing", "seo", "content marketing", "video shoot payment", "challenge 1st price", "challenge 3rd price"], category: "Marketing", confidence: 70, reason: "Marketing spend" },
  { keywords: ["contractor", "freelancer", " freelancer payment", "freelance fee"], category: "Contractors", confidence: 80, reason: "Contractor/freelancer payment" },
  { keywords: ["fiverr", "upwork", "freelance marketplace"], category: "Contractors", confidence: 82, reason: "Freelance/contractor marketplace spend" },
  { keywords: ["supplier", "vendor payment", "supplier payment", "invoice payment"], category: "COGS", confidence: 75, reason: "Supplier/vendor payment" },
  { keywords: ["inventory", "stock purchase", "inventory purchase", "raw materials"], category: "COGS", confidence: 80, reason: "Inventory/stock purchase", businessModels: ["ecommerce", "physical_products"] },
  { keywords: ["shipping", "fulfilment", "logistics", "warehouse"], category: "Shipping and Fulfilment", confidence: 80, reason: "Shipping/fulfilment cost" },
  { keywords: ["bank fee", "account fee", "service charge", "overdraft"], category: "Bank Fees", confidence: 80, reason: "Bank fee/charge" },
  { keywords: ["interest charge", "card interest", "loan interest"], category: "Interest Charges", confidence: 85, reason: "Interest charge" },
  { keywords: ["credit card fee", "card fee", "annual fee"], category: "Credit Card Fees", confidence: 85, reason: "Credit card fee" },
  { keywords: ["transfer to", "transfer from", "internal transfer"], category: "Transfers", confidence: 70, reason: "Internal transfer between accounts" },
  { keywords: ["owner drawing", "director loan", "director withdrawal", "family support", "gift to family"], category: "Owner Drawings", confidence: 75, reason: "Owner/director drawing or family support payment" },
  { keywords: ["personal", "personal spending", "personal use"], category: "Personal Spending", confidence: 65, reason: "Personal spending" },
  { keywords: ["gym", "fitness", "snapfitness", "snap fitness"], category: "Personal Spending", confidence: 65, reason: "Fitness/gym spend is usually personal unless confirmed as business-related" },
  { keywords: ["dental", "dentist"], category: "Personal Spending", confidence: 65, reason: "Dental/health spend is usually personal unless confirmed as business-related" },
  { keywords: ["cinema", "vue entertainment", "national trust", "historic royal", "royal pavilion", "gravity max"], category: "Personal Spending", confidence: 60, reason: "Leisure/tourism spend is usually personal unless confirmed as business-related" },

  // Transfer signals
  { keywords: ["credit card repayment", "card repayment", "credit card payment", "moneyway", "close brothers"], category: "Credit Card Payment", confidence: 85, reason: "Credit card or loan repayment" },
  { keywords: ["top up", "top-up", "account top up"], category: "Ambiguous", confidence: 45, reason: "Top-up without processor/capital context is ambiguous" },

  // Refunds
  { keywords: ["refund", "refunded", "return", "money back", "reimbursement", "over payment"], category: "Refunds", confidence: 70, reason: "Refund/return" },

  // HighLevel specific
  { keywords: ["highlevel", "gohighlevel", "high level", "agency sub"], category: "Software", confidence: 85, reason: "HighLevel/GoHighLevel is marketing automation SaaS" },
  { keywords: ["eventsconnecter", "events connector"], category: "Software", confidence: 70, reason: "Eventsconnecter is event management platform" },

  // Apple specific
  { keywords: ["apple.com", "apple store", "apple services"], category: "Software", confidence: 75, reason: "Apple — likely Software or Subscriptions" },
  { keywords: ["apple music", "apple tv", "apple arcade"], category: "Subscriptions", confidence: 85, reason: "Apple subscription service" },
  { keywords: ["icloud", "apple icloud"], category: "Cloud Infrastructure", confidence: 85, reason: "iCloud is cloud storage" },

  // Stripe specific
  { keywords: ["stripe top up", "stripe payout", "stripe revenue"], category: "Revenue", confidence: 95, reason: "Stripe payout/revenue", amountCondition: "positive" },
  { keywords: ["stripe fee", "stripe charge"], category: "Payment Processor Fees", confidence: 95, reason: "Stripe fee/charge" },

  // Processor-specific patterns (description-based fallback)
  { keywords: ["aws", "amazon web services"], category: "Cloud Infrastructure", confidence: 90, reason: "AWS cloud infrastructure" },
  { keywords: ["vercel"], category: "Cloud Infrastructure", confidence: 85, reason: "Vercel cloud hosting" },
  { keywords: ["cloudflare"], category: "Cloud Infrastructure", confidence: 85, reason: "Cloudflare CDN" },
  { keywords: ["google cloud", "gcp"], category: "Cloud Infrastructure", confidence: 85, reason: "Google Cloud infrastructure" },
  { keywords: ["heroku"], category: "Cloud Infrastructure", confidence: 80, reason: "Heroku hosting" },
  { keywords: ["digitalocean"], category: "Cloud Infrastructure", confidence: 80, reason: "DigitalOcean hosting" },

  // AI Tools (description fallback)
  { keywords: ["openai", "chatgpt"], category: "AI Tools", confidence: 90, reason: "OpenAI AI services" },
  { keywords: ["anthropic", "claude"], category: "AI Tools", confidence: 90, reason: "Anthropic AI services" },
  { keywords: ["perplexity"], category: "AI Tools", confidence: 80, reason: "Perplexity AI search" },
  { keywords: ["manus ai", "manus"], category: "AI Tools", confidence: 90, reason: "Manus AI tool" },
  { keywords: ["fireflies.ai", "fireflies"], category: "AI Tools", confidence: 85, reason: "AI meeting software" },

  // Software (description fallback)
  { keywords: ["slack"], category: "Software", confidence: 90, reason: "Slack communication SaaS" },
  { keywords: ["notion"], category: "Software", confidence: 90, reason: "Notion productivity SaaS" },
  { keywords: ["figma"], category: "Software", confidence: 90, reason: "Figma design SaaS" },
  { keywords: ["zoom"], category: "Software", confidence: 90, reason: "Zoom video conferencing" },
  { keywords: ["loom"], category: "Software", confidence: 85, reason: "Loom video messaging" },
  { keywords: ["calendly"], category: "Software", confidence: 85, reason: "Calendly scheduling" },
  { keywords: ["typeform"], category: "Software", confidence: 85, reason: "Typeform form builder" },
  { keywords: ["airtable"], category: "Software", confidence: 85, reason: "Airtable database SaaS" },
  { keywords: ["github"], category: "Software", confidence: 90, reason: "GitHub developer SaaS" },
  { keywords: ["gitlab"], category: "Software", confidence: 90, reason: "GitLab developer SaaS" },
  { keywords: ["docker"], category: "Software", confidence: 85, reason: "Docker infrastructure" },
  { keywords: ["zapier"], category: "Software", confidence: 85, reason: "Zapier automation" },
  { keywords: ["n8n"], category: "Software", confidence: 85, reason: "n8n automation" },
  { keywords: ["make.com", "make com"], category: "Software", confidence: 85, reason: "Make automation" },
  { keywords: ["pipedrive"], category: "Software", confidence: 80, reason: "Pipedrive CRM" },
  { keywords: ["hubspot"], category: "Software", confidence: 80, reason: "HubSpot CRM/marketing" },
  { keywords: ["salesforce"], category: "Software", confidence: 80, reason: "Salesforce CRM" },
  { keywords: ["base44"], category: "Software", confidence: 90, reason: "Base44 no-code platform" },
  { keywords: ["skool", "skool.com"], category: "Software", confidence: 85, reason: "Skool community platform" },
  { keywords: ["digitbook"], category: "Software", confidence: 70, reason: "Digital/software spend" },
  { keywords: ["canva"], category: "Software", confidence: 85, reason: "Canva design tool" },
  { keywords: ["adobe"], category: "Software", confidence: 90, reason: "Adobe creative software" },
  { keywords: ["microsoft 365", "office 365", "microsoft"], category: "Software", confidence: 85, reason: "Microsoft productivity software" },
  { keywords: ["google workspace", "gsuite"], category: "Software", confidence: 85, reason: "Google Workspace" },

  // Marketing (description fallback)
  { keywords: ["mailchimp"], category: "Marketing", confidence: 85, reason: "Mailchimp email marketing" },
  { keywords: ["klaviyo"], category: "Marketing", confidence: 85, reason: "Klaviyo email marketing" },
  { keywords: ["activecampaign"], category: "Marketing", confidence: 85, reason: "ActiveCampaign marketing automation" },
  { keywords: ["convertkit"], category: "Marketing", confidence: 85, reason: "ConvertKit email marketing" },
  { keywords: ["beehiiv"], category: "Marketing", confidence: 85, reason: "Beehiiv newsletter" },
  { keywords: ["substack"], category: "Marketing", confidence: 80, reason: "Substack newsletter" },
  { keywords: ["semrush"], category: "Marketing", confidence: 85, reason: "SEMrush SEO tool" },
  { keywords: ["ahrefs"], category: "Marketing", confidence: 85, reason: "Ahrefs SEO tool" },

  // Advertising (description fallback)
  { keywords: ["google ads", "adwords"], category: "Advertising", confidence: 95, reason: "Google Ads spend" },
  { keywords: ["facebook ads", "instagram ads", "meta ads"], category: "Advertising", confidence: 95, reason: "Meta advertising spend" },
  { keywords: ["linkedin ads"], category: "Advertising", confidence: 95, reason: "LinkedIn Ads spend" },
  { keywords: ["twitter ads", "x ads"], category: "Advertising", confidence: 95, reason: "Twitter/X Ads spend" },
  { keywords: ["tiktok ads"], category: "Advertising", confidence: 95, reason: "TikTok Ads spend" },
  { keywords: ["snapchat ads"], category: "Advertising", confidence: 95, reason: "Snapchat Ads spend" },
  { keywords: ["pinterest ads"], category: "Advertising", confidence: 95, reason: "Pinterest Ads spend" },
  { keywords: ["ads"], category: "Advertising", confidence: 70, reason: "Contains 'Ads' — likely advertising spend" },

  // Payment processors (description fallback)
  { keywords: ["stripe"], category: "Payment Processor Fees", confidence: 95, reason: "Stripe payment processor fee", amountCondition: "negative" },
  { keywords: ["stripe"], category: "Revenue", confidence: 95, reason: "Stripe payout/revenue", amountCondition: "positive" },
  { keywords: ["paypal"], category: "Payment Processor Fees", confidence: 80, reason: "PayPal payment processor fee", amountCondition: "negative" },
  { keywords: ["paypal"], category: "Revenue", confidence: 80, reason: "PayPal payout/revenue", amountCondition: "positive" },
  { keywords: ["square"], category: "Payment Processor Fees", confidence: 80, reason: "Square payment processor fee", amountCondition: "negative" },
  { keywords: ["square"], category: "Revenue", confidence: 80, reason: "Square payout/revenue", amountCondition: "positive" },
  { keywords: ["gocardless"], category: "Payment Processor Fees", confidence: 80, reason: "GoCardless payment processor fee", amountCondition: "negative" },
  { keywords: ["gocardless"], category: "Revenue", confidence: 80, reason: "GoCardless payout/revenue", amountCondition: "positive" },
  { keywords: ["sumup"], category: "Payment Processor Fees", confidence: 80, reason: "SumUp payment processor fee", amountCondition: "negative" },
  { keywords: ["sumup"], category: "Revenue", confidence: 80, reason: "SumUp payout/revenue", amountCondition: "positive" },
  { keywords: ["shopify"], category: "Software", confidence: 90, reason: "Shopify ecommerce platform", amountCondition: "negative" },
  { keywords: ["shopify"], category: "Revenue", confidence: 90, reason: "Shopify payout/revenue", amountCondition: "positive" },
  { keywords: ["woocommerce"], category: "Software", confidence: 85, reason: "WooCommerce ecommerce platform", amountCondition: "negative" },
  { keywords: ["woocommerce"], category: "Revenue", confidence: 85, reason: "WooCommerce payout/revenue", amountCondition: "positive" },

  // Ecommerce marketplaces (description fallback)
  { keywords: ["amazon"], category: "Office Costs", confidence: 60, reason: "Amazon purchase", amountCondition: "negative" },
  { keywords: ["amazon"], category: "Revenue", confidence: 85, reason: "Amazon marketplace payout", amountCondition: "positive" },
  { keywords: ["ebay"], category: "Revenue", confidence: 80, reason: "eBay marketplace payout", amountCondition: "positive" },
  { keywords: ["etsy"], category: "Revenue", confidence: 80, reason: "Etsy marketplace payout", amountCondition: "positive" },

  // Accounting
  { keywords: ["xero"], category: "Professional Services", confidence: 90, reason: "Xero accounting software" },
  { keywords: ["quickbooks"], category: "Professional Services", confidence: 90, reason: "QuickBooks accounting software" },
  { keywords: ["sage"], category: "Professional Services", confidence: 90, reason: "Sage accounting software" },
  { keywords: ["freeagent"], category: "Professional Services", confidence: 85, reason: "FreeAgent accounting software" },

  // Communication
  { keywords: ["twilio"], category: "Software", confidence: 85, reason: "Twilio communication API" },
  { keywords: ["sendgrid"], category: "Software", confidence: 85, reason: "SendGrid email API" },
  { keywords: ["postmark"], category: "Software", confidence: 85, reason: "Postmark email API" },

  // Apple
  { keywords: ["apple.com", "apple store", "apple services"], category: "Software", confidence: 80, reason: "Apple software/subscriptions" },
  { keywords: ["apple music", "apple tv", "apple arcade"], category: "Subscriptions", confidence: 85, reason: "Apple subscription service" },
  { keywords: ["icloud"], category: "Cloud Infrastructure", confidence: 85, reason: "iCloud cloud storage" },

  // Design
  { keywords: ["sketch"], category: "Software", confidence: 85, reason: "Sketch design software" },
  { keywords: ["invision"], category: "Software", confidence: 85, reason: "InVision design SaaS" },

  // Shipping
  { keywords: ["fedex"], category: "Shipping and Fulfilment", confidence: 90, reason: "FedEx shipping" },
  { keywords: ["ups"], category: "Shipping and Fulfilment", confidence: 90, reason: "UPS shipping" },
  { keywords: ["dhl"], category: "Shipping and Fulfilment", confidence: 90, reason: "DHL shipping" },
  { keywords: ["royal mail"], category: "Shipping and Fulfilment", confidence: 90, reason: "Royal Mail postal service" },
  { keywords: ["usps"], category: "Shipping and Fulfilment", confidence: 90, reason: "USPS postal service" },
  { keywords: ["parcel force", "parcelforce"], category: "Shipping and Fulfilment", confidence: 85, reason: "Parcelforce courier" },
  { keywords: ["hermes", "evri"], category: "Shipping and Fulfilment", confidence: 85, reason: "Hermes/Evri courier" },

  // Utilities
  { keywords: ["british gas"], category: "Utilities", confidence: 85, reason: "British Gas energy utility" },
  { keywords: ["octopus energy"], category: "Utilities", confidence: 85, reason: "Octopus Energy utility" },
  { keywords: ["edf"], category: "Utilities", confidence: 85, reason: "EDF energy utility" },
  { keywords: ["eon"], category: "Utilities", confidence: 85, reason: "E.ON energy utility" },
  { keywords: ["scottish power"], category: "Utilities", confidence: 85, reason: "Scottish Power utility" },
  { keywords: ["npower"], category: "Utilities", confidence: 85, reason: "npower utility" },
  { keywords: ["bulb"], category: "Utilities", confidence: 85, reason: "Bulb energy utility" },
  { keywords: ["bt"], category: "Utilities", confidence: 85, reason: "BT telecom utility" },
  { keywords: ["zam call"], category: "Utilities", confidence: 65, reason: "Call/telecom spend" },
  { keywords: ["virgin media"], category: "Utilities", confidence: 85, reason: "Virgin Media telecom" },
  { keywords: ["sky"], category: "Utilities", confidence: 80, reason: "Sky telecom/media" },
  { keywords: ["o2"], category: "Utilities", confidence: 80, reason: "O2 mobile telecom" },
  { keywords: ["vodafone"], category: "Utilities", confidence: 80, reason: "Vodafone mobile telecom" },
  { keywords: ["ee"], category: "Utilities", confidence: 80, reason: "EE mobile telecom" },
  { keywords: ["three"], category: "Utilities", confidence: 80, reason: "Three mobile telecom" },

  // Insurance
  { keywords: ["aviva"], category: "Insurance", confidence: 85, reason: "Aviva insurance" },
  { keywords: ["axa"], category: "Insurance", confidence: 85, reason: "AXA insurance" },
  { keywords: ["allianz"], category: "Insurance", confidence: 85, reason: "Allianz insurance" },
  { keywords: ["direct line"], category: "Insurance", confidence: 85, reason: "Direct Line insurance" },
  { keywords: ["admiral"], category: "Insurance", confidence: 85, reason: "Admiral insurance" },
  { keywords: ["hiscox"], category: "Insurance", confidence: 85, reason: "Hiscox insurance" },

  // Tax
  { keywords: ["hmrc"], category: "Tax", confidence: 95, reason: "HMRC UK tax authority" },
  { keywords: ["irs"], category: "Tax", confidence: 95, reason: "IRS US tax authority" },
  { keywords: ["vat"], category: "Tax", confidence: 85, reason: "VAT tax payment" },

  // Food delivery
  { keywords: ["deliveroo"], category: "Food and Meals", confidence: 80, reason: "Deliveroo food delivery" },
  { keywords: ["uber eats", "ubereats"], category: "Food and Meals", confidence: 80, reason: "Uber Eats food delivery" },
  { keywords: ["just eat"], category: "Food and Meals", confidence: 80, reason: "Just Eat food delivery" },

  // Groceries
  { keywords: ["asda"], category: "Food and Meals", confidence: 80, reason: "Asda grocery store" },
  { keywords: ["tesco"], category: "Food and Meals", confidence: 80, reason: "Tesco grocery store" },
  { keywords: ["sainsbury", "sainsbury's"], category: "Food and Meals", confidence: 80, reason: "Sainsbury's grocery store" },
  { keywords: ["butcher", "food market", "foods", "food and wine", "grocery"], category: "Food and Meals", confidence: 70, reason: "Food/grocery merchant" },
  { keywords: ["phone gadget", "phonegadge", "electronics", "cex"], category: "Office Costs", confidence: 65, reason: "Electronics/accessory retail can be office equipment if business-related" },
  { keywords: ["ikea", "dunelm", "homeware", "furniture"], category: "Office Costs", confidence: 65, reason: "Furniture/homeware can be office or premises cost if business-related" },
  { keywords: ["pharmacy", "boots"], category: "Office Costs", confidence: 65, reason: "Pharmacy/retail spend can be office/staff supplies if business-related" },
  { keywords: ["companieshouse", "companies house"], category: "Professional Services", confidence: 75, reason: "Companies House filing/admin fee" },
  { keywords: ["primark", "prima"], category: "Personal Spending", confidence: 60, reason: "Retail spend is usually personal unless confirmed as business-related" },
  { keywords: ["must have ideas"], category: "Shopping", confidence: 65, reason: "Retail/product merchant spend" },

  // Travel
  { keywords: ["trainline"], category: "Travel", confidence: 85, reason: "Trainline rail ticketing" },
  { keywords: ["parking", "car park", "car parks", "ncp", "airport"], category: "Travel", confidence: 75, reason: "Parking/airport spend is travel-related" },
  { keywords: ["dvla"], category: "Automotive", confidence: 70, reason: "DVLA vehicle administration/tax context" },
  { keywords: ["british airways"], category: "Travel", confidence: 85, reason: "British Airways airline" },
  { keywords: ["easyjet"], category: "Travel", confidence: 85, reason: "EasyJet airline" },
  { keywords: ["ryanair"], category: "Travel", confidence: 85, reason: "Ryanair airline" },
  { keywords: ["virgin atlantic"], category: "Travel", confidence: 85, reason: "Virgin Atlantic airline" },
  { keywords: ["airbnb"], category: "Travel", confidence: 85, reason: "Airbnb accommodation" },
  { keywords: ["booking.com", "booking"], category: "Travel", confidence: 85, reason: "Booking.com accommodation" },

  // Subscriptions
  { keywords: ["netflix"], category: "Subscriptions", confidence: 85, reason: "Netflix subscription" },
  { keywords: ["spotify"], category: "Subscriptions", confidence: 85, reason: "Spotify subscription" },
  { keywords: ["disney"], category: "Subscriptions", confidence: 85, reason: "Disney+ subscription" },
  { keywords: ["youtube premium"], category: "Subscriptions", confidence: 85, reason: "YouTube Premium subscription" },
  { keywords: ["amazon prime"], category: "Subscriptions", confidence: 85, reason: "Amazon Prime subscription" },

  // Education
  { keywords: ["udemy"], category: "Training and Education", confidence: 75, reason: "Udemy online learning" },
  { keywords: ["coursera"], category: "Training and Education", confidence: 75, reason: "Coursera online learning" },
  { keywords: ["skillshare"], category: "Training and Education", confidence: 75, reason: "Skillshare online learning" },
  { keywords: ["pluralsight"], category: "Training and Education", confidence: 75, reason: "Pluralsight tech learning" },

  // Specific Revolut / business patterns
  { keywords: ["stripe payments uk ltd", "money added from stripe"], category: "Revenue", confidence: 95, reason: "Stripe top-up/payout is revenue", amountCondition: "positive" },
  { keywords: ["revolut business fee"], category: "Bank Fees", confidence: 90, reason: "Revolut business account fee" },
  { keywords: ["director consultancy fee"], category: "Professional Services", confidence: 80, reason: "Director consultancy fee" },
  { keywords: ["sales rep commission"], category: "Sales Commission", confidence: 90, reason: "Sales rep commission" },
  { keywords: ["marketing commission"], category: "Sales Commission", confidence: 90, reason: "Marketing commission" },
  { keywords: ["klarna*amazon", "klarna amazon"], category: "Office Costs", confidence: 78, reason: "Amazon purchase via Klarna; Klarna is payment context, not the fee category" },
  { keywords: ["nyx*asda"], category: "Shopping", confidence: 70, reason: "Purchase via Asda" },
  { keywords: ["car wash"], category: "Automotive", confidence: 70, reason: "Car wash service" },
  { keywords: ["ades ltd"], category: "Food and Meals", confidence: 70, reason: "Restaurant/cafe purchase" },

  // Transfer patterns
  { keywords: ["from british pound", "to british pound", "main · eur", "main · gbp"], category: "Transfers", confidence: 80, reason: "Currency/account movement suggests internal transfer" },

  // Credit card
  { keywords: ["capital on tap"], category: "Credit Card Payment", confidence: 90, reason: "Capital On Tap credit card provider" },
  { keywords: ["capital one"], category: "Credit Card Payment", confidence: 90, reason: "Capital One credit card provider" },
  { keywords: ["amex", "american express"], category: "Credit Card Payment", confidence: 90, reason: "American Express credit card" },
  { keywords: ["barclaycard"], category: "Credit Card Payment", confidence: 90, reason: "Barclaycard credit card" },
  { keywords: ["lloyds card"], category: "Credit Card Payment", confidence: 90, reason: "Lloyds credit card" },

  // Software specific
  { keywords: ["salesforce mentoring"], category: "Software", confidence: 75, reason: "Salesforce mentoring/training" },
];

// ─── Business Model Category Boosts ────────────────────────────────────

const BUSINESS_MODEL_BOOSTS: Record<BusinessModel, Record<string, number>> = {
  saas: {
    Software: 10,
    "Cloud Infrastructure": 10,
    "AI Tools": 10,
    Marketing: 5,
    Advertising: 5,
    "Professional Services": 5,
    Contractors: 5,
  },
  ecommerce: {
    Revenue: 10,
    COGS: 10,
    "Shipping and Fulfilment": 10,
    Advertising: 10,
    Marketing: 10,
    "Payment Processor Fees": 5,
    Refunds: 5,
    Shopping: 5,
  },
  services: {
    "Professional Services": 15,
    Contractors: 10,
    Payroll: 10,
    Revenue: 10,
    "Training and Education": 5,
    Software: 5,
  },
  consultancy: {
    "Professional Services": 15,
    Revenue: 10,
    Contractors: 10,
    "Training and Education": 5,
    Software: 5,
  },
  agency: {
    "Sales and Marketing": 15,
    Advertising: 15,
    Contractors: 10,
    Software: 10,
    Revenue: 10,
    "Professional Services": 5,
  },
  coaching: {
    "Training and Education": 15,
    Revenue: 10,
    "Professional Services": 10,
    Software: 5,
  },
  marketplace: {
    Revenue: 10,
    "Payment Processor Fees": 10,
    Advertising: 5,
    Marketing: 5,
    COGS: 5,
  },
  subscription: {
    Revenue: 10,
    Subscriptions: 10,
    "Payment Processor Fees": 5,
    Software: 5,
    Marketing: 5,
  },
  physical_products: {
    COGS: 15,
    "Shipping and Fulfilment": 15,
    Revenue: 10,
    Inventory: 10,
    Suppliers: 10,
  },
  mixed: {},
  unknown: {},
};

// ─── Signal Extraction ───────────────────────────────────────────────

interface TransactionSignals {
  originalMerchant: string;
  normalisedMerchant: string;
  displayMerchant: string;
  allText: string;
  referenceText: string;
  descriptionText: string;
  rawText: string;
  provider: string;
  paymentMethodContext?: string;
  underlyingMerchant?: string;
  isPaymentProcessorPayout: boolean;
  isCreditCardRepayment: boolean;
  isSubscriptionLike: boolean;
  isRecurringLike: boolean;
  isRefundLike: boolean;
  isInternalMovement: boolean;
}

const PAYMENT_PROCESSOR_TERMS = [
  "stripe",
  "paypal",
  "square",
  "gocardless",
  "sumup",
  "worldpay",
  "adyen",
  "shopify payments",
];

const CREDIT_CARD_PROVIDER_TERMS = [
  "capital on tap",
  "capital one",
  "amex",
  "american express",
  "barclaycard",
  "lloyds card",
  "tide credit",
  "revolut card",
  "credit card",
  "moneyway",
  "close brothers",
];

const PAYMENT_WRAPPER_PATTERNS: Array<{
  wrapper: string;
  pattern: RegExp;
}> = [
  { wrapper: "Klarna", pattern: /\bklarna\s*[*\-:]?\s*([a-z0-9][a-z0-9 .&'-]{2,})/i },
  { wrapper: "PayPal", pattern: /\bpaypal\s*[*\-:]?\s*([a-z0-9][a-z0-9 .&'-]{2,})/i },
  { wrapper: "Stripe", pattern: /\bstp\s*[*\-:]?\s*([a-z0-9][a-z0-9 .&'-]{2,})/i },
  { wrapper: "Square", pattern: /\bsq\s*[*\-:]?\s*([a-z0-9][a-z0-9 .&'-]{2,})/i },
];

const RAW_SIGNAL_FIELDS = [
  "Merchant",
  "merchant",
  "Description",
  "description",
  "Reference",
  "reference",
  "Payer",
  "payer",
  "Payee",
  "payee",
  "Counterparty",
  "counterparty",
  "Beneficiary",
  "beneficiary",
  "Type",
  "type",
  "Product",
  "product",
  "Card",
  "card",
  "Account",
  "account",
  "MCC",
  "mcc",
];

function textValue(value: unknown): string {
  return typeof value === "string" || typeof value === "number" ? String(value) : "";
}

function normaliseSearchText(value: string): string {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

function rawSignalText(rawData?: Record<string, unknown>, metadata?: Record<string, unknown>): string {
  const parts: string[] = [];
  for (const source of [rawData, metadata]) {
    if (!source) continue;
    for (const key of RAW_SIGNAL_FIELDS) {
      const value = textValue(source[key]);
      if (value) parts.push(value);
    }
  }
  return parts.join(" ");
}

function extractWrappedMerchant(text: string): { wrapper: string; merchant: string } | null {
  if (/\bklarna\b/i.test(text) && /\bamazon\b/i.test(text)) {
    return { wrapper: "Klarna", merchant: "Amazon" };
  }

  for (const wrapper of PAYMENT_WRAPPER_PATTERNS) {
    const match = text.match(wrapper.pattern);
    if (!match?.[1]) continue;
    const merchant = match[1]
      .replace(/\b(ltd|limited|inc|llc|co|company|payment|payments|card|online)\b/gi, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (merchant.length >= 3) return { wrapper: wrapper.wrapper, merchant };
  }
  return null;
}

function extractSignals(tx: TransactionContext): TransactionSignals {
  const originalMerchant =
    tx.merchant ||
    tx.counterpartyName ||
    tx.payeeName ||
    tx.payerName ||
    "Unknown";
  const rawText = rawSignalText(tx.rawData, tx.metadata);
  const descriptionText = normaliseSearchText(tx.description || "");
  const referenceText = normaliseSearchText(tx.reference || "");
  const allText = normaliseSearchText([
    tx.description,
    tx.merchant,
    tx.reference,
    tx.counterpartyName,
    tx.payerName,
    tx.payeeName,
    tx.transactionType,
    tx.provider,
    tx.accountName,
    tx.cardDetails,
    tx.relatedTransactionId,
    rawText,
  ].filter(Boolean).join(" "));

  const wrapped = extractWrappedMerchant(allText);
  const merchantForIdentity = wrapped?.merchant || originalMerchant;
  const normalisedMerchant = normaliseMerchant(merchantForIdentity);
  const paymentProcessorSeen = PAYMENT_PROCESSOR_TERMS.some((term) => allText.includes(term));
  const payoutSeen = /\b(payout|settlement|sales|invoice|customer payment|order payment|money added from)\b/.test(allText);
  const creditCardRepayment = CREDIT_CARD_PROVIDER_TERMS.some((term) => allText.includes(term)) && tx.type === "expense";
  const internalMovement =
    Boolean(tx.isTransfer) ||
    /\b(internal transfer|own account|between accounts|main\s*[·-]\s*[a-z]{3}\s*[→>-]\s*main|currency exchange|from british pound|to british pound)\b/i.test(allText);
  const subscriptionLike =
    /\b(subscription|monthly|annual|annually|recurring|plan|membership|agency sub|license|licence)\b/i.test(allText);

  return {
    originalMerchant,
    normalisedMerchant,
    displayMerchant: normalisedMerchant,
    allText,
    referenceText,
    descriptionText,
    rawText: normaliseSearchText(rawText),
    provider: normaliseSearchText(tx.provider || ""),
    paymentMethodContext: wrapped?.wrapper,
    underlyingMerchant: wrapped ? normalisedMerchant : undefined,
    isPaymentProcessorPayout: tx.type === "income" && paymentProcessorSeen && payoutSeen,
    isCreditCardRepayment: creditCardRepayment,
    isSubscriptionLike: subscriptionLike,
    isRecurringLike: subscriptionLike,
    isRefundLike: /\b(refund|refunded|return|chargeback reversed)\b/i.test(allText),
    isInternalMovement: internalMovement,
  };
}

// ─── Main Engine ─────────────────────────────────────────────────────

export class UniversalCategorisationEngine {
  private businessContext: BusinessContext;

  constructor(businessContext: BusinessContext) {
    this.businessContext = businessContext;
  }

  categorise(tx: TransactionContext): CategorisationResult {
    const evidence: CategoryEvidence[] = [];
    const signals = extractSignals(tx);
    const signalTx: TransactionContext = {
      ...tx,
      merchant: signals.normalisedMerchant,
      description: tx.description || signals.descriptionText,
      reference: tx.reference || signals.referenceText,
      isTransfer: tx.isTransfer || signals.isInternalMovement,
    };

    if (signals.paymentMethodContext && signals.underlyingMerchant) {
      evidence.push({
        category: "Ambiguous",
        confidence: 5,
        source: "payment_method_context",
        reason: `${signals.paymentMethodContext} appears to be payment context; underlying merchant resolved as ${signals.underlyingMerchant}`,
      });
    }

    // 1. Transaction type signals (strong structural signals)
    const typeEvidence = this.checkTransactionTypeSignals(signalTx, signals);
    if (typeEvidence.length > 0) {
      evidence.push(...typeEvidence);
    }

    // 2. Check for transfers (strong signal, can override everything)
    const transferEvidence = this.checkTransfer(signalTx, signals);
    if (transferEvidence) {
      evidence.push(transferEvidence);
      // For credit card providers, transfer detection IS the final answer
      if (signals.isCreditCardRepayment) {
        return this.aggregateEvidence(evidence, tx, signals);
      }
    }

    // 3. User rules (highest priority after transfer)
    const userRuleEvidence = this.checkUserRules(signalTx, signals);
    if (userRuleEvidence) {
      evidence.push(...userRuleEvidence);
    }

    // 4. Merchant registry (but skip if description has stronger specific signals)
    const merchantEvidence = this.checkMerchantRegistry(signalTx, signals);
    if (merchantEvidence) {
      // For Google + "Ads", Advertising should win over Software
      const desc = signals.allText;
      if (merchantEvidence.category === "Software" && desc.includes("ads")) {
        // Let keyword patterns handle this instead
      } else {
        evidence.push(merchantEvidence);
      }
    }

    // 5. Reference patterns
    const referenceEvidence = this.checkReferencePatterns(signalTx, signals);
    if (referenceEvidence) {
      evidence.push(...referenceEvidence);
    }

    // 6. Description keyword/phrase patterns
    const keywordEvidence = this.checkKeywordPatterns(signalTx, signals);
    if (keywordEvidence) {
      evidence.push(...keywordEvidence);
    }

    // 7. MCC hints
    const mccEvidence = this.checkMcc(signalTx);
    if (mccEvidence) {
      evidence.push(mccEvidence);
    }

    // 8. Amount pattern detection
    const amountEvidence = this.checkAmountPatterns(signalTx, signals);
    if (amountEvidence) {
      evidence.push(amountEvidence);
    }

    // 9. Personal name detection
    const personalNameEvidence = this.checkPersonalName(signalTx);
    if (personalNameEvidence.length > 0) {
      evidence.push(...personalNameEvidence);
    }

    // 10. Business model boosts
    const boostEvidence = this.applyBusinessModelBoosts(evidence);
    if (boostEvidence.length > 0) {
      evidence.push(...boostEvidence);
    }

    // 9. Aggregate evidence into final decision
    return this.aggregateEvidence(evidence, tx, signals);
  }

  private checkTransfer(tx: TransactionContext, signals: TransactionSignals): CategoryEvidence | null {
    const text = signals.allText;

    if (signals.isPaymentProcessorPayout) {
      return null;
    }

    // Strong transfer signals
    const transferSignals = [
      { pattern: "credit card repayment", category: "Credit Card Payment", confidence: 90 },
      { pattern: "credit card payment", category: "Credit Card Payment", confidence: 85 },
      { pattern: "loan repayment", category: "Transfers", confidence: 85 },
      { pattern: "internal transfer", category: "Transfers", confidence: 90 },
      { pattern: "transfer to savings", category: "Transfers", confidence: 85 },
      { pattern: "transfer from savings", category: "Transfers", confidence: 85 },
      { pattern: "owner drawing", category: "Owner Drawings", confidence: 80 },
      { pattern: "director loan", category: "Owner Drawings", confidence: 75 },
      { pattern: "capital repayment", category: "Transfers", confidence: 80 },
    ];

    for (const signal of transferSignals) {
      if (text.includes(signal.pattern)) {
        return {
          category: signal.category,
          confidence: signal.confidence,
          source: "transfer_detection",
          reason: `Transaction contains "${signal.pattern}" — treated as transfer`,
        };
      }
    }

    if (signals.isInternalMovement) {
      return {
        category: "Transfers",
        confidence: 85,
        source: "transfer_detection",
        reason: "Account/currency movement pattern suggests an internal transfer",
      };
    }

    // Credit card provider + outgoing = likely transfer/repayment
    if (signals.isCreditCardRepayment) {
      for (const provider of CREDIT_CARD_PROVIDER_TERMS) {
        if (text.includes(provider)) {
          return {
            category: "Credit Card Payment",
            confidence: 85,
            source: "transfer_detection",
            reason: `${provider} payment outgoing — likely credit card repayment/transfer`,
          };
        }
      }
    }

    return null;
  }

  private checkTransactionTypeSignals(tx: TransactionContext, signals: TransactionSignals): CategoryEvidence[] {
    const evidence: CategoryEvidence[] = [];
    const type = (tx.transactionType || "").toUpperCase();

    if (tx.isFee || type === "FEE") {
      evidence.push({
        category: "Bank Fees",
        confidence: 90,
        source: "transaction_type",
        reason: "Transaction is a fee",
      });
    }

    if ((tx.isTransfer || signals.isInternalMovement) && !signals.isPaymentProcessorPayout) {
      evidence.push({
        category: "Transfers",
        confidence: 85,
        source: "transfer_detection",
        reason: "Internal movement evidence indicates a transfer between accounts",
      });
    }

    if (type === "TOPUP") {
      if (signals.isPaymentProcessorPayout) {
        evidence.push({
          category: "Revenue",
          confidence: 92,
          source: "transaction_type",
          reason: "Top-up from payment processor/payout context is treated as business income",
        });
      } else if (signals.isInternalMovement) {
        evidence.push({
          category: "Transfers",
          confidence: 80,
          source: "transaction_type",
          reason: "Top-up has internal account/currency movement signals",
        });
      } else if (tx.type === "income") {
        evidence.push({
          category: "Ambiguous",
          confidence: 45,
          source: "transaction_type",
          reason: "Incoming top-up without processor or owner/capital context needs review before treating as revenue",
        });
      } else {
        evidence.push({
          category: "Transfers",
          confidence: 70,
          source: "transaction_type",
          reason: "Account top-up outgoing",
        });
      }
    }

    if (type === "REFUND") {
      evidence.push({
        category: "Refunds",
        confidence: 80,
        source: "transaction_type",
        reason: "Refund transaction",
      });
    }

    if (type === "EXCHANGE") {
      evidence.push({
        category: "Transfers",
        confidence: 70,
        source: "transaction_type",
        reason: "Currency exchange",
      });
    }

    return evidence;
  }

  private checkMcc(tx: TransactionContext): CategoryEvidence | null {
    const mcc = tx.merchantCategoryCode;
    if (!mcc) return null;

    const map: Record<string, { category: string; confidence: number; reason: string }> = {
      "5411": { category: "Food and Meals", confidence: 65, reason: "MCC 5411 — grocery store" },
      "5812": { category: "Food and Meals", confidence: 65, reason: "MCC 5812 — restaurant" },
      "5813": { category: "Food and Meals", confidence: 65, reason: "MCC 5813 — bar/restaurant" },
      "5814": { category: "Food and Meals", confidence: 65, reason: "MCC 5814 — fast food" },
      "5541": { category: "Automotive", confidence: 65, reason: "MCC 5541 — service station" },
      "7538": { category: "Automotive", confidence: 65, reason: "MCC 7538 — automotive service" },
      "7372": { category: "Software", confidence: 65, reason: "MCC 7372 — computer programming" },
      "7375": { category: "Software", confidence: 65, reason: "MCC 7375 — information retrieval services" },
      "7392": { category: "Professional Services", confidence: 65, reason: "MCC 7392 — business consulting" },
      "5942": { category: "Office Costs", confidence: 65, reason: "MCC 5942 — bookstore" },
      "5999": { category: "Office Costs", confidence: 65, reason: "MCC 5999 — miscellaneous retail" },
      "7299": { category: "Office Costs", confidence: 65, reason: "MCC 7299 — miscellaneous personal services" },
      "7011": { category: "Travel", confidence: 65, reason: "MCC 7011 — lodging" },
      "4111": { category: "Travel", confidence: 65, reason: "MCC 4111 — local/suburban transportation" },
      "4121": { category: "Travel", confidence: 65, reason: "MCC 4121 — taxicabs/limousines" },
    };

    const entry = map[mcc];
    if (!entry) return null;

    return {
      category: entry.category,
      confidence: entry.confidence,
      source: "provider_hint",
      reason: entry.reason,
    };
  }

  private checkUserRules(tx: TransactionContext, signals: TransactionSignals): CategoryEvidence[] {
    const evidence: CategoryEvidence[] = [];
    const text = signals.allText;

    for (const rule of this.businessContext.userRules) {
      let matches = true;
      if (rule.merchantPattern && !text.includes(rule.merchantPattern.toLowerCase())) matches = false;
      if (rule.descriptionPattern && !text.includes(rule.descriptionPattern.toLowerCase())) matches = false;
      if (rule.referencePattern && !signals.referenceText.includes(rule.referencePattern.toLowerCase())) matches = false;
      if (rule.provider && signals.provider && rule.provider.toLowerCase() !== signals.provider) matches = false;
      if (rule.direction && tx.type !== rule.direction) matches = false;

      if (matches) {
        evidence.push({
          category: rule.category,
          confidence: Math.min(100, 80 + rule.confidenceBoost),
          source: "user_rule",
          reason: `Matches saved user rule: ${rule.merchantPattern || rule.descriptionPattern || rule.referencePattern}`,
        });
      }
    }

    return evidence;
  }

  private checkMerchantRegistry(tx: TransactionContext, signals: TransactionSignals): CategoryEvidence | null {
    const merchantKey = (signals.normalisedMerchant || tx.merchant || "").toLowerCase().trim();
    if (!merchantKey) return null;

    // Exact match
    let entry = UNIVERSAL_MERCHANT_REGISTRY[merchantKey];

    // Partial match
    if (!entry) {
      for (const [key, value] of Object.entries(UNIVERSAL_MERCHANT_REGISTRY)) {
        if (merchantKey.includes(key) || key.includes(merchantKey)) {
          entry = value;
          break;
        }
      }
    }

    if (!entry) return null;

    // Use income/expense specific category if available
    let category = entry.category;
    if (tx.type === "income" && entry.incomeCategory) {
      category = entry.incomeCategory;
    } else if (tx.type === "expense" && entry.expenseCategory) {
      category = entry.expenseCategory;
    }

    return {
      category,
      confidence: entry.confidence,
      source: "merchant_registry",
      reason: entry.reason,
    };
  }

  private checkReferencePatterns(_tx: TransactionContext, signals: TransactionSignals): CategoryEvidence[] {
    const evidence: CategoryEvidence[] = [];
    const ref = signals.referenceText;
    if (!ref) return evidence;

    // Reference prefix patterns
    const prefixPatterns: { prefix: string; category: string; confidence: number; reason: string }[] = [
      { prefix: "str", category: "Revenue", confidence: 80, reason: "Reference prefix 'STR' suggests Stripe" },
      { prefix: "pay", category: "Revenue", confidence: 75, reason: "Reference prefix 'PAY' suggests payment" },
      { prefix: "inv", category: "Revenue", confidence: 80, reason: "Reference prefix 'INV' suggests invoice payment" },
      { prefix: "sinv", category: "Revenue", confidence: 80, reason: "Reference prefix 'SINV' suggests sales invoice" },
      { prefix: "vat", category: "Tax", confidence: 90, reason: "Reference prefix 'VAT' suggests tax payment" },
      { prefix: "hmrc", category: "Tax", confidence: 95, reason: "Reference prefix 'HMRC' suggests tax payment" },
      { prefix: "sal", category: "Payroll", confidence: 85, reason: "Reference prefix 'SAL' suggests salary" },
      { prefix: "pen", category: "Payroll", confidence: 80, reason: "Reference prefix 'PEN' suggests pension" },
      { prefix: "comm", category: "Sales Commission", confidence: 75, reason: "Reference prefix 'COMM' suggests commission" },
      { prefix: "con", category: "Professional Services", confidence: 70, reason: "Reference prefix 'CON' suggests consultancy" },
      { prefix: "sup", category: "COGS", confidence: 70, reason: "Reference prefix 'SUP' suggests supplier" },
      { prefix: "cog", category: "COGS", confidence: 75, reason: "Reference prefix 'COG' suggests cost of goods" },
      { prefix: "crd", category: "Credit Card Payment", confidence: 75, reason: "Reference prefix 'CRD' suggests credit card" },
    ];

    for (const pattern of prefixPatterns) {
      if (ref.startsWith(pattern.prefix)) {
        evidence.push({
          category: pattern.category,
          confidence: pattern.confidence,
          source: "reference_pattern",
          reason: pattern.reason,
        });
      }
    }

    return evidence;
  }

  private checkKeywordPatterns(tx: TransactionContext, signals: TransactionSignals): CategoryEvidence[] {
    const evidence: CategoryEvidence[] = [];
    const text = signals.allText;

    // Score each pattern by specificity (longer keyword = more specific = higher weight)
    const scoredMatches: { category: string; confidence: number; reason: string; specificity: number }[] = [];

    for (const pattern of KEYWORD_PATTERNS) {
      // Check amount condition
      if (pattern.amountCondition === "positive" && tx.amount < 0) continue;
      if (pattern.amountCondition === "negative" && tx.amount > 0) continue;

      // Check business model
      if (pattern.businessModels && !pattern.businessModels.includes(this.businessContext.model)) continue;

      // Check if any keyword matches
      const matchedKeyword = pattern.keywords.find((kw) => text.includes(kw.toLowerCase()));
      if (matchedKeyword) {
        scoredMatches.push({
          category: pattern.category,
          confidence: pattern.confidence,
          reason: pattern.reason,
          specificity: matchedKeyword.length,
        });
      }
    }

    // Sort by specificity (most specific first) and deduplicate by category
    scoredMatches.sort((a, b) => b.specificity - a.specificity);
    const seen = new Set<string>();
    for (const match of scoredMatches) {
      if (!seen.has(match.category)) {
        seen.add(match.category);
        evidence.push({
          category: match.category,
          confidence: match.confidence,
          source: "description_keyword",
          reason: match.reason,
        });
      }
    }

    return evidence;
  }

  private checkAmountPatterns(tx: TransactionContext, signals: TransactionSignals): CategoryEvidence | null {
    const absAmount = Math.abs(tx.amount);

    // Round amounts that look like subscriptions
    const isRoundAmount = absAmount === Math.round(absAmount);
    const isSubscriptionRange = absAmount >= 5 && absAmount <= 500;

    if (isRoundAmount && isSubscriptionRange) {
      // Check if description contains subscription-like terms
      if (signals.isSubscriptionLike) {
        return {
          category: "Subscriptions",
          confidence: 70,
          source: "amount_pattern",
          reason: `Round amount (${tx.amount}) with subscription-like terms suggests recurring subscription`,
        };
      }
    }

    // Large round amounts might be salary/rent
    if (absAmount >= 1000 && absAmount <= 10000 && isRoundAmount && tx.type === "expense") {
      const text = signals.allText;
      if (text.includes("rent") || text.includes("lease")) {
        return {
          category: "Office Costs",
          confidence: 75,
          source: "amount_pattern",
          reason: `Large round amount (${tx.amount}) with rent/lease terms`,
        };
      }
      if (text.includes("salary") || text.includes("wage") || text.includes("payroll")) {
        return {
          category: "Payroll",
          confidence: 75,
          source: "amount_pattern",
          reason: `Large round amount (${tx.amount}) with salary/payroll terms`,
        };
      }
    }

    return null;
  }

  private checkPersonalName(tx: TransactionContext): CategoryEvidence[] {
    const evidence: CategoryEvidence[] = [];
    const name = tx.merchant || "";
    // Only check merchant field for personal names, not description
    // And skip generic business terms that aren't personal names
    const genericTerms = ["client", "customer", "brand", "company", "business", "account"];
    if (genericTerms.some((t) => name.toLowerCase().includes(t))) {
      return evidence;
    }
    if (name) {
      const detection = detectPersonalName(name, tx.amount, tx.reference);
      if (detection.isPersonalName) {
        if (detection.suggestedCategories.length > 0) {
          for (const cat of detection.suggestedCategories) {
            evidence.push({
              category: cat,
              confidence: Math.min(100, detection.confidence),
              source: "personal_name",
              reason: detection.reason,
            });
          }
        } else {
          // Low-confidence fallback so we don't lose the personal-name flag entirely,
          // but it won't override stronger signals.
          evidence.push({
            category: "Uncategorised Review",
            confidence: 30,
            source: "personal_name",
            reason: `Transaction involves a personal name: "${name}" — may be personal spending, contractor, or reimbursement`,
          });
        }
      }
    }
    return evidence;
  }

  private applyBusinessModelBoosts(evidence: CategoryEvidence[]): CategoryEvidence[] {
    const boosts = BUSINESS_MODEL_BOOSTS[this.businessContext.model];
    if (!boosts || Object.keys(boosts).length === 0) return [];

    const boostEvidence: CategoryEvidence[] = [];

    for (const item of evidence) {
      const boost = boosts[item.category];
      if (boost && item.confidence < 100) {
        boostEvidence.push({
          category: item.category,
          confidence: Math.min(100, item.confidence + boost),
          source: "business_model_boost",
          reason: `Boosted by ${this.businessContext.model} business model profile (+${boost} confidence)`,
        });
      }
    }

    return boostEvidence;
  }

  private aggregateEvidence(
    evidence: CategoryEvidence[],
    tx: TransactionContext,
    signals: TransactionSignals
  ): CategorisationResult {
    if (evidence.length === 0) {
      return {
        category: "Uncategorised Review",
        subcategory: undefined,
        confidence: 0,
        categoryConfidence: 0,
        groupingConfidence: 0,
        status: "needs_review",
        reviewStatus: "needs_review",
        reason: "Not enough information to categorise. Merchant, description, and reference are all unclear.",
        evidence: [],
        originalMerchant: signals.originalMerchant,
        normalisedMerchant: signals.normalisedMerchant,
        displayMerchant: signals.displayMerchant,
        description: tx.description,
        reference: tx.reference,
        transactionType: tx.transactionType,
        kpiTreatment: "excluded",
        incomeExpenseStatus: tx.type,
        businessMeaning: "Insufficient signals for a reliable category",
        isTransfer: false,
        isCreditCardRepayment: false,
        isSubscription: false,
        isRecurring: false,
        isPersonalName: false,
      };
    }

    // If only evidence is personal name detection, return Uncategorised Review
    if (evidence.length === 1 && evidence[0].source === "personal_name") {
      return {
        category: "Uncategorised Review",
        subcategory: undefined,
        confidence: 0,
        categoryConfidence: 0,
        groupingConfidence: 0,
        status: "needs_review",
        reviewStatus: "needs_review",
        reason: "Not enough information to categorise. Merchant, description, and reference are all unclear.",
        evidence,
        originalMerchant: signals.originalMerchant,
        normalisedMerchant: signals.normalisedMerchant,
        displayMerchant: signals.displayMerchant,
        description: tx.description,
        reference: tx.reference,
        transactionType: tx.transactionType,
        kpiTreatment: "excluded",
        incomeExpenseStatus: tx.type,
        businessMeaning: "Personal-name signal without enough business context",
        isTransfer: false,
        isCreditCardRepayment: false,
        isSubscription: false,
        isRecurring: false,
        isPersonalName: true,
      };
    }

    // Group evidence by category and track max confidence
    const categoryScores = new Map<string, { maxConfidence: number; count: number; bestReason: string }>();

    for (const e of evidence) {
      const existing = categoryScores.get(e.category);
      if (!existing) {
        categoryScores.set(e.category, {
          maxConfidence: e.confidence,
          count: 1,
          bestReason: e.reason,
        });
      } else {
        existing.count += 1;
        if (e.confidence > existing.maxConfidence) {
          existing.maxConfidence = e.confidence;
          existing.bestReason = e.reason;
        }
      }
    }

    // Find best category
    let bestCategory = "Uncategorised Review";
    let bestScore = 0;
    let bestReason = "";

    for (const [category, data] of categoryScores) {
      if (data.maxConfidence > bestScore) {
        bestScore = data.maxConfidence;
        bestCategory = category;
        bestReason = data.bestReason;
      }
    }

    // Cap confidence
    bestScore = Math.min(100, Math.round(bestScore));

    const kpiExcludedCategories = new Set([
      "Transfers",
      "Credit Card Payment",
      "Owner Drawings",
      "Capital Injection",
      "Loans",
      "Ambiguous",
      "Uncategorised Review",
    ]);
    const isCreditCardRepayment = bestCategory === "Credit Card Payment" || signals.isCreditCardRepayment;
    const isTransfer = bestCategory === "Transfers" || isCreditCardRepayment || bestCategory === "Owner Drawings";
    const isSubscription = bestCategory === "Subscriptions" || signals.isSubscriptionLike;
    const kpiTreatment = kpiExcludedCategories.has(bestCategory) ? "excluded" : "included";

    // Determine status
    let status: "categorised" | "ai_suggested" | "needs_review";
    if (bestScore >= 90) {
      status = "categorised";
    } else if (bestScore >= 70) {
      status = "ai_suggested";
    } else {
      status = "needs_review";
    }

    // Special case: if best category is Needs Review or Uncategorised, force needs_review status
    if (bestCategory === "Needs Review" || bestCategory === "Uncategorised Review" || bestCategory === "Ambiguous") {
      status = "needs_review";
    }

    // Build comprehensive reason from top evidence
    const topEvidence = evidence
      .filter((e) => e.category === bestCategory)
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 3);

    const reasonParts = topEvidence.map((e) => e.reason);
    if (reasonParts.length === 0) {
      reasonParts.push(bestReason);
    }

    const finalReason = `${bestCategory}: ${reasonParts.join("; ")}`;
    const reviewStatus = status === "categorised" ? "auto_categorised" : status === "ai_suggested" ? "suggested" : "needs_review";

    return {
      category: bestCategory,
      subcategory: this.getSubcategory(bestCategory, signals),
      confidence: bestScore,
      categoryConfidence: bestScore,
      groupingConfidence: 0,
      status,
      reviewStatus,
      reason: finalReason,
      evidence: evidence.sort((a, b) => b.confidence - a.confidence),
      originalMerchant: signals.originalMerchant,
      normalisedMerchant: signals.normalisedMerchant,
      displayMerchant: signals.displayMerchant,
      description: tx.description,
      reference: tx.reference,
      transactionType: tx.transactionType,
      kpiTreatment,
      incomeExpenseStatus: tx.type,
      businessMeaning: this.describeBusinessMeaning(bestCategory, tx, signals, kpiTreatment),
      isTransfer,
      isCreditCardRepayment,
      isSubscription,
      isRecurring: signals.isRecurringLike,
      isPersonalName: evidence.some((e) => e.source === "personal_name"),
    };
  }

  private getSubcategory(category: string, signals: TransactionSignals): string | undefined {
    const text = signals.allText;
    if (category === "Software") {
      if (text.includes("canva") || text.includes("adobe") || text.includes("figma") || text.includes("picsart")) return "Design Tool";
      if (text.includes("highlevel") || text.includes("gohighlevel") || text.includes("hubspot")) return "Marketing Automation";
      if (text.includes("xero") || text.includes("quickbooks") || text.includes("sage")) return "Accounting";
      return "SaaS";
    }
    if (category === "Advertising") {
      if (text.includes("facebook") || text.includes("instagram") || text.includes("meta") || text.includes("tiktok") || text.includes("linkedin")) return "Social Media";
      if (text.includes("google ads") || text.includes("adwords") || text.includes("ppc")) return "PPC";
    }
    if (category === "Sales Commission") {
      if (text.includes("affiliate")) return "Affiliate";
      if (text.includes("sales rep")) return "Sales Rep";
      return "Commission";
    }
    if (category === "Revenue" && signals.isPaymentProcessorPayout) return "Processor Payout";
    if (category === "Credit Card Payment") return "Repayment";
    return undefined;
  }

  private describeBusinessMeaning(
    category: string,
    tx: TransactionContext,
    signals: TransactionSignals,
    kpiTreatment: "included" | "excluded"
  ): string {
    const direction = tx.type === "income" ? "money in" : "money out";
    const merchant = signals.displayMerchant || signals.originalMerchant || "unknown merchant";
    const kpiText = kpiTreatment === "included" ? "included in operating KPIs" : "excluded from operating KPIs until confirmed";
    if (signals.paymentMethodContext && signals.underlyingMerchant) {
      return `${direction} via ${signals.paymentMethodContext}; underlying merchant ${signals.underlyingMerchant}; categorised as ${category}; ${kpiText}.`;
    }
    return `${direction} with ${merchant}; categorised as ${category}; ${kpiText}.`;
  }
}

// ─── Convenience function for pipeline integration ───────────────────

export function categoriseTransaction(
  tx: TransactionContext,
  businessContext: BusinessContext
): CategorisationResult {
  const engine = new UniversalCategorisationEngine(businessContext);
  return engine.categorise(tx);
}
