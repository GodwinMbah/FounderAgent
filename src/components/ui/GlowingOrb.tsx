"use client";

export function GlowingOrb({ size = 48 }: { size?: number }) {
  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      {/* Outer glow */}
      <div
        className="absolute rounded-full"
        style={{
          width: size * 1.4,
          height: size * 1.4,
          background: "radial-gradient(circle, rgba(139,92,246,0.25) 0%, rgba(20,184,166,0.1) 50%, transparent 70%)",
          filter: "blur(8px)",
        }}
      />
      {/* Middle ring glow */}
      <div
        className="absolute rounded-full border border-[var(--highlight)]/30"
        style={{
          width: size,
          height: size,
          background: "radial-gradient(circle at 35% 35%, rgba(139,92,246,0.4) 0%, rgba(20,184,166,0.15) 60%, rgba(15,23,42,0.8) 100%)",
          boxShadow: "inset 0 0 12px rgba(139,92,246,0.2), 0 0 16px rgba(139,92,246,0.15)",
        }}
      />
      {/* Inner core */}
      <div
        className="absolute rounded-full"
        style={{
          width: size * 0.5,
          height: size * 0.5,
          background: "radial-gradient(circle at 40% 40%, #c4b5fd 0%, #8b5cf6 40%, #14b8a6 100%)",
          filter: "blur(2px)",
          opacity: 0.9,
        }}
      />
      {/* Bright center dot */}
      <div
        className="absolute rounded-full bg-white"
        style={{
          width: size * 0.12,
          height: size * 0.12,
          top: size * 0.32,
          left: size * 0.38,
          filter: "blur(0.5px)",
          opacity: 0.9,
        }}
      />
      {/* Secondary dot */}
      <div
        className="absolute rounded-full bg-[var(--neon-cyan)]"
        style={{
          width: size * 0.08,
          height: size * 0.08,
          bottom: size * 0.35,
          right: size * 0.32,
          filter: "blur(0.5px)",
          opacity: 0.7,
        }}
      />
    </div>
  );
}
