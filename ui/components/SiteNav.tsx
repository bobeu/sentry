"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { APP_NAME } from "@/lib/constants";
import { WalletConnectButton } from "@/components/WalletConnectButton";

const primary = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/groups", label: "Groups" },
  { href: "/employment", label: "Employment" },
  { href: "/wallet", label: "Wallet" },
];

const secondary = [
  { href: "/pricing", label: "Pricing" },
  { href: "/settings", label: "Settings" },
  { href: "/docs", label: "Docs" },
  { href: "/login", label: "Sign in" },
];

function NavIcon({ d }: { d: string }) {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" aria-hidden>
      <path d={d} stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const icons: Record<string, string> = {
  "/dashboard": "M4 13h6V4H4v9zm10 7h6V4h-6v16zM4 20h6v-5H4v5z",
  "/groups": "M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75",
  "/employment": "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM22 11l-3 3-2-2",
  "/wallet": "M21 12V7H5a2 2 0 0 1 0-4h14v4M3 5v14a2 2 0 0 0 2 2h16v-5M16 12a2 2 0 1 0 0-.01",
};

export function SiteNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  const linkClass = (href: string) =>
    `inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm transition ${
      pathname === href || pathname.startsWith(`${href}/`)
        ? "bg-[var(--accent)]/15 text-[var(--accent)]"
        : "text-[#b9c9b5] hover:text-[#8cf1b7]"
    }`;

  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-[#0b120c]/80 backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-3 sm:px-6">
        <Link
          href="/"
          className="font-[family-name:var(--font-display)] text-2xl tracking-tight text-[#f1faea] transition hover:text-white"
        >
          {APP_NAME}
        </Link>

        <nav className="hidden items-center gap-1 lg:flex">
          {primary.map((link) => (
            <Link key={link.href} href={link.href} className={linkClass(link.href)}>
              {icons[link.href] ? <NavIcon d={icons[link.href]} /> : null}
              {link.label}
            </Link>
          ))}
          <span className="mx-2 h-4 w-px bg-white/15" />
          {secondary.map((link) => (
            <Link key={link.href} href={link.href} className={linkClass(link.href)}>
              {link.label}
            </Link>
          ))}
          <div className="ml-2">
            <WalletConnectButton />
          </div>
        </nav>

        <div className="flex items-center gap-2 lg:hidden">
          <WalletConnectButton />
          <button
            type="button"
            className="rounded-full border border-white/15 bg-white/5 p-2 text-[#e8f5d8]"
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden>
              {open ? (
                <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              ) : (
                <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              )}
            </svg>
          </button>
        </div>
      </div>

      <div
        className={`nav-drawer lg:hidden ${open ? "nav-drawer-open" : ""}`}
        aria-hidden={!open}
      >
        <div className="space-y-1 px-5 pb-6 pt-2">
          {[...primary, ...secondary].map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`flex items-center gap-3 rounded-xl px-3 py-3 text-base ${
                pathname === link.href
                  ? "bg-[var(--accent)]/15 text-[var(--accent)]"
                  : "text-[#d7e6d1]"
              }`}
            >
              {icons[link.href] ? <NavIcon d={icons[link.href]} /> : null}
              {link.label}
            </Link>
          ))}
        </div>
      </div>
    </header>
  );
}
