import Link from "next/link";
import { APP_NAME } from "@/lib/constants";

const links = [
  { href: "/", label: "Home" },
  { href: "/dashboard", label: "Dashboard" },
  { href: "/groups", label: "Groups" },
  { href: "/employment", label: "Employment" },
  { href: "/wallet", label: "Wallet" },
  { href: "/settings", label: "Settings" },
  { href: "/docs", label: "Documentation" },
  { href: "/login", label: "Sign in" },
];

export function SiteNav() {
  return (
    <header className="relative z-20 border-b border-white/10 bg-[#0b120c]/70 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <Link
          href="/"
          className="font-[family-name:var(--font-display)] text-2xl tracking-tight text-[#e8f5d8]"
        >
          {APP_NAME}
        </Link>
        <nav className="flex flex-wrap items-center justify-end gap-4 text-sm text-[#c7d6c4] sm:gap-6">
          {links.map((link) => (
            <Link key={link.href} href={link.href} className="transition hover:text-white">
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
