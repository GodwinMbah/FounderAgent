"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

interface AgentOrbProps {
  size?: number;
  animated?: boolean;
  active?: boolean;
  thinking?: boolean;
  showGlow?: boolean;
  className?: string;
}

export function AgentOrb({
  size = 64,
  animated = true,
  active = false,
  thinking = false,
  showGlow = true,
  className = "",
}: AgentOrbProps) {
  const [reducedMotion, setReducedMotion] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  });

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  const shouldAnimate = animated && !reducedMotion;
  const isActiveOrThinking = active || thinking;
  const glowOpacity = isActiveOrThinking ? 0.95 : 0.65;

  return (
    <div
      className={`group relative inline-flex items-center justify-center shrink-0 ${
        shouldAnimate ? "animateOrbFloat" : ""
      } ${className}`}
      style={{ width: size, height: size }}
    >
      {/* Outer radial glow */}
      {showGlow && (
        <div
          className={`absolute rounded-full transition-opacity duration-500 ${
            shouldAnimate ? (thinking ? "animateOrbPulseFast" : "animateOrbPulse") : ""
          }`}
          style={{
            width: size * 1.7,
            height: size * 1.7,
            background:
              "radial-gradient(circle, rgba(139,92,246,0.38) 0%, rgba(20,184,166,0.12) 40%, transparent 70%)",
            filter: "blur(18px)",
            opacity: glowOpacity,
          }}
        />
      )}

      {/* Secondary teal glow */}
      {showGlow && (
        <div
          className={`absolute rounded-full transition-opacity duration-500 ${
            shouldAnimate ? (thinking ? "animateOrbPulseFast" : "animateOrbPulse") : ""
          }`}
          style={{
            width: size * 1.25,
            height: size * 1.25,
            background:
              "radial-gradient(circle, rgba(20,184,166,0.18) 0%, transparent 60%)",
            filter: "blur(14px)",
            animationDelay: thinking ? "0.6s" : "1.2s",
            opacity: glowOpacity * 0.8,
          }}
        />
      )}

      {/* Orbital particle dots */}
      {shouldAnimate && showGlow && (
        <>
          <span
            className="absolute rounded-full animateParticleOrbit"
            style={{
              width: Math.max(3, size * 0.045),
              height: Math.max(3, size * 0.045),
              top: size * 0.12,
              right: size * 0.08,
              background: "#14B8A6",
              boxShadow: "0 0 12px rgba(20,184,166,0.9)",
            }}
          />
          <span
            className="absolute rounded-full animateParticleOrbit"
            style={{
              width: Math.max(2, size * 0.035),
              height: Math.max(2, size * 0.035),
              bottom: size * 0.18,
              left: size * 0.04,
              background: "#8B5CF6",
              boxShadow: "0 0 12px rgba(139,92,246,0.9)",
              animationDelay: "1.5s",
            }}
          />
          <span
            className="absolute rounded-full animateParticleOrbit"
            style={{
              width: Math.max(2, size * 0.035),
              height: Math.max(2, size * 0.035),
              top: size * 0.55,
              left: size * 0.12,
              background: "#22D3EE",
              boxShadow: "0 0 12px rgba(34,211,238,0.9)",
              animationDelay: "2.8s",
            }}
          />
        </>
      )}

      {/* Orb image */}
      <Image
        src="/assets/founderagent_orb_icon_transparent.png"
        alt="FounderAgent AI Orb"
        width={size}
        height={size}
        className="relative z-10 object-contain"
        style={{
          filter: isActiveOrThinking
            ? "drop-shadow(0 0 28px rgba(139,92,246,0.85)) drop-shadow(0 0 44px rgba(20,184,166,0.5))"
            : showGlow
            ? "drop-shadow(0 0 16px rgba(139,92,246,0.45)) drop-shadow(0 0 24px rgba(20,184,166,0.25))"
            : "none",
          transition: "filter 0.4s ease",
        }}
        priority
      />

      {/* Hover intensification glow */}
      {showGlow && (
        <div
          className="absolute z-10 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-400 pointer-events-none"
          style={{
            width: size,
            height: size,
            background:
              "radial-gradient(circle, rgba(139,92,246,0.15) 0%, transparent 70%)",
            filter: "blur(10px)",
          }}
        />
      )}

      {/* Eye glow overlays */}
      {shouldAnimate && size >= 40 && (
        <>
          <span
            className="absolute z-20 rounded-full animateEyeSignal"
            style={{
              width: Math.max(2, size * 0.032),
              height: Math.max(2, size * 0.032),
              top: size * 0.38,
              left: size * 0.33,
              background:
                "radial-gradient(circle at 30% 30%, #fff 0%, #e9d5ff 40%, #a78bfa 100%)",
              boxShadow: `0 0 ${size * 0.06}px ${size * 0.03}px rgba(196,181,253,0.55)`,
            }}
          />
          <span
            className="absolute z-20 rounded-full animateEyeSignal"
            style={{
              width: Math.max(2, size * 0.032),
              height: Math.max(2, size * 0.032),
              top: size * 0.38,
              right: size * 0.33,
              background:
                "radial-gradient(circle at 30% 30%, #fff 0%, #e9d5ff 40%, #a78bfa 100%)",
              boxShadow: `0 0 ${size * 0.06}px ${size * 0.03}px rgba(196,181,253,0.55)`,
              animationDelay: "1.8s",
            }}
          />
        </>
      )}
    </div>
  );
}
