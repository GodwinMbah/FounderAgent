/**
 * MCC (Merchant Category Code) to category mapping
 * Used for automatic category hints during transaction parsing.
 */

const MCC_CATEGORY_MAP: Record<string, string> = {
  // Restaurants / Food and Meals
  "5812": "Restaurants",
  "5813": "Restaurants",
  "5814": "Restaurants",
  // Groceries / Food and Meals
  "5411": "Groceries",
  "5422": "Groceries",
  "5441": "Groceries",
  "5451": "Groceries",
  "5462": "Groceries",
  "5499": "Groceries",
  // Automotive
  "5533": "Automotive",
  "5511": "Automotive",
  "5571": "Automotive",
  "5592": "Automotive",
  "5599": "Automotive",
  // Clothing / Shopping
  "5641": "Clothing",
  "5651": "Clothing",
  "5661": "Clothing",
  "5691": "Clothing",
  "5945": "Clothing",
  "5948": "Clothing",
  // Electronics / Software
  "5732": "Electronics",
  "5734": "Electronics",
  "5735": "Electronics",
  // Pharmacies
  "5912": "Pharmacies",
  "5122": "Pharmacies",
  // Transport / Travel
  "4111": "Transport",
  "4112": "Transport",
  "4119": "Transport",
  "4121": "Transport",
  "4131": "Transport",
  "4784": "Transport",
  // Financial Services
  "6012": "Financial Services",
  // Government / Tax
  "9399": "Government",
  // Professional Services
  "7399": "Professional Services",
  "7299": "Professional Services",
  "8999": "Professional Services",
  // Gambling / Entertainment
  "7995": "Gambling",
};

/**
 * Look up a category name from an MCC string.
 * Returns undefined if the MCC is not in the mapping.
 */
export function getCategoryFromMcc(mcc: string): string | undefined {
  if (!mcc) return undefined;
  return MCC_CATEGORY_MAP[mcc.trim()];
}
