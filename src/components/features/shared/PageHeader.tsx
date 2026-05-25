import { ReactNode } from "react";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}

export function PageHeader({ title, subtitle, action }: PageHeaderProps) {
  return (
    <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between mb-7">
      <div>
        <h1 className="text-[22px] font-bold tracking-tight text-[var(--foreground)] md:text-[26px]">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-1.5 text-sm text-[var(--muted-foreground)] leading-relaxed max-w-xl">
            {subtitle}
          </p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
