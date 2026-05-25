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
        className="w-full h-auto max-h-[60px] object-contain"
        priority
      />
    </div>
  );
}
