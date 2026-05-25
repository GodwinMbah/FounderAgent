"use client";

import { ReactNode } from "react";

interface ChartCardProps {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  height?: string;
}

export function ChartCard({ title, subtitle, action, children, className = "", height = "h-72" }: ChartCardProps) {
  return (
    <div className={`rounded-xl border border-[var(--border)] bg-[var(--card)] overflow-hidden ${className}`}>
      <div className="px-5 py-4 border-b border-[var(--border)] flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-[var(--foreground)]">{title}</h3>
          {subtitle && <p className="text-xs text-[var(--muted-foreground)] mt-0.5">{subtitle}</p>}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
      <div className={`p-5 ${height} min-h-0 min-w-0`}>
        <div className="w-full h-full min-h-0 min-w-0">
          {children}
        </div>
      </div>
    </div>
  );
}
