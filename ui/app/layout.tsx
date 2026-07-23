import type { Metadata, Viewport } from "next";
import { Space_Grotesk, Newsreader } from "next/font/google";
import { SiteNav } from "@/components/SiteNav";
import { Providers } from "@/app/providers";
import "./globals.css";

const display = Newsreader({
  subsets: ["latin"],
  variable: "--font-display",
});

const body = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-body",
});

const talentHash = process.env.NEXT_PUBLIC_TALENT_PROJECT_VERIFICATION?.trim();

export const metadata: Metadata = {
  title: "Sentry — AI Employee for Telegram",
  description:
    "Hire an AI community employee that monitors, moderates, and reports inside Telegram, paid from a prepaid on-chain wallet.",
  ...(talentHash
    ? {
        other: {
          "talentapp:project_verification": talentHash,
        },
      }
    : {}),
};

/** Mobile-first / MiniApp viewport (Celo MiniPay, in-app browsers). */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
  themeColor: "#0052FF",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${display.variable} ${body.variable} antialiased pb-[env(safe-area-inset-bottom)]`}
      >
        <Providers>
          <SiteNav />
          {children}
        </Providers>
      </body>
    </html>
  );
}
