"use client";

import { ReactNode } from "react";

interface SectionCardProps {
  title?: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  padding?: "none" | "sm" | "md" | "lg";
}

export function SectionCard({ title, subtitle, action, children, className = "", padding = "md" }: SectionCardProps) {
  const paddingClass = {
    none: "",
    sm: "p-4",
    md: "p-5",
    lg: "p-6",
  }[padding];

  return (
    <div className={`rounded-xl border border-[var(--border)] bg-[var(--card)] ${className}`}>
      {(title || action) && (
        <div className="px-5 py-4 border-b border-[var(--border)] flex items-center justify-between">
          <div>
            {title && <h3 className="text-sm font-bold text-[var(--foreground)]">{title}</h3>}
            {subtitle && <p className="text-xs text-[var(--muted-foreground)] mt-0.5">{subtitle}</p>}
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </div>
      )}
      <div className={paddingClass}>{children}</div>
    </div>
  );
}
