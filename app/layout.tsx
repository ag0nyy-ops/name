import type { Metadata } from "next";
import "./globals.css";
import { ThemeProvider } from "../components/ThemeProvider";
import { SiteHeader } from "../components/SiteHeader";
import { SiteFooter } from "../components/SiteFooter";

export const metadata: Metadata = {
  title: "whatsmynamerarity",
  description: "A transparent, privacy-first name rarity calculator.",
  icons: [{ rel: "icon", url: "/favicon.svg" }]
};

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <ThemeProvider>
          <SiteHeader />
          <main className="mx-auto flex w-full max-w-6xl flex-col gap-16 px-6 pb-20 pt-10 md:px-10">
            {children}
          </main>
          <SiteFooter />
        </ThemeProvider>
      </body>
    </html>
  );
}
