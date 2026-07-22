"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
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
      <path d={d} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
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
    `inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-bold uppercase tracking-wider transition ${
      pathname === href || pathname.startsWith(`${href}/`)
        ? "bg-primary text-white shadow-sm"
        : "text-text-dark hover:text-primary hover:bg-primary/5"
    }`;

  return (
    <header className="sticky top-0 z-40 px-4 py-4 w-full bg-transparent">
      <div className="mx-auto max-w-6xl rounded-full bg-white px-6 py-3.5 shadow-md flex items-center justify-between gap-4 border border-primary/10 relative">
        
        {/* Brand Logo & Partnership Handshake */}
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="flex items-center gap-2.5 font-[family-name:var(--font-display)] text-2xl font-bold tracking-tight text-text-dark hover:opacity-90 transition"
          >
            <Image
              src="/logo.png"
              alt="Sentry Logo"
              width={38}
              height={38}
              className="rounded-lg bg-primary/10 p-0.5 border border-primary/20"
            />
            <span className="font-sans font-extrabold tracking-tight lowercase">sentry</span>
          </Link>
          
          {/* Celo + Telegram Handshake badge */}
          <div className="flex items-center gap-1.5 bg-primary/8 rounded-full px-3 py-1 border border-primary/15 shadow-inner">
            <Image src="/celo_logo_png.png" alt="Celo Network" width={16} height={16} className="rounded-full shrink-0" />
            <span className="text-[10px] select-none text-text-dark/40">🤝</span>
            <Image src="/Telegram.png" alt="Telegram App" width={16} height={16} className="rounded-full shrink-0" />
          </div>
        </div>

        {/* Desktop Navigation */}
        <nav className="hidden items-center gap-1 lg:flex">
          {primary.map((link) => (
            <Link key={link.href} href={link.href} className={linkClass(link.href)}>
              {icons[link.href] ? <NavIcon d={icons[link.href]} /> : null}
              {link.label}
            </Link>
          ))}
          <span className="mx-2 h-4 w-px bg-primary/20" />
          {secondary.map((link) => (
            <Link key={link.href} href={link.href} className={linkClass(link.href)}>
              {link.label}
            </Link>
          ))}
          <div className="ml-2">
            <WalletConnectButton />
          </div>
        </nav>

        {/* Mobile Navigation controls */}
        <div className="flex items-center gap-2 lg:hidden">
          <WalletConnectButton />
          <button
            type="button"
            className="rounded-full bg-primary px-5 py-2 text-xs font-bold uppercase tracking-wider text-white hover:bg-primary/90 transition shadow cursor-pointer"
            aria-label={open ? "Close menu" : "Menu"}
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
          >
            Menu
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      <div
        className={`nav-drawer rounded-2xl mt-2 mx-auto max-w-6xl shadow-xl overflow-hidden transition-all duration-300 lg:hidden ${
          open ? "max-h-[30rem] border border-white/10 py-4 px-5" : "max-h-0 pointer-events-none"
        }`}
        aria-hidden={!open}
      >
        <div className="space-y-1.5">
          {[...primary, ...secondary].map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-bold uppercase tracking-wider transition ${
                pathname === link.href
                  ? "bg-primary text-white"
                  : "text-text-dark hover:bg-primary/5 hover:text-primary"
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
