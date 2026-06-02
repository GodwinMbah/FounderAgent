import { type CurrencyCode, getCurrencySymbol } from "@/lib/hooks/useCompanyCurrency";

export function formatCurrency(
  value: number,
  fractionDigits = 0,
  currency: CurrencyCode = "USD"
): string {
  if (!Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(value);
}

export function formatCurrencyCompact(value: number, currency: CurrencyCode = "USD"): string {
  if (!Number.isFinite(value)) return "—";
  const symbol = getCurrencySymbol(currency);
  if (Math.abs(value) >= 1_000_000) {
    return `${symbol}${(value / 1_000_000).toFixed(1)}m`;
  }
  if (Math.abs(value) >= 1_000) {
    return `${symbol}${(value / 1_000).toFixed(0)}k`;
  }
  return `${symbol}${value.toFixed(0)}`;
}

export function formatPercent(value: number, fractionDigits = 1): string {
  if (!Number.isFinite(value)) return "—%";
  return `${value.toFixed(fractionDigits)}%`;
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-US").format(value);
}

export function formatDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function formatShortMonth(isoMonth: string): string {
  const [year, month] = isoMonth.split("-");
  const d = new Date(parseInt(year), parseInt(month) - 1, 1);
  return d.toLocaleDateString("en-US", { month: "short" });
}

export function formatRunwayLabel(months: number): string {
  if (!Number.isFinite(months)) return "Infinite";
  if (months < 1) return "< 1 month";
  if (months < 12) return `${Math.round(months)} months`;
  const years = Math.round((months / 12) * 10) / 10;
  return `${years} years`;
}
