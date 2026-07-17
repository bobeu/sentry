import Link from "next/link";
import { APP_NAME } from "@/lib/constants";

const links = [
  { href: "/", label: "Home" },
  { href: "/dashboard", label: "Dashboard" },
  { href: "/groups", label: "Groups" },
  { href: "/employment", label: "Employment" },
  { href: "/wallet", label: "Wallet" },
  { href: "/pricing", label: "Pricing" },
  { href: "/settings", label: "Settings" },
  { href: "/docs", label: "Documentation" },
  { href: "/login", label: "Sign in" },
];

export function SiteNav() {
  return (
    <header className="relative z-20 border-b border-white/10 bg-[#0b120c]/75 backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-5 px-6 py-4">
        <Link
          href="/"
          className="font-[family-name:var(--font-display)] text-2xl tracking-tight text-[#f1faea]"
        >
          {APP_NAME}
        </Link>
        <nav className="flex max-w-[72%] flex-wrap items-center justify-end gap-x-4 gap-y-2 text-xs text-[#b9c9b5] sm:max-w-none sm:gap-x-6 sm:text-sm">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="transition hover:text-[#8cf1b7]"
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
