export { CATEGORY_COLORS } from "@/lib/categories";

export const STATUS_VARIANTS: Record<string, "success" | "warning" | "danger" | "info" | "accent"> = {
  Categorised: "success",
  "Needs Review": "warning",
  "Possible Subscription": "info",
  "Possible Duplicate": "danger",
  "Unusual Spend": "warning",
  "AI Suggested": "accent",
  "User Confirmed": "success",
  active: "success",
  canceled: "danger",
  paused: "warning",
  strong: "success",
  healthy: "info",
  watch: "warning",
  risk: "danger",
};
