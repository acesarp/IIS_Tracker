import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
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
  title: "Mission Control",
  description: "Live ISS tracker and space weather dashboard.",
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
