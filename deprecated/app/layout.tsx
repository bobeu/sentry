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

export const metadata: Metadata = {
  title: "Sentry — AI Telegram Employee",
  description:
    "Hire an intelligent AI Telegram employee: FAQs, moderation, polls & learn-and-earn games with points/cash rewards, and work reports — paid from a prepaid Celo wallet.",
  other: {
    "talentapp:project_verification":
      "ac0c9f41cc60724a34a0afdd8fa3f7f543df312c8641ad7cc461e854a0154ac454f6c7a049e362273c5cd745534ce95dc6a013eae6eb222e76576ae8aeb3c8ec",
  },
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
