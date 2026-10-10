import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

import { BASE_PATH } from "@/lib/base-path";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  // Link previews (WhatsApp, social networks) need absolute URLs; relative ones are joined to this.
  // Next doesn't add basePath to metadata URLs, so it's part of the base.
  metadataBase: new URL(`https://guto.ca${BASE_PATH}`),
  title: "Mission Control",
  description: "Live ISS tracker and space weather dashboard.",
  openGraph: {
    type: "website",
    siteName: "Mission Control",
    title: "Mission Control · Live ISS tracker",
    description: "Where the International Space Station is right now, its orbit, and today's space weather.",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  // Browser extensions (Grammarly, translators) add attributes to <html> and <body> before React
  // hydrates. suppressHydrationWarning ignores attribute mismatches on these two tags only.
  return (
    <html   lang="en"  className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}  suppressHydrationWarning>
      <body className="min-h-full flex flex-col" suppressHydrationWarning>{children}</body>
    </html>
  );
}
