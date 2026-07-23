"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useId, useState } from "react";
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
  const panelId = useId();
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
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
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
      setOpen(false);
    }
  }

  const linkClass = (href: string) =>
    `inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider transition whitespace-nowrap ${
      pathname === href || pathname.startsWith(`${href}/`)
        ? "bg-primary text-white shadow-sm"
        : "text-text-dark hover:text-primary hover:bg-primary/5"
    }`;

  const mobileLinkClass = (href: string) =>
    `flex min-h-11 items-center gap-3 rounded-xl px-4 py-3 text-sm font-bold uppercase tracking-wider transition ${
      pathname === href || pathname.startsWith(`${href}/`)
        ? "bg-primary text-white"
        : "text-text-dark hover:bg-primary/5 hover:text-primary"
    }`;

  return (
    <header className="sticky top-0 z-50 w-full bg-transparent px-3 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3 sm:px-4 sm:py-4">
      <div className="mx-auto flex max-w-6xl min-w-0 items-center justify-between gap-2 rounded-xl border border-primary/10 bg-white px-3 py-2 shadow-md sm:gap-3 sm:px-4 sm:py-3">
        <Link
          href="/"
          className="flex min-w-0 shrink items-center gap-2 font-[family-name:var(--font-display)] text-text-dark transition hover:opacity-90"
          onClick={() => setOpen(false)}
        >
          <Image
            src="/logo.png"
            alt="Sentry"
            width={64}
            height={64}
            className="h-10 w-10 shrink-0 object-contain sm:h-14 sm:w-14 md:h-16 md:w-16"
            priority
          />
          <span className="truncate font-sans text-lg font-extrabold tracking-tight sm:text-xl md:text-2xl">
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
          {authChecked && user ? (
            <div className="max-w-[42vw] overflow-hidden sm:max-w-none">
              <WalletConnectButton />
            </div>
          ) : null}
          <button
            type="button"
            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl bg-primary px-3 py-2 text-xs font-bold uppercase tracking-wider text-white shadow transition hover:bg-primary/90"
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            aria-controls={panelId}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? (
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden>
                <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden>
                <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Backdrop — xl+ never shown */}
      <button
        type="button"
        aria-label="Close menu"
        className={`fixed inset-0 z-40 bg-text-dark/35 backdrop-blur-[1px] transition-opacity xl:hidden ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        tabIndex={open ? 0 : -1}
        onClick={() => setOpen(false)}
      />

      {/* Mobile drawer — CSS class controls height so Tailwind can't be overridden by .nav-drawer { max-height:0 } */}
      <div
        id={panelId}
        className={`nav-drawer fixed inset-x-3 z-50 mx-auto mt-2 max-w-6xl rounded-xl border border-primary/10 bg-white shadow-xl xl:hidden ${
          open ? "nav-drawer-open" : ""
        }`}
        style={{ top: "calc(env(safe-area-inset-top, 0px) + 4.25rem)" }}
        aria-hidden={!open}
      >
        <nav className="max-h-[min(70vh,28rem)] space-y-1 overflow-y-auto overscroll-contain px-3 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          {[...primary, ...secondaryBase].map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={mobileLinkClass(link.href)}
              onClick={() => setOpen(false)}
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
              className="flex min-h-11 w-full items-center rounded-xl px-4 py-3 text-left text-sm font-bold uppercase tracking-wider text-text-dark hover:bg-primary/5 hover:text-primary disabled:opacity-60"
            >
              {signingOut ? "Signing out…" : "Sign out"}
            </button>
          ) : (
            <Link
              href="/login"
              className={mobileLinkClass("/login")}
              onClick={() => setOpen(false)}
            >
              Sign in
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
