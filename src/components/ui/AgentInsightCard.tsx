"use client";

import { ReactNode } from "react";
import { AgentOrb } from "@/components/AgentOrb";

interface AgentInsightCardProps {
  title: string;
  children: ReactNode;
  orbSize?: number;
  className?: string;
}

export function AgentInsightCard({ title, children, orbSize = 64, className = "" }: AgentInsightCardProps) {
  return (
    <div className={`relative overflow-hidden rounded-2xl border border-[var(--highlight)]/10 bg-gradient-to-br from-[#0e0e1c] via-[#0a0a14] to-[#07070f] p-6 shadow-[inset_0_1px_1px_rgba(255,255,255,0.03)] ${className}`}>
      {/* Deep violet ambient glow — top right */}
      <div
        className="absolute top-0 right-0 h-48 w-48 rounded-full opacity-35"
        style={{
          background: "radial-gradient(circle, rgba(139,92,246,0.2) 0%, rgba(139,92,246,0.05) 45%, transparent 70%)",
          filter: "blur(40px)",
          transform: "translate(30%, -30%)",
        }}
      />
      {/* Deep teal ambient glow — bottom left */}
      <div
        className="absolute bottom-0 left-0 h-32 w-32 rounded-full opacity-25"
        style={{
          background: "radial-gradient(circle, rgba(20,184,166,0.12) 0%, rgba(20,184,166,0.03) 45%, transparent 70%)",
          filter: "blur(30px)",
          transform: "translate(-20%, 30%)",
        }}
      />
      {/* Subtle inner edge glow */}
      <div className="absolute inset-0 rounded-2xl shadow-[inset_0_1px_0_rgba(139,92,246,0.06)] pointer-events-none" />
      {/* Top accent line */}
      <div className="absolute top-0 left-6 right-6 h-px bg-gradient-to-r from-transparent via-[var(--highlight)]/20 to-transparent" />

      <div className="relative flex flex-col md:flex-row md:items-start gap-4">
        <div className="shrink-0">
          <AgentOrb size={orbSize} animated active showGlow />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-base font-bold text-[var(--foreground)]">{title}</h3>
          <div className="mt-2.5 space-y-2">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
