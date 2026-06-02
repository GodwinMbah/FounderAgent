"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Menu, Bell, Search, CalendarDays, ChevronDown, Sparkles, User, Settings, LogOut } from "lucide-react";
import { useAssistant } from "./AssistantContext";
import { useAuth } from "@/lib/hooks/useAuth";
import { signOut } from "@/lib/auth";
import DateRangePicker from "@/components/ui/DateRangePicker";
import { getDateRange, type DateRangePreset } from "@/lib/date-range";
import { setGlobalDateRangeCookie } from "@/lib/date-range-server";

function getUrlRange(initial?: { preset?: string; from?: string; to?: string }): { preset: DateRangePreset; from: string; to: string } {
  if (typeof window === "undefined") {
    const preset = (initial?.preset as DateRangePreset) || "last30";
    const r = getDateRange(preset, initial?.from, initial?.to);
    return { preset, from: r.from, to: r.to };
  }
  const params = new URLSearchParams(window.location.search);
  const preset = (params.get("preset") as DateRangePreset) || (initial?.preset as DateRangePreset) || "last30";
  const from = params.get("from") || initial?.from || undefined;
  const to = params.get("to") || initial?.to || undefined;
  const r = getDateRange(preset, from, to);
  return { preset, from: r.from, to: r.to };
}

export function TopBar({
  onMenuClick,
  initialPreset,
  initialFrom,
  initialTo,
}: {
  onMenuClick: () => void;
  initialPreset?: string;
  initialFrom?: string;
  initialTo?: string;
}) {
  const { setOpen } = useAssistant();
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [dateOpen, setDateOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const dateRef = useRef<HTMLDivElement>(null);

  const [range, setRange] = useState(() => {
    const r = getUrlRange({ preset: initialPreset, from: initialFrom, to: initialTo });
    return { from: r.from, to: r.to };
  });
  const [preset, setPreset] = useState<DateRangePreset>(() => getUrlRange({ preset: initialPreset, from: initialFrom, to: initialTo }).preset);
  const pendingPresetRef = useRef<DateRangePreset>(preset);

  const initials = user?.email?.split("@")[0]?.slice(0, 2).toUpperCase() ?? null;
  const displayName = user?.user_metadata?.name ?? user?.email?.split("@")[0] ?? null;

  // Sync with URL changes (back/forward navigation)
  useEffect(() => {
    function handlePopState() {
      const r = getUrlRange({ preset: initialPreset, from: initialFrom, to: initialTo });
      setPreset(r.preset);
      setRange({ from: r.from, to: r.to });
    }
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
      if (dateRef.current && !dateRef.current.contains(e.target as Node)) {
        setDateOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleDateChange = async (newPreset: DateRangePreset, newRange: { from: string; to: string }) => {
    setPreset(newPreset);
    setRange(newRange);
    setDateOpen(false);

    // Persist in cookie for navigation links that don't preserve params
    await setGlobalDateRangeCookie(newPreset, newRange.from, newRange.to);

    // Update URL — this triggers Next.js server re-render with new searchParams
    const params = new URLSearchParams();
    params.set("preset", newPreset);
    params.set("from", newRange.from);
    params.set("to", newRange.to);
    router.push(`${pathname}?${params.toString()}`);
  };

  return (
    <header className="flex items-center justify-between">
      {/* Mobile menu */}
      <button
        onClick={onMenuClick}
        aria-label="Open menu"
        className="flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--border)] bg-transparent text-[var(--foreground)] md:hidden"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Mobile brand */}
      <span className="md:hidden text-sm font-semibold tracking-tight">FounderAgent</span>

      {/* Desktop spacer */}
      <div className="hidden md:block" />

      {/* Actions — right aligned, minimal */}
      <div className="flex items-center gap-2">
        {/* Global Date Filter — visible on all viewports */}
        <div className="relative" ref={dateRef}>
          <button
            onClick={() => setDateOpen((v) => !v)}
            className="flex items-center gap-2 rounded-lg border border-[var(--border)] bg-transparent px-3 py-2 text-xs font-medium text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:border-[var(--border)]/60 transition-colors"
          >
            <CalendarDays className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{getDateRange(preset, range.from, range.to).label}</span>
            <span className="sm:hidden">{getDateRange(preset, range.from, range.to).label.split(" ").slice(0, 2).join(" ")}</span>
            <ChevronDown className="h-3 w-3" />
          </button>
          <div className="absolute right-0 top-11 z-50">
            <DateRangePicker
              value={range}
              onChange={async (newRange) => {
                if (newRange.from && newRange.to) {
                  handleDateChange(pendingPresetRef.current, newRange);
                }
              }}
              preset={preset}
              onPresetChange={async (p) => {
                pendingPresetRef.current = p;
              }}
              open={dateOpen}
              onOpenChange={setDateOpen}
            />
          </div>
        </div>

        <button className="hidden md:flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--border)] bg-transparent text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:border-[var(--border)]/60 transition-colors">
          <Search className="h-4 w-4" />
        </button>
        <button className="relative flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--border)] bg-transparent text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:border-[var(--border)]/60 transition-colors">
          <Bell className="h-4 w-4" />
          <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-[var(--danger)] border border-[var(--card)] animate-pulse" />
        </button>
        <button
          onClick={() => setOpen(true)}
          className="hidden md:flex h-9 items-center justify-center gap-1.5 rounded-lg border border-[var(--highlight)]/30 bg-[var(--highlight)]/8 px-3.5 text-xs font-semibold text-[var(--soft-lilac)] hover:bg-[var(--highlight)]/15 hover:border-[var(--highlight)]/45 hover:shadow-[0_0_20px_rgba(139,92,246,0.15)] hover:text-white transition-all shadow-[0_0_12px_rgba(139,92,246,0.08)]"
        >
          <Sparkles className="h-3.5 w-3.5" />
          AI Assist
        </button>

        {/* User avatar */}
        {!loading && user && initials && (
          <div className="flex items-center gap-2 pl-1 relative" ref={dropdownRef}>
            <button
              onClick={() => setDropdownOpen((v) => !v)}
              className="h-9 w-9 rounded-lg bg-gradient-to-br from-[var(--accent)]/20 to-[var(--highlight)]/15 flex items-center justify-center text-[var(--accent)] text-xs font-bold border border-[var(--accent)]/20 shadow-[0_0_8px_rgba(20,184,166,0.08)] cursor-pointer hover:border-[var(--accent)]/35 transition-colors"
              title={displayName ?? "User"}
            >
              {initials}
            </button>
            {dropdownOpen && (
              <div className="absolute right-0 top-10 z-50 w-44 rounded-xl border border-[var(--border)] bg-[var(--card)] shadow-lg py-1">
                <Link
                  href="/settings"
                  onClick={() => setDropdownOpen(false)}
                  className="flex items-center gap-2 px-3 py-2 text-xs font-medium text-[var(--foreground)] hover:bg-[var(--secondary)] transition-colors"
                >
                  <User className="h-3.5 w-3.5 text-[var(--muted-foreground)]" />
                  Profile
                </Link>
                <Link
                  href="/settings"
                  onClick={() => setDropdownOpen(false)}
                  className="flex items-center gap-2 px-3 py-2 text-xs font-medium text-[var(--foreground)] hover:bg-[var(--secondary)] transition-colors"
                >
                  <Settings className="h-3.5 w-3.5 text-[var(--muted-foreground)]" />
                  Settings
                </Link>
                <div className="mx-2 my-1 h-px bg-[var(--border)]" />
                <form action={signOut}>
                  <button
                    type="submit"
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-[var(--danger)] hover:bg-red-500/5 transition-colors text-left"
                  >
                    <LogOut className="h-3.5 w-3.5" />
                    Sign out
                  </button>
                </form>
              </div>
            )}
          </div>
        )}
        {!loading && !user && (
          <div className="flex items-center gap-2 pl-1">
            <div className="h-9 w-9 rounded-lg bg-[var(--sidebar-accent)]/60 flex items-center justify-center text-[var(--muted-foreground)] border border-[var(--border)]">
              <User className="h-4 w-4" />
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
