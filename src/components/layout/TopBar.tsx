"use client";

import { Menu, Bell, Search, CalendarDays, ChevronDown, Sparkles, User } from "lucide-react";
import { useAssistant } from "./AssistantContext";
import { useAuth } from "@/lib/hooks/useAuth";

export function TopBar({
  onMenuClick,
}: {
  onMenuClick: () => void;
}) {
  const { setOpen } = useAssistant();
  const { user, loading } = useAuth();

  const initials = user?.email?.split("@")[0]?.slice(0, 2).toUpperCase() ?? null;
  const displayName = user?.user_metadata?.name ?? user?.email?.split("@")[0] ?? null;

  return (
    <header className="flex items-center justify-between">
      {/* Mobile menu */}
      <button
        onClick={onMenuClick}
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
        <button className="hidden md:flex items-center gap-2 rounded-lg border border-[var(--border)] bg-transparent px-3 py-2 text-xs font-medium text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:border-[var(--border)]/60 transition-colors">
          <CalendarDays className="h-3.5 w-3.5" />
          May 12 – May 18, 2024
          <ChevronDown className="h-3 w-3" />
        </button>
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
          <div className="flex items-center gap-2 pl-1">
            <div
              className="h-9 w-9 rounded-lg bg-gradient-to-br from-[var(--accent)]/20 to-[var(--highlight)]/15 flex items-center justify-center text-[var(--accent)] text-xs font-bold border border-[var(--accent)]/20 shadow-[0_0_8px_rgba(20,184,166,0.08)] cursor-pointer hover:border-[var(--accent)]/35 transition-colors"
              title={displayName ?? "User"}
            >
              {initials}
            </div>
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
