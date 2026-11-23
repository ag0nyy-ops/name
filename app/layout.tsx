// jay. — © 2026 Jay — https://ag0nyy-ops.github.io/ — source viewable, not reusable by others (LICENSE)
import type { Metadata, Viewport } from "next";
import "./globals.css";
import { SiteFooter } from "../components/SiteFooter";
import { SiteHeader } from "../components/SiteHeader";

export const metadata: Metadata = {
  title: "Name rarity · how rare is your name?",
  description:
    "Estimate how many people in the US share your name, from SSA baby-name and Census surname data. Runs entirely in your browser."
};

export const viewport: Viewport = {
  themeColor: "#060606",
  colorScheme: "dark"
};

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <SiteHeader />
        <main id="main" className="page flex flex-col pt-12 sm:pt-16">
          {children}
        </main>
        <SiteFooter />
        <div className="atmosphere" aria-hidden="true" />
      </body>
    </html>
  );
}
