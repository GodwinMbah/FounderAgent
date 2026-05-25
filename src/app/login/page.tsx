"use client";

import { useState } from "react";
import Link from "next/link";
import { signInAndRedirect } from "./actions";
import { AgentOrb } from "@/components/AgentOrb";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { Mail, Lock, ArrowRight, AlertCircle } from "lucide-react";

export default function LoginPage() {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(formData: FormData) {
    setError(null);
    setLoading(true);
    const result = await signInAndRedirect(formData);
    setLoading(false);
    if (result?.error) {
      setError(result.error);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--background)] relative overflow-hidden">
      {/* Ambient background glows */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-[-10%] left-[-5%] w-[50%] h-[50%] rounded-full opacity-40"
          style={{ background: "radial-gradient(circle, rgba(139,92,246,0.1) 0%, transparent 60%)", filter: "blur(100px)" }} />
        <div className="absolute bottom-[-10%] right-[-5%] w-[45%] h-[45%] rounded-full opacity-30"
          style={{ background: "radial-gradient(circle, rgba(20,184,166,0.08) 0%, transparent 60%)", filter: "blur(100px)" }} />
      </div>

      <div className="relative w-full max-w-md px-6">
        {/* Logo */}
        <div className="flex flex-col items-center mb-10">
          <div className="mb-6">
            <BrandLogo className="max-w-[180px]" />
          </div>
          <div className="relative">
            <AgentOrb size={64} animated active showGlow />
          </div>
        </div>

        {/* Card */}
        <div className="relative rounded-2xl border border-[var(--border)] bg-gradient-to-b from-[#111827] to-[#0c0c14] p-8 shadow-2xl">
          {/* Top accent line */}
          <div className="absolute top-0 left-4 right-4 h-px bg-gradient-to-r from-transparent via-[var(--accent)]/40 to-transparent" />

          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-[var(--foreground)] mb-1">Welcome back</h1>
            <p className="text-sm text-[var(--muted-foreground)]">Sign in to your FounderAgent workspace</p>
          </div>

          {error && (
            <div className="mb-6 flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3">
              <AlertCircle className="h-4 w-4 text-red-400 shrink-0" />
              <p className="text-sm text-red-300">{error}</p>
            </div>
          )}

          <form action={handleSubmit} className="space-y-5">
            <div className="space-y-1.5">
              <label htmlFor="email" className="block text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wider">
                Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--muted-foreground)]" />
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  placeholder="founder@acmelabs.com"
                  className="w-full rounded-xl border border-[var(--border)] bg-[#0a0a12] py-2.5 pl-10 pr-4 text-sm text-[var(--foreground)] placeholder:text-[var(--muted-foreground)]/50 focus:border-[var(--accent)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]/30 transition-colors"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="password" className="block text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wider">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--muted-foreground)]" />
                <input
                  id="password"
                  name="password"
                  type="password"
                  required
                  placeholder="••••••••"
                  className="w-full rounded-xl border border-[var(--border)] bg-[#0a0a12] py-2.5 pl-10 pr-4 text-sm text-[var(--foreground)] placeholder:text-[var(--muted-foreground)]/50 focus:border-[var(--accent)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]/30 transition-colors"
                />
              </div>
            </div>

            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" name="remember" className="rounded border-[var(--border)] bg-[#0a0a12] text-[var(--accent)] focus:ring-[var(--accent)]/30" />
                <span className="text-xs text-[var(--muted-foreground)]">Remember me</span>
              </label>
              <Link href="/login?forgot=true" className="text-xs text-[var(--accent)] hover:text-[var(--accent)]/80 transition-colors">
                Forgot password?
              </Link>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="group w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[var(--accent)] to-[#0d9488] py-2.5 text-sm font-semibold text-white shadow-lg shadow-[var(--accent)]/20 hover:shadow-[var(--accent)]/30 hover:from-[#2dd4bf] hover:to-[var(--accent)] transition-all disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? (
                <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  Sign in
                  <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
                </>
              )}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-xs text-[var(--muted-foreground)]">
              Don&apos;t have an account?{" "}
              <Link href="/signup" className="text-[var(--accent)] hover:text-[var(--accent)]/80 font-medium transition-colors">
                Create one
              </Link>
            </p>
          </div>
        </div>

        {/* Footer */}
        <p className="mt-8 text-center text-[11px] text-[var(--muted-foreground)]/60">
          By signing in, you agree to our Terms of Service and Privacy Policy
        </p>
      </div>
    </div>
  );
}
