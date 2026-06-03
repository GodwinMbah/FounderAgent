"use client";

import { createContext, useContext, ReactNode } from "react";

export type CurrencyCode = "USD" | "GBP" | "EUR" | "AUD" | "CAD" | "JPY" | string;

interface CompanyCurrencyContextValue {
  currency: CurrencyCode;
  symbol: string;
}

const CompanyCurrencyContext = createContext<CompanyCurrencyContextValue>({
  currency: "GBP",
  symbol: "£",
});

export function CompanyCurrencyProvider({
  currency,
  children,
}: {
  currency: CurrencyCode;
  children: ReactNode;
}) {
  const symbol = getCurrencySymbol(currency);
  return (
    <CompanyCurrencyContext.Provider value={{ currency, symbol }}>
      {children}
    </CompanyCurrencyContext.Provider>
  );
}

export function useCompanyCurrency(): CompanyCurrencyContextValue {
  return useContext(CompanyCurrencyContext);
}

export function getCurrencySymbol(currency: CurrencyCode): string {
  const map: Record<string, string> = {
    USD: "$",
    GBP: "£",
    EUR: "€",
    JPY: "¥",
    INR: "₹",
    AUD: "A$",
    CAD: "C$",
  };
  return map[currency] || map[currency.toUpperCase()] || currency;
}
