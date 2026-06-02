"use client";

import { useState, useRef, useEffect } from "react";
import { AgentOrb } from "@/components/AgentOrb";
import { Send, X, Sparkles, CheckCircle2, AlertCircle, Zap } from "lucide-react";
import { useAssistant } from "@/components/layout/AssistantContext";
import { processAssistantMessage } from "./actions";

const suggestedQuestions = [
  "Where am I overspending?",
  "What subscriptions should I cut?",
  "What is my runway?",
  "Why did profit drop?",
  "Show unusual transactions",
  "What expenses increased this month?",
  "Which costs can I reduce safely?",
];

const suggestedActions = [
  { label: "Analyse runway", icon: Zap },
  { label: "Find duplicates", icon: AlertCircle },
  { label: "Review alerts", icon: AlertCircle },
];



interface Message {
  role: "user" | "agent";
  text: string;
  taskCreated?: boolean;
  taskId?: string;
}

export function AssistantDrawer() {
  const { open, setOpen } = useAssistant();
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  async function handleSend(text: string) {
    if (!text.trim()) return;
    const userMsg: Message = { role: "user", text: text.trim() };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsTyping(true);

    try {
      const result = await processAssistantMessage(text.trim());
      setMessages((prev) => [
        ...prev,
        {
          role: "agent",
          text: result.response,
          taskCreated: result.taskCreated,
          taskId: result.taskId,
        },
      ]);
    } catch (err) {
      const errorMsg =
        err instanceof Error ? err.message : "I'm sorry, something went wrong. Please try again.";
      setMessages((prev) => [...prev, { role: "agent", text: errorMsg }]);
    } finally {
      setIsTyping(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend(input);
    }
  }

  return (
    <>
      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm transition-opacity"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Drawer */}
      <div
        className={`fixed top-0 right-0 bottom-0 z-[70] w-full max-w-[440px] bg-[var(--background)]/95 backdrop-blur-xl border-l border-[var(--border)]/60 shadow-2xl transform transition-transform duration-300 ease-out flex flex-col ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* Header */}
        <div className="relative flex items-center gap-4 p-5 border-b border-[var(--border)]/60 overflow-hidden">
          {/* Violet glow header */}
          <div
            className="absolute top-0 right-0 h-48 w-48 rounded-full opacity-50"
            style={{
              background: "radial-gradient(circle, rgba(139,92,246,0.4) 0%, transparent 70%)",
              filter: "blur(28px)",
              transform: "translate(20%, -35%)",
            }}
          />
          <div
            className="absolute top-0 left-0 h-28 w-28 rounded-full opacity-30"
            style={{
              background: "radial-gradient(circle, rgba(20,184,166,0.25) 0%, transparent 70%)",
              filter: "blur(20px)",
              transform: "translate(-20%, -20%)",
            }}
          />
          <AgentOrb size={72} animated active showGlow />
          <div className="relative">
            <h3 className="text-base font-bold text-[var(--foreground)]">Ask FounderAgent</h3>
            <p className="text-xs text-[var(--muted-foreground)]">Your AI finance copilot is ready.</p>
          </div>
          <button
            onClick={() => setOpen(false)}
            className="ml-auto flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--card)]/60 text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:border-[var(--highlight)]/30 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-5 space-y-4">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <AgentOrb size={100} animated active showGlow />
              <p className="mt-5 text-sm font-semibold text-[var(--foreground)]">
                What would you like to know?
              </p>
              <p className="mt-1.5 text-xs text-[var(--muted-foreground)] max-w-[280px] leading-relaxed">
                Ask about runway, expenses, revenue trends, or anomalies. FounderAgent is watching your numbers.
              </p>
            </div>
          )}

          {messages.map((msg, idx) => (
            <div
              key={idx}
              className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : ""}`}
            >
              {msg.role === "agent" && (
                <div className="shrink-0 mt-0.5">
                  <AgentOrb size={34} animated showGlow />
                </div>
              )}
              <div
                className={`rounded-xl px-4 py-3 text-sm leading-relaxed max-w-[85%] ${
                  msg.role === "user"
                    ? "bg-[var(--accent)]/12 text-[var(--foreground)] border border-[var(--accent)]/18 backdrop-blur-sm"
                    : "bg-[var(--card)]/70 text-[var(--foreground)] border border-[var(--border)]/50 backdrop-blur-sm"
                }`}
              >
                <div className="space-y-2">
                  <p>{msg.text}</p>
                  {msg.taskCreated && (
                    <div className="inline-flex items-center gap-1.5 rounded-full bg-[var(--success)]/10 px-2.5 py-1 text-[11px] font-medium text-[var(--success)] border border-[var(--success)]/20">
                      <CheckCircle2 className="h-3 w-3" />
                      Task Created
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}

          {isTyping && (
            <div className="flex gap-3">
              <div className="shrink-0 mt-0.5">
                <AgentOrb size={34} animated thinking showGlow />
              </div>
              <div className="rounded-xl px-4 py-3 bg-[var(--card)]/70 border border-[var(--border)]/50 backdrop-blur-sm">
                <div className="flex gap-1.5 items-center">
                  <span className="h-2 w-2 rounded-full bg-[var(--highlight)] animate-bounce" style={{ animationDelay: "0ms" }} />
                  <span className="h-2 w-2 rounded-full bg-[var(--highlight)] animate-bounce" style={{ animationDelay: "150ms" }} />
                  <span className="h-2 w-2 rounded-full bg-[var(--highlight)] animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
              </div>
            </div>
          )}

          {/* Agent Task History */}
          {messages.length === 0 && (
            <div className="mt-6">
              <p className="text-[10px] font-bold text-[var(--muted-foreground)] uppercase tracking-widest mb-3 px-1">
                Recent Agent Tasks
              </p>
              <div className="rounded-xl border border-[var(--border)]/40 bg-[var(--card)]/40 px-4 py-6 text-center backdrop-blur-sm">
                <p className="text-xs text-[var(--muted-foreground)]">
                  No active agent tasks. Ask FounderAgent to analyse your finances.
                </p>
              </div>
            </div>
          )}

          {/* Suggested Actions */}
          {messages.length === 0 && (
            <div className="mt-4">
              <p className="text-[10px] font-bold text-[var(--muted-foreground)] uppercase tracking-widest mb-3 px-1">
                Quick Actions
              </p>
              <div className="flex flex-wrap gap-2">
                {suggestedActions.map((action) => {
                  const Icon = action.icon;
                  return (
                    <button
                      key={action.label}
                      onClick={() => handleSend(action.label)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)]/60 bg-[var(--card)]/40 px-3 py-2 text-[11px] font-medium text-[var(--muted-foreground)] hover:border-[var(--accent)]/25 hover:text-[var(--accent)] hover:bg-[var(--accent)]/5 transition-all"
                    >
                      <Icon className="h-3.5 w-3.5" />
                      {action.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Input area */}
        <div className="p-4 border-t border-[var(--border)]/60 bg-[var(--background)]/80 backdrop-blur-md">
          {/* Suggested questions */}
          {messages.length === 0 && (
            <div className="mb-3 flex flex-wrap gap-1.5">
              {suggestedQuestions.map((q) => (
                <button
                  key={q}
                  onClick={() => handleSend(q)}
                  className="group inline-flex items-center gap-1 rounded-lg border border-[var(--border)]/60 bg-[var(--card)]/40 px-2.5 py-1.5 text-[11px] font-medium text-[var(--muted-foreground)] hover:border-[var(--highlight)]/25 hover:text-[var(--soft-lilac)] hover:bg-[var(--highlight)]/5 transition-all"
                >
                  <Sparkles className="h-3 w-3 text-[var(--highlight)]/50 group-hover:text-[var(--highlight)] transition-colors" />
                  {q}
                </button>
              ))}
            </div>
          )}

          <div className="relative">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isTyping}
              placeholder="Ask anything about your finances..."
              className="w-full rounded-xl border border-[var(--border)]/60 bg-[var(--card)]/60 px-4 py-3 pr-12 text-sm text-[var(--foreground)] placeholder:text-[var(--muted-foreground)]/60 focus:outline-none focus:border-[var(--highlight)]/40 focus:ring-1 focus:ring-[var(--highlight)]/20 transition-all backdrop-blur-sm disabled:opacity-50"
            />
            <button
              onClick={() => handleSend(input)}
              disabled={!input.trim() || isTyping}
              className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 flex items-center justify-center rounded-lg bg-[var(--highlight)]/15 text-[var(--soft-lilac)] hover:bg-[var(--highlight)]/25 transition-colors border border-[var(--highlight)]/20 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Send className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
