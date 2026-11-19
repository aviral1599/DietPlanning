"use client";

import { Calendar, MessageCircleMore, ShoppingCart, Sun, User, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type Tab = "today" | "plan" | "grocery" | "profile" | "requests";

const TABS: { id: Tab; label: string; Icon: LucideIcon }[] = [
  { id: "today", label: "Today", Icon: Sun },
  { id: "plan", label: "My Plan", Icon: Calendar },
  { id: "grocery", label: "Grocery", Icon: ShoppingCart },
  { id: "profile", label: "Profile", Icon: User },
  { id: "requests", label: "Requests", Icon: MessageCircleMore },
];

/** Bottom tab bar, inside the phone-width column at every screen size. */
export default function TabBar({ tab, onChange, pending }: { tab: Tab; onChange: (t: Tab) => void; pending: number }) {
  return (
    <nav
      aria-label="Sections"
      className="fixed inset-x-0 bottom-0 z-30 mx-auto w-full max-w-[430px] border-t border-[#e4e4e4] bg-white pb-[env(safe-area-inset-bottom)]"
    >
      <div className="grid grid-cols-5 px-1.5">
        {TABS.map(({ id, label, Icon }) => {
          const active = tab === id;
          const count = id === "requests" ? pending : 0;
          return (
            <button
              key={id}
              type="button"
              onClick={() => onChange(id)}
              aria-current={active ? "page" : undefined}
              aria-label={count > 0 ? `${label}, ${count} pending` : label}
              className={cn(
                "flex flex-col items-center gap-[3px] pb-[15px] pt-[14px] text-[12px] leading-4 tracking-[-0.01em] outline-none focus-visible:bg-[#f6f6f6] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
                active ? "font-medium text-[#0a0a0a]" : "text-[#5c5c5c]"
              )}
            >
              <span className="relative">
                <Icon className="h-5 w-5" aria-hidden="true" />
                {count > 0 && (
                  <span className="absolute -right-2.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#171717] px-1 text-[10px] font-semibold leading-none tracking-normal text-white">
                    {count}
                  </span>
                )}
              </span>
              {label}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
