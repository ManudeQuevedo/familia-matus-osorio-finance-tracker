import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import { FinanceThemeProvider } from "@/components/providers/FinanceThemeProvider";
import { ThemeRippleProvider } from "@/components/shared/theme-toggle";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Finanzas",
  description: "Family finance tracker",
  icons: {
    icon: [
      {
        url: "/favicon-light.png",
        media: "(prefers-color-scheme: light)",
        type: "image/svg+xml",
      },
      {
        url: "/favicon-dark.png",
        media: "(prefers-color-scheme: dark)",
        type: "image/svg+xml",
      },
    ],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      data-accent="emerald"
      suppressHydrationWarning
      className="h-full">
      <head>
        <link
          rel="icon"
          href="/favicon-light.svg"
          media="(prefers-color-scheme: light)"
          type="image/svg+xml"
        />
        <link
          rel="icon"
          href="/favicon-dark.svg"
          media="(prefers-color-scheme: dark)"
          type="image/svg+xml"
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} flex h-full min-h-0 flex-col bg-background font-sans text-foreground antialiased transition-colors duration-200`}>
        <FinanceThemeProvider>
          <ThemeRippleProvider>{children}</ThemeRippleProvider>
        </FinanceThemeProvider>
      </body>
    </html>
  );
}
