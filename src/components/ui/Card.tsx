import { ReactNode } from "react";

interface CardProps {
  children: ReactNode;
  className?: string;
  highlight?: boolean;
  padding?: "none" | "sm" | "md" | "lg";
}

export function Card({ children, className = "", highlight = false, padding = "md" }: CardProps) {
  const paddingClass = {
    none: "",
    sm: "p-4",
    md: "p-5",
    lg: "p-6",
  }[padding];

  return (
    <div
      className={`
        rounded-xl border transition-all duration-200
        ${highlight
          ? "border-[var(--accent)]/30 bg-gradient-to-br from-[var(--accent)]/5 to-transparent shadow-lg shadow-[var(--accent)]/5"
          : "border-[var(--border)] bg-[var(--card)] hover:border-[var(--border)]/80"
        }
        ${paddingClass}
        ${className}
      `}
    >
      {children}
    </div>
  );
}
