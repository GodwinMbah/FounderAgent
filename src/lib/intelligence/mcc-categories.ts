/**
 * MCC (Merchant Category Code) to category mapping
 * Used for automatic category hints during transaction parsing.
 */

const MCC_CATEGORY_MAP: Record<string, string> = {
  // Restaurants / Food and Meals
  "5812": "Food and Meals",
  "5813": "Food and Meals",
  "5814": "Food and Meals",
  // Groceries / Food and Meals
  "5411": "Food and Meals",
  "5422": "Food and Meals",
  "5441": "Food and Meals",
  "5451": "Food and Meals",
  "5462": "Food and Meals",
  "5499": "Food and Meals",
  // Automotive / Vehicle
  "5511": "Vehicle and Fuel",
  "5533": "Vehicle and Fuel",
  "5541": "Vehicle and Fuel",
  "5542": "Vehicle and Fuel",
  "5571": "Vehicle and Fuel",
  "5592": "Vehicle and Fuel",
  "5599": "Vehicle and Fuel",
  // Clothing / Shopping
  "5641": "Personal Spending",
  "5651": "Personal Spending",
  "5661": "Personal Spending",
  "5691": "Personal Spending",
  "5945": "Personal Spending",
  "5948": "Personal Spending",
  // Electronics / Software
  "5732": "Office Costs",
  "5734": "Software",
  "5735": "Software",
  // Pharmacies
  "5912": "Office Costs",
  "5122": "Office Costs",
  // Transport / Travel
  "4111": "Travel",
  "4112": "Travel",
  "4119": "Travel",
  "4121": "Travel",
  "4131": "Travel",
  "4784": "Travel",
  // Financial Services
  "6012": "Financial Services",
  // Government / Tax
  "9399": "Tax",
  // Professional Services
  "7399": "Professional Services",
  "7299": "Professional Services",
  "8999": "Professional Services",
  // Gambling / Entertainment
  "7995": "Personal Spending",
};

/**
 * Look up a category name from an MCC string.
 * Returns undefined if the MCC is not in the mapping.
 */
export function getCategoryFromMcc(mcc: string): string | undefined {
  if (!mcc) return undefined;
  return MCC_CATEGORY_MAP[mcc.trim()];
}
