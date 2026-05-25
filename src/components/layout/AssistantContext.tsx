"use client";

import { createContext, useContext, useState, ReactNode } from "react";

interface AssistantContextType {
  open: boolean;
  setOpen: (open: boolean) => void;
}

const AssistantContext = createContext<AssistantContextType | null>(null);

export function AssistantProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <AssistantContext.Provider value={{ open, setOpen }}>
      {children}
    </AssistantContext.Provider>
  );
}

export function useAssistant() {
  const ctx = useContext(AssistantContext);
  if (!ctx) throw new Error("useAssistant must be used within AssistantProvider");
  return ctx;
}
