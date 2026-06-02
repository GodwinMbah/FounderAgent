export const ALL_CATEGORIES = [
  "Revenue",
  "Refunds",
  "Transfers",
  "Owner Drawings",
  "Capital Injection",
  "Software",
  "AI Tools",
  "Cloud Infrastructure",
  "Advertising",
  "Marketing",
  "Contractors",
  "Payroll",
  "Professional Services",
  "Travel",
  "Accommodation",
  "Food and Meals",
  "Office Costs",
  "Bank Fees",
  "Credit Card Payment",
  "Credit Card Fees",
  "Interest Charges",
  "Payment Processor Fees",
  "Tax",
  "Inventory",
  "COGS",
  "Shipping and Fulfilment",
  "Subscriptions",
  "Utilities",
  "Insurance",
  "Training and Education",
  "Family Support",
  "Personal Spending",
  "Uncategorised Review",
] as const;

export type CategoryType = typeof ALL_CATEGORIES[number];

export const CATEGORY_COLORS: Record<string, string> = {
  Revenue: "var(--success)",
  Refunds: "var(--danger)",
  Transfers: "var(--muted-foreground)",
  "Owner Drawings": "var(--warning)",
  "Capital Injection": "var(--success)",
  Software: "var(--sky-blue)",
  "AI Tools": "var(--highlight)",
  "Cloud Infrastructure": "var(--sky-blue)",
  Advertising: "var(--danger)",
  Marketing: "var(--danger)",
  Contractors: "var(--neon-cyan)",
  Payroll: "var(--warning)",
  "Professional Services": "var(--neon-cyan)",
  Travel: "var(--accent)",
  Accommodation: "var(--accent)",
  "Food and Meals": "var(--accent)",
  "Office Costs": "var(--sky-blue)",
  "Bank Fees": "var(--muted-foreground)",
  "Credit Card Payment": "var(--muted-foreground)",
  "Credit Card Fees": "var(--muted-foreground)",
  "Interest Charges": "var(--muted-foreground)",
  "Payment Processor Fees": "var(--danger)",
  Tax: "var(--highlight)",
  Inventory: "var(--soft-lilac)",
  COGS: "var(--soft-lilac)",
  "Shipping and Fulfilment": "var(--accent)",
  Subscriptions: "var(--soft-lilac)",
  Utilities: "var(--sky-blue)",
  Insurance: "var(--soft-lilac)",
  "Training and Education": "var(--soft-lilac)",
  "Family Support": "var(--warning)",
  "Personal Spending": "var(--muted-foreground)",
  "Uncategorised Review": "var(--muted-foreground)",
};

export const CATEGORY_SUBCATEGORIES: Record<string, string[]> = {
  Software: ["SaaS", "Dev Tools", "CRM", "Accounting"],
  Advertising: ["PPC", "Social Media", "Display", "Influencer"],
  Travel: ["Flights", "Ground Transport", "Parking"],
  // ... etc
};

export function getCategoryColor(category: string): string {
  return CATEGORY_COLORS[category] || "var(--muted-foreground)";
}

export function getCategoryDisplayName(category: string): string {
  return category;
}

export function isValidCategory(category: string): boolean {
  return ALL_CATEGORIES.includes(category as CategoryType);
}
