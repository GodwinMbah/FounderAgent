"use client";

import { getProviderInfo, getMerchantInitials, getMerchantColor } from "@/lib/providers/registry";

interface MerchantAvatarProps {
  name: string;
  size?: "sm" | "md" | "lg";
}

export function MerchantAvatar({ name, size = "md" }: MerchantAvatarProps) {
  const info = getProviderInfo(name);
  const initials = info?.fallbackInitials ?? getMerchantInitials(name);
  const colorClass = info?.fallbackColor ?? getMerchantColor(name);

  const sizeClasses = {
    sm: "w-6 h-6 text-[10px]",
    md: "w-8 h-8 text-xs",
    lg: "w-10 h-10 text-sm",
  };

  return (
    <div
      className={`${sizeClasses[size]} ${colorClass} rounded-full flex items-center justify-center font-semibold text-white shrink-0`}
      title={info?.displayName ?? name}
    >
      {initials}
    </div>
  );
}
