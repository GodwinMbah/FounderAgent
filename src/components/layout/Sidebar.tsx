"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  Wallet,
  Timer,
  TrendingDown,
  TrendingUp,
  Repeat,
  PiggyBank,
  FileBarChart,
  Sparkles,
  Bell,
  Upload,
  Settings,
  X,
  ChevronRight,
  Bot,
  LogOut,
} from "lucide-react";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { AgentOrb } from "@/components/AgentOrb";
import { useAssistant } from "./AssistantContext";
import { useAuth } from "@/lib/hooks/useAuth";
import { signOut, getCurrentCompany } from "@/lib/auth";
import { useEffect, useState } from "react";

const mainNav = [
  { href: "/dashboard", label: "Overview", icon: Home },
  { href: "/cash-flow", label: "Cash Flow", icon: Wallet },
  { href: "/runway", label: "Runway", icon: Timer },
  { href: "/expenses", label: "Expenses", icon: TrendingDown },
  { href: "/revenue", label: "Revenue", icon: TrendingUp },
  { href: "/subscriptions", label: "Subscriptions", icon: Repeat },
  { href: "/budgets", label: "Budgets", icon: PiggyBank },
  { href: "/reports", label: "Reports", icon: FileBarChart },
];

const intelNav = [
  { href: "/ai-insights", label: "AI Insights", icon: Sparkles },
  { href: "/alerts", label: "Alerts", icon: Bell },
];

const systemNav = [
  { href: "/upload-centre", label: "Upload Centre", icon: Upload },
  { href: "/settings", label: "Settings", icon: Settings },
];

function isExactActive(pathname: string, href: string): boolean {
  const normalized = pathname.replace(/\/$/, "");
  const normalizedHref = href.replace(/\/$/, "");
  return normalized === normalizedHref;
}

function NavGroup({
  title,
  items,
  pathname,
  onClose,
  accent = "teal",
}: {
  title: string;
  items: { href: string; label: string; icon: React.ElementType }[];
  pathname: string;
  onClose?: () => void;
  accent?: "teal" | "violet";
}) {
  const glowColor = accent === "violet" ? "var(--highlight)" : "var(--accent)";
  const textColor = accent === "violet" ? "var(--soft-lilac)" : "var(--accent)";
  const bgColor = accent === "violet" ? "bg-[var(--highlight)]/8" : "bg-[var(--accent)]/8";
  const borderColor = accent === "violet" ? "border-[var(--highlight)]/15" : "border-[var(--accent)]/15";

  return (
    <div className="space-y-1">
      <p className="px-3 text-[10px] font-bold text-[var(--muted-foreground)] uppercase tracking-widest mb-2">
        {title}
      </p>
      {items.map((item) => {
        const Icon = item.icon;
        const active = isExactActive(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onClose}
            className={`
              group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] font-medium transition-all duration-200
              ${active
                ? `${bgColor} ${textColor} border ${borderColor}`
                : "text-[var(--sidebar-foreground)]/55 hover:bg-[var(--sidebar-accent)]/70 hover:text-[var(--sidebar-foreground)]"
              }
            `}
            style={active ? { boxShadow: `0 0 16px ${glowColor}18` } : undefined}
          >
            {active && (
              <span
                className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-[3px] rounded-r-full"
                style={{ backgroundColor: glowColor, boxShadow: `0 0 12px ${glowColor}` }}
              />
            )}
            <Icon
              className={`h-[15px] w-[15px] transition-colors shrink-0 ${
                active ? (accent === "violet" ? "text-[var(--highlight)]" : "text-[var(--accent)]") : "text-[var(--muted-foreground)] group-hover:text-[var(--sidebar-foreground)]"
              }`}
            />
            <span className="truncate">{item.label}</span>
            {active && (
              <ChevronRight className="h-3 w-3 ml-auto opacity-50 shrink-0" />
            )}
          </Link>
        );
      })}
    </div>
  );
}

function SidebarWorkspace() {
  const { user, loading } = useAuth();
  const [company, setCompany] = useState<{ name?: string | null } | null>(null);
  const [companyLoading, setCompanyLoading] = useState(true);

  useEffect(() => {
    getCurrentCompany().then((c) => {
      const companyData = Array.isArray(c) ? c[0] ?? null : c;
      setCompany(companyData);
      setCompanyLoading(false);
    });
  }, []);

  if (loading || companyLoading) {
    return (
      <div className="flex items-center gap-3 rounded-xl bg-[var(--sidebar-accent)]/50 px-3 py-2.5 border border-[var(--border)]">
        <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-[var(--accent)]/15 to-[var(--highlight)]/10 animate-pulse" />
        <div className="flex flex-col gap-1 min-w-0">
          <div className="h-3 w-20 rounded bg-[var(--border)] animate-pulse" />
          <div className="h-2 w-14 rounded bg-[var(--border)] animate-pulse" />
        </div>
      </div>
    );
  }

  const initials = user?.email?.split("@")[0]?.slice(0, 2).toUpperCase() ?? "AC";
  const displayName = company?.name ?? user?.user_metadata?.name ?? user?.email?.split("@")[0] ?? "Workspace";
  const planLabel = user ? "Founder Plan" : "Demo Mode";
  const emailLabel = user?.email ?? "";

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3 rounded-xl bg-[var(--sidebar-accent)]/50 px-3 py-2.5 border border-[var(--border)] hover:border-[var(--accent)]/20 transition-colors cursor-pointer">
        <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-[var(--accent)]/15 to-[var(--highlight)]/10 flex items-center justify-center text-[var(--accent)] text-xs font-bold border border-[var(--accent)]/20 shadow-[0_0_8px_rgba(20,184,166,0.08)] shrink-0">
          {initials}
        </div>
        <div className="flex flex-col min-w-0">
          <span className="text-[13px] font-semibold text-[var(--sidebar-foreground)] truncate">{displayName}</span>
          <span className="text-[11px] text-[var(--muted-foreground)] truncate">{emailLabel || planLabel}</span>
        </div>
        <ChevronRight className="h-4 w-4 ml-auto text-[var(--muted-foreground)] shrink-0" />
      </div>

      {user && (
        <form action={signOut}>
          <button
            type="submit"
            className="w-full flex items-center gap-2 rounded-lg px-3 py-2 text-[11px] font-medium text-[var(--muted-foreground)] hover:text-[var(--danger)] hover:bg-red-500/5 transition-colors"
          >
            <LogOut className="h-3.5 w-3.5" />
            Sign out
          </button>
        </form>
      )}
    </div>
  );
}

function AskAgentCard({ onClose }: { onClose?: () => void }) {
  const { setOpen } = useAssistant();

  const handleOpen = () => {
    setOpen(true);
    onClose?.();
  };

  const prompts = [
    "Runway forecast?",
    "Cut costs?",
    "Revenue up?",
  ];

  return (
    <div className="px-3 pb-4">
      <div className="relative overflow-hidden rounded-2xl border border-[var(--highlight)]/10 bg-gradient-to-b from-[#0e0e1c]/90 via-[#0a0a14]/95 to-[#07070f]/90 backdrop-blur-md p-5 shadow-[inset_0_1px_1px_rgba(255,255,255,0.03)]">
        {/* Deep violet ambient glow — top right */}
        <div
          className="absolute -top-12 -right-12 h-40 w-40 rounded-full opacity-50"
          style={{
            background: "radial-gradient(circle, rgba(139,92,246,0.32) 0%, rgba(139,92,246,0.1) 40%, transparent 70%)",
            filter: "blur(24px)",
          }}
        />
        {/* Deep teal ambient glow — bottom left */}
        <div
          className="absolute -bottom-10 -left-10 h-32 w-32 rounded-full opacity-40"
          style={{
            background: "radial-gradient(circle, rgba(20,184,166,0.22) 0%, rgba(20,184,166,0.06) 40%, transparent 70%)",
            filter: "blur(20px)",
          }}
        />
        {/* Subtle inner edge glow */}
        <div className="absolute inset-0 rounded-2xl shadow-[inset_0_1px_0_rgba(139,92,246,0.08)] pointer-events-none" />

        <div className="relative flex items-center gap-4">
          <div className="relative shrink-0">
            <AgentOrb size={52} animated showGlow />
            {/* Live signal dot */}
            <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-[var(--accent)] border-2 border-[#07070f] animate-pulse" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-[var(--soft-lilac)] tracking-tight">Ask FounderAgent</p>
            <p className="text-[11px] text-[var(--muted-foreground)] mt-0.5">Your AI finance copilot</p>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {prompts.map((q) => (
            <button
              key={q}
              onClick={handleOpen}
              className="rounded-full border border-[var(--highlight)]/10 bg-[var(--highlight)]/5 px-3 py-1.5 text-[11px] font-medium text-[var(--soft-lilac)]/70 hover:bg-[var(--highlight)]/12 hover:border-[var(--highlight)]/20 hover:text-[var(--soft-lilac)] transition-all"
            >
              {q}
            </button>
          ))}
        </div>

        <button
          onClick={handleOpen}
          className="mt-4 w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[var(--highlight)]/15 to-[var(--highlight)]/8 border border-[var(--highlight)]/20 px-3 py-2.5 text-xs font-semibold text-[var(--soft-lilac)] hover:from-[var(--highlight)]/22 hover:to-[var(--highlight)]/14 hover:border-[var(--highlight)]/30 hover:shadow-[0_0_24px_rgba(139,92,246,0.15)] transition-all"
        >
          <Bot className="h-3.5 w-3.5" />
          Ask a question
          <ChevronRight className="h-3 w-3 ml-auto opacity-50" />
        </button>
      </div>
    </div>
  );
}

export function Sidebar({ mobileOpen, onClose }: { mobileOpen?: boolean; onClose?: () => void }) {
  const pathname = usePathname();

  return (
    <aside
      className={`
        fixed inset-y-0 left-0 z-50 w-[280px] flex-col border-r border-[var(--sidebar-border)] bg-[var(--sidebar-background)]
        transform transition-transform duration-300 ease-out
        md:relative md:translate-x-0 md:flex
        ${mobileOpen ? "translate-x-0 flex" : "-translate-x-full hidden md:flex"}
      `}
    >
      {/* Logo */}
      <div className="flex items-center h-[64px] px-5 border-b border-[var(--sidebar-border)]">
        <BrandLogo className="max-w-[180px]" />
        {onClose && (
          <button onClick={onClose} className="ml-auto md:hidden text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors">
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-5 space-y-6">
        <NavGroup title="Main" items={mainNav} pathname={pathname} onClose={onClose} accent="teal" />
        <NavGroup title="Intelligence" items={intelNav} pathname={pathname} onClose={onClose} accent="violet" />
        <NavGroup title="System" items={systemNav} pathname={pathname} onClose={onClose} accent="teal" />
      </nav>

      {/* Ask FounderAgent Card */}
      <AskAgentCard onClose={onClose} />

      {/* Workspace & Auth */}
      <div className="border-t border-[var(--sidebar-border)] p-3 space-y-2">
        <SidebarWorkspace />
      </div>
    </aside>
  );
}
