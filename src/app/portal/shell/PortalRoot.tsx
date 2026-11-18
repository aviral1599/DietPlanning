"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

// Radix menus and sheets render through a React portal. Pointing them at a node
// inside `.portal` keeps the portal's theme tokens and font on them (the tokens
// are not defined on <body>).
const PortalContainerContext = createContext<HTMLElement | null>(null);

export function usePortalContainer(): HTMLElement | undefined {
  return useContext(PortalContainerContext) ?? undefined;
}

export default function PortalRoot({ className, children }: { className?: string; children: ReactNode }) {
  const [container, setContainer] = useState<HTMLDivElement | null>(null);
  return (
    <PortalContainerContext.Provider value={container}>
      <div className={cn("portal", className)}>
        {children}
        <div ref={setContainer} />
      </div>
    </PortalContainerContext.Provider>
  );
}
