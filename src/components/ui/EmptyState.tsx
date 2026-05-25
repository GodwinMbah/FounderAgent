"use client";

import { AgentOrb } from "@/components/AgentOrb";

interface EmptyStateProps {
  title: string;
  description?: string;
  action?: React.ReactNode;
  orbSize?: number;
}

export function EmptyState({ title, description, action, orbSize = 72 }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <AgentOrb size={orbSize} animated />
      <p className="mt-5 text-sm font-semibold text-[var(--foreground)]">{title}</p>
      {description && (
        <p className="mt-1.5 text-xs text-[var(--muted-foreground)] max-w-xs leading-relaxed">{description}</p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
