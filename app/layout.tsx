import type { Metadata } from "next";
import { Space_Grotesk, Newsreader } from "next/font/google";
import { SiteNav } from "@/components/SiteNav";
import "./globals.css";

const display = Newsreader({
  subsets: ["latin"],
  variable: "--font-display",
});

const body = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-body",
});

export const metadata: Metadata = {
  title: "Sentry — AI Employee for Telegram",
  description:
    "Hire an AI community employee that monitors, moderates, and reports inside Telegram, paid from a prepaid on-chain wallet.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${display.variable} ${body.variable} antialiased`}>
        <SiteNav />
        {children}
      </body>
    </html>
  );
}
