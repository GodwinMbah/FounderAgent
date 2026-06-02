"use client";

import { useState } from "react";
import { resolveMerchantIdentity } from "@/lib/intelligence/merchant-identity";

interface MerchantLogoProps {
  name: string;
  size?: "sm" | "md" | "lg";
  showFallback?: boolean;
}

export default function MerchantLogo({
  name,
  size = "md",
  showFallback = true,
}: MerchantLogoProps) {
  const identity = resolveMerchantIdentity(name);
  const [imgError, setImgError] = useState(false);

  const sizeClasses = {
    sm: "w-6 h-6 text-[10px]",
    md: "w-8 h-8 text-xs",
    lg: "w-10 h-10 text-sm",
  };

  const imgSizeClasses = {
    sm: "w-6 h-6",
    md: "w-8 h-8",
    lg: "w-10 h-10",
  };

  if (!showFallback && !identity.isKnown) {
    return null;
  }

  const hasLogo = identity.logoUrl && !imgError;

  if (hasLogo) {
    return (
      <img
        src={identity.logoUrl}
        alt={identity.displayName}
        className={`inline-flex items-center justify-center rounded-full object-contain shrink-0 bg-white ${imgSizeClasses[size]}`}
        onError={() => setImgError(true)}
        loading="lazy"
      />
    );
  }

  return (
    <div
      className={`inline-flex items-center justify-center rounded-full font-semibold text-white shrink-0 ${sizeClasses[size]} ${identity.fallbackColor}`}
      title={identity.displayName}
    >
      {identity.fallbackInitials}
    </div>
  );
}
