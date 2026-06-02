"use client";

import { ReactNode, useState, Suspense } from "react";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import { AssistantProvider } from "./AssistantContext";
import { AssistantDrawer } from "@/components/features/assistant/AssistantDrawer";
import { CompanyCurrencyProvider } from "@/lib/hooks/useCompanyCurrency";

export function AppShell({
  children,
  currency,
  initialPreset,
  initialFrom,
  initialTo,
}: {
  children: ReactNode;
  currency: string;
  initialPreset?: string;
  initialFrom?: string;
  initialTo?: string;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <CompanyCurrencyProvider currency={currency}>
      <AssistantProvider>
        <div className="flex h-screen overflow-hidden bg-[var(--background)] relative">
          {/* Ambient background glows */}
          <div className="ambient-bg" />
          <div className="fixed inset-0 pointer-events-none z-0">
            <div
              className="absolute top-[-10%] left-[-5%] w-[50%] h-[50%] rounded-full opacity-60"
              style={{
                background: "radial-gradient(circle, rgba(139,92,246,0.07) 0%, transparent 60%)",
                filter: "blur(100px)",
              }}
            />
            <div
              className="absolute top-[-5%] right-[-10%] w-[45%] h-[45%] rounded-full opacity-60"
              style={{
                background: "radial-gradient(circle, rgba(20,184,166,0.05) 0%, transparent 60%)",
                filter: "blur(100px)",
              }}
            />
            <div
              className="absolute bottom-[-10%] left-[20%] w-[40%] h-[40%] rounded-full opacity-40"
              style={{
                background: "radial-gradient(circle, rgba(139,92,246,0.04) 0%, transparent 60%)",
                filter: "blur(100px)",
              }}
            />
          </div>

          {/* Mobile overlay */}
          {mobileOpen && (
            <div
              className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm md:hidden"
              onClick={() => setMobileOpen(false)}
            />
          )}

          <Suspense fallback={<div className="hidden md:flex w-[280px] shrink-0 border-r border-[var(--sidebar-border)] bg-[var(--sidebar-background)]" />}>
            <Sidebar mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} />
          </Suspense>

          <div className="relative flex flex-1 flex-col min-w-0 z-10">
            <div className="relative px-6 pt-5 md:px-10 md:pt-8">
              <TopBar
                onMenuClick={() => setMobileOpen(true)}
                initialPreset={initialPreset}
                initialFrom={initialFrom}
                initialTo={initialTo}
              />
            </div>
            <main className="relative flex-1 overflow-y-auto">
              <div className="mx-auto max-w-[1440px] px-6 pb-12 pt-4 md:px-10 md:pt-6">
                {children}
              </div>
            </main>
          </div>

          <AssistantDrawer />
        </div>
      </AssistantProvider>
    </CompanyCurrencyProvider>
  );
}
