import type { Metadata, Viewport } from "next";
import "./globals.css";
import { SiteFooter } from "../components/SiteFooter";
import { SiteHeader } from "../components/SiteHeader";
import { THEME_SCRIPT, ThemeProvider } from "../components/ThemeProvider";

export const metadata: Metadata = {
  title: "whatsmynamerarity · how rare is your name?",
  description:
    "Estimate how many people in the US share your name, from SSA baby-name and Census surname data. Runs entirely in your browser."
};

export const viewport: Viewport = {
  themeColor: "#0a0a0b"
};

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body>
        <ThemeProvider>
          <SiteHeader />
          <main
            id="main"
            className="mx-auto flex w-full max-w-6xl flex-col gap-16 px-4 pb-20 pt-8 sm:px-6 md:px-10"
          >
            {children}
          </main>
          <SiteFooter />
        </ThemeProvider>
      </body>
    </html>
  );
}
