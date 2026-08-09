import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "NutriPlan — Master Mind Body Global",
  description:
    "Clinical diet planning workspace: assessment, exchange-based menus, and downloadable reports.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen font-sans antialiased">{children}</body>
    </html>
  );
}
