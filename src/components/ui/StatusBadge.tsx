"use client";

const variants = {
  success: "bg-[var(--success)]/10 text-[var(--success)] border-[var(--success)]/20",
  warning: "bg-[var(--warning)]/10 text-[var(--warning)] border-[var(--warning)]/20",
  danger: "bg-[var(--danger)]/10 text-[var(--danger)] border-[var(--danger)]/20",
  info: "bg-[var(--sky-blue)]/10 text-[var(--sky-blue)] border-[var(--sky-blue)]/20",
  highlight: "bg-[var(--highlight)]/10 text-[var(--soft-lilac)] border-[var(--highlight)]/20",
  neutral: "bg-[var(--secondary)]/50 text-[var(--muted-foreground)] border-[var(--border)]",
};

interface StatusBadgeProps {
  children: React.ReactNode;
  variant?: keyof typeof variants;
  size?: "sm" | "md";
  className?: string;
}

export function StatusBadge({ children, variant = "neutral", size = "sm", className = "" }: StatusBadgeProps) {
  const sizeClass = size === "sm" ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-xs";
  return (
    <span className={`inline-flex items-center rounded-md border font-semibold ${sizeClass} ${variants[variant]} ${className}`}>
      {children}
    </span>
  );
}
