import type { Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import PortalRoot from "./shell/PortalRoot";
import "./portal.css";

// Lets the portal draw edge to edge on iPhones; the shell pads for the safe areas.
export const viewport: Viewport = { viewportFit: "cover" };

/** Client portal (customer side): Geist and the shadcn/ui theme, for /portal and /portal/login only. */
export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return <PortalRoot className={GeistSans.variable}>{children}</PortalRoot>;
}
