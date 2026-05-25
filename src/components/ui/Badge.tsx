type BadgeVariant = "default" | "success" | "warning" | "danger" | "info" | "accent" | "outline";

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  size?: "sm" | "md";
  className?: string;
}

const variantClasses: Record<BadgeVariant, string> = {
  default: "bg-[var(--secondary)] text-[var(--foreground)]",
  success: "bg-[var(--success)]/10 text-[var(--success)] border-[var(--success)]/20",
  warning: "bg-[var(--warning)]/10 text-[var(--warning)] border-[var(--warning)]/20",
  danger: "bg-[var(--danger)]/10 text-[var(--danger)] border-[var(--danger)]/20",
  info: "bg-[var(--neon-cyan)]/10 text-[var(--neon-cyan)] border-[var(--neon-cyan)]/20",
  accent: "bg-[var(--accent)]/10 text-[var(--accent)] border-[var(--accent)]/20",
  outline: "border border-[var(--border)] text-[var(--muted-foreground)] bg-transparent",
};

export function Badge({ children, variant = "default", size = "sm", className = "" }: BadgeProps) {
  const sizeClass = size === "sm" ? "px-2 py-0.5 text-xs" : "px-2.5 py-1 text-sm";
  return (
    <span className={`inline-flex items-center rounded-md font-medium border ${variantClasses[variant]} ${sizeClass} ${className}`}>
      {children}
    </span>
  );
}
