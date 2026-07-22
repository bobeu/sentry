"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { WalletConnectButton } from "@/components/WalletConnectButton";

const primary = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/groups", label: "Groups" },
  { href: "/employment", label: "Employment" },
  { href: "/wallet", label: "Wallet" },
];

const secondaryBase = [
  { href: "/pricing", label: "Pricing" },
  { href: "/settings", label: "Settings" },
  { href: "/docs", label: "Docs" },
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

type SessionUser = { id: string; email: string } | null;

export function SiteNav() {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [user, setUser] = useState<SessionUser>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const refreshAuth = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/me", { cache: "no-store" });
      const json = (await res.json()) as { user?: SessionUser };
      setUser(json.user ?? null);
    } catch {
      setUser(null);
    } finally {
      setAuthChecked(true);
    }
  }, []);

  useEffect(() => {
    void refreshAuth();
  }, [refreshAuth, pathname]);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  async function signOut() {
    setSigningOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      setUser(null);
      router.push("/login");
      router.refresh();
    } finally {
      setSigningOut(false);
    }
  }

  const linkClass = (href: string) =>
    `inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider transition whitespace-nowrap ${
      pathname === href || pathname.startsWith(`${href}/`)
        ? "bg-primary text-white shadow-sm"
        : "text-text-dark hover:text-primary hover:bg-primary/5"
    }`;

  return (
    <header className="sticky top-0 z-40 w-full bg-transparent px-3 py-3 sm:px-4 sm:py-4">
      <div className="mx-auto flex max-w-6xl min-w-0 items-center justify-between gap-3 overflow-hidden rounded-xl border border-primary/10 bg-white px-3 py-2.5 shadow-md sm:px-4 sm:py-3">
        <Link
          href="/"
          className="flex min-w-0 shrink-0 items-center gap-2.5 font-[family-name:var(--font-display)] text-text-dark transition hover:opacity-90"
        >
          <Image
            src="/logo.png"
            alt="Sentry"
            width={80}
            height={80}
            className="h-16 w-16 sm:h-20 sm:w-20 object-contain"
            priority
          />
          <span className="font-sans text-xl sm:text-2xl font-extrabold tracking-tight">
            Sentry
          </span>
        </Link>

        <nav className="hidden min-w-0 flex-1 items-center justify-end gap-0.5 xl:flex">
          {primary.map((link) => (
            <Link key={link.href} href={link.href} className={linkClass(link.href)}>
              {icons[link.href] ? <NavIcon d={icons[link.href]} /> : null}
              {link.label}
            </Link>
          ))}
          <span className="mx-1.5 h-4 w-px shrink-0 bg-primary/20" />
          {secondaryBase.map((link) => (
            <Link key={link.href} href={link.href} className={linkClass(link.href)}>
              {link.label}
            </Link>
          ))}
          {authChecked && user ? (
            <>
              <div className="ml-1.5 shrink-0">
                <WalletConnectButton />
              </div>
              <button
                type="button"
                onClick={() => void signOut()}
                disabled={signingOut}
                className="ml-1 shrink-0 rounded-xl border border-primary/15 bg-white px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-text-dark transition hover:border-primary hover:text-primary disabled:opacity-60"
              >
                {signingOut ? "…" : "Sign out"}
              </button>
            </>
          ) : (
            <Link href="/login" className={`${linkClass("/login")} ml-1.5`}>
              Sign in
            </Link>
          )}
        </nav>

        <div className="flex shrink-0 items-center gap-2 xl:hidden">
          {authChecked && user ? <WalletConnectButton /> : null}
          <button
            type="button"
            className="rounded-xl bg-primary px-4 py-2 text-xs font-bold uppercase tracking-wider text-white shadow transition hover:bg-primary/90 cursor-pointer"
            aria-label={open ? "Close menu" : "Menu"}
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
          >
            Menu
          </button>
        </div>
      </div>

      <div
        className={`nav-drawer mx-auto mt-2 max-w-6xl overflow-hidden rounded-xl shadow-xl transition-all duration-300 xl:hidden ${
          open ? "max-h-[32rem] border border-primary/10 py-3 px-4" : "max-h-0 pointer-events-none"
        }`}
        aria-hidden={!open}
      >
        <div className="space-y-1">
          {[...primary, ...secondaryBase].map((link) => (
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
          {authChecked && user ? (
            <button
              type="button"
              onClick={() => void signOut()}
              disabled={signingOut}
              className="flex w-full items-center rounded-xl px-4 py-3 text-left text-sm font-bold uppercase tracking-wider text-text-dark hover:bg-primary/5 hover:text-primary disabled:opacity-60"
            >
              {signingOut ? "Signing out…" : "Sign out"}
            </button>
          ) : (
            <Link
              href="/login"
              className="flex items-center rounded-xl px-4 py-3 text-sm font-bold uppercase tracking-wider text-text-dark hover:bg-primary/5 hover:text-primary"
            >
              Sign in
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
