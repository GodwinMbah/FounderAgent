"use client";

import { AgentAvatar } from "@/components/ui/AgentAvatar";
import { Sparkles, ArrowRight } from "lucide-react";

const prompts = [
  "Where am I overspending?",
  "What subscriptions should I cut?",
  "What is my runway?",
  "Why did profit drop?",
  "Show unusual transactions",
];

export function AskAgentPanel({ className = "" }: { className?: string }) {
  return (
    <div className={`rounded-xl border border-[var(--highlight)]/20 bg-[var(--highlight)]/5 p-5 ${className}`}>
      <div className="flex items-center gap-3 mb-4">
        <AgentAvatar size={36} />
        <div>
          <p className="text-sm font-bold text-[var(--soft-lilac)]">Ask FounderAgent</p>
          <p className="text-[11px] text-[var(--muted-foreground)]">Your AI finance copilot</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {prompts.map((prompt) => (
          <button
            key={prompt}
            className="rounded-full border border-[var(--border)] bg-[var(--background)] px-3 py-1.5 text-[11px] font-medium text-[var(--muted-foreground)] hover:border-[var(--accent)]/40 hover:text-[var(--accent)] transition-colors"
          >
            {prompt}
          </button>
        ))}
      </div>

      <div className="mt-4 flex items-center gap-2">
        <input
          type="text"
          placeholder="Ask anything about your finances..."
          className="flex-1 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-xs text-[var(--foreground)] placeholder-[var(--muted-foreground)] outline-none focus:ring-2 focus:ring-[var(--accent)]/30 transition-all"
        />
        <button className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--accent)] text-[var(--accent-foreground)] hover:bg-[var(--accent)]/90 transition-colors">
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
