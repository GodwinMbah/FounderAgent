"use client";

import { AgentOrb } from "@/components/AgentOrb";
import { Sparkles } from "lucide-react";
import { useAssistant } from "@/components/layout/AssistantContext";

export function AgentBanner() {
  const { setOpen } = useAssistant();

  return (
    <div className="relative overflow-hidden rounded-2xl border border-[var(--highlight)]/10 bg-gradient-to-br from-[#0e0e1c] via-[#0a0a14] to-[#07070f] shadow-[inset_0_1px_1px_rgba(255,255,255,0.03)]">
      {/* Deep violet ambient glow — top right */}
      <div
        className="absolute top-0 right-0 h-80 w-80 rounded-full opacity-50"
        style={{
          background: "radial-gradient(circle, rgba(139,92,246,0.22) 0%, rgba(139,92,246,0.06) 45%, transparent 70%)",
          filter: "blur(50px)",
          transform: "translate(35%, -45%)",
        }}
      />
      {/* Deep teal ambient glow — bottom left */}
      <div
        className="absolute bottom-0 left-0 h-64 w-64 rounded-full opacity-40"
        style={{
          background: "radial-gradient(circle, rgba(20,184,166,0.14) 0%, rgba(20,184,166,0.04) 45%, transparent 70%)",
          filter: "blur(45px)",
          transform: "translate(-30%, 40%)",
        }}
      />
      {/* Central soft lilac haze */}
      <div
        className="absolute top-1/2 left-1/2 h-48 w-48 rounded-full opacity-15"
        style={{
          background: "radial-gradient(circle, rgba(196,181,253,0.15) 0%, transparent 60%)",
          filter: "blur(40px)",
          transform: "translate(-50%, -50%)",
        }}
      />
      {/* Subtle inner edge glow */}
      <div className="absolute inset-0 rounded-2xl shadow-[inset_0_1px_0_rgba(139,92,246,0.06)] pointer-events-none" />
      {/* Top accent line */}
      <div className="absolute top-0 left-8 right-8 h-px bg-gradient-to-r from-transparent via-[var(--highlight)]/20 to-transparent" />

      <div className="relative flex flex-col md:flex-row md:items-center gap-5 md:gap-8 p-6 md:p-8">
        <div className="flex items-center gap-4">
          <div className="relative">
            <AgentOrb size={88} animated active showGlow />
            <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-[var(--accent)] border-2 border-[#07070f] animate-pulse" />
          </div>
          <div className="md:hidden">
            <h3 className="text-lg font-bold text-[var(--foreground)]">
              FounderAgent is watching your numbers
            </h3>
          </div>
        </div>

        <div className="hidden md:block flex-1">
          <h3 className="text-lg font-bold text-[var(--foreground)]">
            FounderAgent is watching your numbers
          </h3>
          <p className="mt-1.5 text-sm text-[var(--muted-foreground)] max-w-xl leading-relaxed">
            Your AI copilot surfaces insights, flags risks, and helps you make smarter
            financial decisions before problems become expensive.
          </p>
        </div>

        <p className="md:hidden text-sm text-[var(--muted-foreground)] leading-relaxed">
          Your AI copilot surfaces insights, flags risks, and helps you make smarter
          financial decisions before problems become expensive.
        </p>

        <div className="md:ml-auto shrink-0">
          <button
            onClick={() => setOpen(true)}
            className="flex items-center gap-2 rounded-xl border border-[var(--highlight)]/20 bg-[var(--highlight)]/8 px-5 py-2.5 text-sm font-semibold text-[var(--soft-lilac)] hover:bg-[var(--highlight)]/14 hover:border-[var(--highlight)]/30 hover:shadow-[0_0_28px_rgba(139,92,246,0.14)] hover:text-white transition-all"
          >
            <Sparkles className="h-4 w-4" />
            Ask FounderAgent
          </button>
        </div>
      </div>
    </div>
  );
}
