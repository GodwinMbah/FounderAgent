"use server";

import { cookies } from "next/headers";
import { getDateRange, type DateRangePreset } from "./date-range";

const COOKIE_NAME = "founderagent-date-range";
const DEFAULT_PRESET: DateRangePreset = "last30";

interface DateRangeCookie {
  preset: DateRangePreset;
  from: string;
  to: string;
}

async function parseCookie(): Promise<DateRangeCookie | null> {
  const store = await cookies();
  const raw = store.get(COOKIE_NAME)?.value;
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as DateRangeCookie;
    if (parsed.preset && parsed.from && parsed.to) {
      return parsed;
    }
  } catch {
    // ignore parse errors
  }
  return null;
}

/**
 * Get the global date range for the current request.
 * Priority:
 * 1. URL search params (preset, from, to)
 * 2. Cookie (persisted global selection)
 * 3. Default (last30)
 */
export async function getGlobalDateRange(
  searchParams?: { preset?: string; from?: string; to?: string }
): Promise<{ preset: DateRangePreset; from: string; to: string; label: string }> {
  // 1. Check URL params first
  const urlPreset = searchParams?.preset as DateRangePreset | undefined;
  if (urlPreset) {
    const { from, to, label } = getDateRange(
      urlPreset,
      searchParams?.from,
      searchParams?.to
    );
    return { preset: urlPreset, from, to, label };
  }

  // 2. Check cookie
  const cookie = await parseCookie();
  if (cookie) {
    const { from, to, label } = getDateRange(cookie.preset, cookie.from, cookie.to);
    return { preset: cookie.preset, from, to, label };
  }

  // 3. Default
  const { from, to, label } = getDateRange(DEFAULT_PRESET);
  return { preset: DEFAULT_PRESET, from, to, label };
}

/**
 * Server action to persist the global date range in a cookie.
 * Called by the TopBar when the user changes the date range.
 */
export async function setGlobalDateRangeCookie(
  preset: DateRangePreset,
  from: string,
  to: string
): Promise<void> {
  const value = JSON.stringify({ preset, from, to });
  const store = await cookies();
  store.set(COOKIE_NAME, value, {
    httpOnly: false, // client can read for instant UI sync
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30, // 30 days
    path: "/",
  });
}
