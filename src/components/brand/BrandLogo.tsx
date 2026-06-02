"use client";

import Image from "next/image";

interface BrandLogoProps {
  className?: string;
}

export function BrandLogo({ className = "" }: BrandLogoProps) {
  return (
    <div className={`relative flex items-center ${className}`}>
      <Image
        src="/images/founderagent-logo.png"
        alt="FounderAgent"
        width={2172}
        height={724}
        className="w-full h-auto max-h-[50px] object-contain"
        style={{
          filter: "drop-shadow(0 0 10px rgba(139,92,246,0.25)) brightness(1.05)",
        }}
        priority
      />
    </div>
  );
}
