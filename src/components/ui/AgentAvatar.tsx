"use client";

export function AgentAvatar({ size = 40 }: { size?: number }) {
  return (
    <div
      className="relative flex items-center justify-center rounded-full"
      style={{ width: size, height: size }}
    >
      <div
        className="absolute inset-0 rounded-full bg-[var(--highlight)]/20 blur-md"
        style={{ transform: "scale(1.2)" }}
      />
      <div className="relative flex items-center justify-center rounded-full bg-[var(--highlight)]/10 border border-[var(--highlight)]/30 w-full h-full">
        <svg width={size * 0.5} height={size * 0.5} viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="10" r="5" fill="var(--highlight)" fillOpacity={0.8} />
          <circle cx="10" cy="9" r="1.2" fill="white" />
          <circle cx="14" cy="9" r="1.2" fill="white" />
          <path d="M8 15c1.5 2 4.5 2 6 0" stroke="var(--soft-lilac)" strokeWidth={1.2} strokeLinecap="round" />
          <path d="M12 15v3" stroke="var(--highlight)" strokeWidth={1.5} strokeLinecap="round" />
          <circle cx="12" cy="19" r="2" fill="var(--highlight)" fillOpacity={0.4} />
        </svg>
      </div>
    </div>
  );
}
