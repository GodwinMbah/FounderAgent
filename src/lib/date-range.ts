export type DateRangePreset =
  | "today"
  | "yesterday"
  | "last7"
  | "last30"
  | "last12"
  | "thisMonth"
  | "lastMonth"
  | "thisQuarter"
  | "thisYear"
  | "allTime"
  | "custom";

export interface DateRange {
  from: string;
  to: string;
}

export interface DateRangeResult extends DateRange {
  label: string;
}

export const DATE_RANGE_PRESETS: { value: DateRangePreset; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "yesterday", label: "Yesterday" },
  { value: "last7", label: "Last 7 days" },
  { value: "last30", label: "Last 30 days" },
  { value: "last12", label: "Last 12 months" },
  { value: "thisMonth", label: "This month" },
  { value: "lastMonth", label: "Last month" },
  { value: "thisQuarter", label: "This quarter" },
  { value: "thisYear", label: "This year" },
  { value: "allTime", label: "All time" },
];

function toYMD(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function getDateRange(
  preset: DateRangePreset,
  customFrom?: string,
  customTo?: string
): DateRangeResult {
  const now = new Date();
  const today = toYMD(now);

  switch (preset) {
    case "today": {
      return { from: today, to: today, label: "Today" };
    }
    case "yesterday": {
      const d = new Date(now);
      d.setDate(d.getDate() - 1);
      const y = toYMD(d);
      return { from: y, to: y, label: "Yesterday" };
    }
    case "last7": {
      const d = new Date(now);
      d.setDate(d.getDate() - 6);
      return { from: toYMD(d), to: today, label: "Last 7 days" };
    }
    case "last30": {
      const d = new Date(now);
      d.setDate(d.getDate() - 29);
      return { from: toYMD(d), to: today, label: "Last 30 days" };
    }
    case "last12": {
      const d = new Date(now);
      d.setMonth(d.getMonth() - 11);
      d.setDate(1);
      return { from: toYMD(d), to: today, label: "Last 12 months" };
    }
    case "thisMonth": {
      const from = new Date(now.getFullYear(), now.getMonth(), 1);
      return { from: toYMD(from), to: today, label: "This month" };
    }
    case "lastMonth": {
      const from = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const to = new Date(now.getFullYear(), now.getMonth(), 0);
      return { from: toYMD(from), to: toYMD(to), label: "Last month" };
    }
    case "thisQuarter": {
      const quarter = Math.floor(now.getMonth() / 3);
      const from = new Date(now.getFullYear(), quarter * 3, 1);
      return { from: toYMD(from), to: today, label: "This quarter" };
    }
    case "thisYear": {
      const from = new Date(now.getFullYear(), 0, 1);
      return { from: toYMD(from), to: today, label: "This year" };
    }
    case "allTime": {
      return { from: "2000-01-01", to: today, label: "All time" };
    }
    case "custom": {
      const from = customFrom || today;
      const to = customTo || today;
      return {
        from,
        to,
        label: `${from} → ${to}`,
      };
    }
    default:
      return { from: "2000-01-01", to: today, label: "All time" };
  }
}
