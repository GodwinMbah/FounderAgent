/**
 * Business Intelligence Types
 * Company business profile, revenue model, cost structure, and KPI preferences.
 */

export type BusinessModel =
  | "saas"
  | "services"
  | "consulting"
  | "agency"
  | "physical_products"
  | "ecommerce"
  | "marketplace"
  | "digital_products"
  | "membership"
  | "mixed"
  | "other";

export type RevenueModel =
  | "subscription"
  | "one_time"
  | "project"
  | "retainer"
  | "marketplace_commission"
  | "affiliate"
  | "digital_product"
  | "physical_product"
  | "usage_based"
  | "donation"
  | "mixed";

export type CostStructureFlag =
  | "cogs"
  | "inventory"
  | "shipping"
  | "contractors"
  | "payroll"
  | "advertising"
  | "software"
  | "cloud"
  | "payment_fees"
  | "office"
  | "professional_services"
  | "other";

export interface CompanyBusinessProfile {
  businessModel: BusinessModel;
  revenueModels: RevenueModel[];
  costStructure: CostStructureFlag[];
  primaryGoal?: string;
  agentFocus?: string[];
}

export interface KPICardConfig {
  id: string;
  label: string;
  category: "core" | "saas" | "product" | "service" | "marketplace" | "efficiency";
  dataKey: string;
  format: "currency" | "percent" | "number" | "runway" | "text";
  icon: string;
  iconColor: string;
  eligibility: (profile: CompanyBusinessProfile, metrics: Record<string, number>) => boolean;
  changeDataKey?: string;
  invertChange?: boolean;
}

export interface UserCategoryRule {
  merchantPattern: string;
  category: string;
  confidenceBoost: number;
  createdAt: string;
}

export interface CategoriserV3Context {
  businessModel: BusinessModel;
  revenueModels: RevenueModel[];
  costStructure: CostStructureFlag[];
  userRules: UserCategoryRule[];
}

export const BUSINESS_MODEL_LABELS: Record<BusinessModel, string> = {
  saas: "SaaS / Subscription Software",
  services: "Services",
  consulting: "Consulting",
  agency: "Agency / Retainers",
  physical_products: "Physical Products",
  ecommerce: "Ecommerce",
  marketplace: "Marketplace",
  digital_products: "Digital Products",
  membership: "Membership / Community",
  mixed: "Mixed Revenue",
  other: "Other",
};

export const REVENUE_MODEL_LABELS: Record<RevenueModel, string> = {
  subscription: "Monthly / Annual Subscriptions",
  one_time: "One-time Sales",
  project: "Project Fees",
  retainer: "Retainers",
  marketplace_commission: "Marketplace Commissions",
  affiliate: "Affiliate Revenue",
  digital_product: "Digital Product Sales",
  physical_product: "Physical Product Sales",
  usage_based: "Usage-based Revenue",
  donation: "Donations / Contributions",
  mixed: "Mixed Revenue",
};

export const COST_STRUCTURE_LABELS: Record<CostStructureFlag, string> = {
  cogs: "COGS",
  inventory: "Inventory",
  shipping: "Shipping & Fulfilment",
  contractors: "Contractors",
  payroll: "Payroll",
  advertising: "Advertising",
  software: "Software Subscriptions",
  cloud: "Cloud Infrastructure",
  payment_fees: "Payment Processor Fees",
  office: "Office Costs",
  professional_services: "Professional Services",
  other: "Other",
};
