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
  title: "Sentry — AI Telegram Employee for Community Operations",
  description:
    "Sentry is an employer-controlled Telegram community operations agent. Workflow: Enable (groups) -> Fund (prepaid Celo wallet) -> Verify (employer reviews configured workflows & shift reports). 6 Capabilities: FAQ support, spam moderation, quizzes/polls, shift handover reports, adaptive playbooks, persona roles. Explicit Disclaimers: Sentry does NOT claim legal or fiduciary authority over user funds, hidden custody, unreviewed execution, or unstated privacy guarantees.",
  openGraph: {
    title: "Sentry — AI Telegram Employee",
    description:
      "Employer-controlled Telegram agent for FAQ support, spam moderation, trivia quizzes, and daily shift handovers. Workflow: Enable -> Fund -> Verify. Disclaims legal/fiduciary authority over funds.",
    url: "https://sentry-sigma-two.vercel.app/",
    siteName: "Sentry",
    type: "website",
  },
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
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    "name": "Sentry",
    "operatingSystem": "Telegram, Web",
    "applicationCategory": "BusinessApplication",
    "description": "Sentry is a configurable Telegram community operations agent controlled by employers.",
    "featureList": [
      "FAQ Support",
      "Spam Moderation",
      "Quizzes and Polls",
      "Shift Handover Reports",
      "Adaptive Playbooks",
      "Persona Roles"
    ],
    "offers": {
      "@type": "Offer",
      "price": "0",
      "priceCurrency": "USD"
    },
    "publishingPrinciples": "https://sentry-sigma-two.vercel.app/docs",
    "disclaimer": "Sentry does NOT claim legal or fiduciary authority over user funds, hidden custody, or unreviewed autonomous execution."
  };

  return (
    <html lang="en">
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
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

