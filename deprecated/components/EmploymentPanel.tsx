"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { EMPLOYMENT_AGREEMENT_VERSION } from "@/lib/employment-agreement";

type Employment = {
  id: string;
  status: string;
  startedAt: string | null;
  pausedAt: string | null;
  agreementVersion?: string | null;
  agreementAcceptedAt?: string | Date | null;
};

export function EmploymentPanel() {
  const [employment, setEmployment] = useState<Employment | null>(null);
  const [status, setStatus] = useState("Inactive");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [currency, setCurrency] = useState("USDm");
  const [currencies, setCurrencies] = useState<string[]>(["USDm"]);
  const [showAgreement, setShowAgreement] = useState(false);
  const [agreementText, setAgreementText] = useState("");
  const [agreementVersion, setAgreementVersion] = useState(
    EMPLOYMENT_AGREEMENT_VERSION,
  );
  const [agreementTitle, setAgreementTitle] = useState(
    "Sentry Employment Agreement",
  );
  const [hireMode, setHireMode] = useState(true);

  async function refresh() {
    const res = await fetch("/api/employment/status");
    const json = await res.json();
    if (!res.ok) {
      setError(json.error ?? "Failed to load employment");
      return;
    }
    setStatus(json.status);
    setEmployment(json.employment);
    setError(null);
  }

  useEffect(() => {
    void refresh();
    void fetch("/api/payment/currency")
      .then((res) => res.json())
      .then((json) => {
        const enabled = (json.currencies ?? [])
          .filter((item: { enabled: boolean }) => item.enabled)
          .map((item: { currency: string }) => item.currency);
        if (enabled.length) {
          setCurrencies(enabled);
          setCurrency(enabled.includes("USDm") ? "USDm" : enabled[0]);
        }
      });
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.get("hire") === "1") {
        void openAgreement(true);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- open once on mount for ?hire=1
  }, []);

  async function openAgreement(forHire: boolean) {
    setHireMode(forHire);
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/employment/agreement");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Could not load agreement");
      setAgreementText(json.text ?? "");
      setAgreementVersion(json.version ?? EMPLOYMENT_AGREEMENT_VERSION);
      setAgreementTitle(json.title ?? "Sentry Employment Agreement");
      setShowAgreement(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load agreement");
    } finally {
      setLoading(false);
    }
  }

  async function rejectAgreement() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/employment/agreement", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          decision: "reject",
          version: agreementVersion,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Reject failed");
      setShowAgreement(false);
      setMessage(
        json.message ??
          "Agreement rejected. No hire action was taken — employment did not proceed.",
      );
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reject failed");
    } finally {
      setLoading(false);
    }
  }

  async function acceptAndHire() {
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/employment/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currency,
          agreementAccepted: true,
          agreementVersion,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Hire failed");
      setShowAgreement(false);
      setMessage(json.message ?? `Status: ${json.employment?.status ?? "updated"}`);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Hire failed");
    } finally {
      setLoading(false);
    }
  }

  async function run(path: string) {
    setLoading(true);
    setMessage(null);
    setError(null);
    try {
      const res = await fetch(path, { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Request failed");
      setMessage(json.message ?? `Status: ${json.employment?.status ?? "updated"}`);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setLoading(false);
    }
  }

  const acceptedAt = employment?.agreementAcceptedAt
    ? new Date(employment.agreementAcceptedAt).toLocaleDateString()
    : null;

  return (
    <div className="mt-8 max-w-xl space-y-6 animate-rise">
      <div className="surface-card p-6 border border-primary/10 shadow-sm">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-muted">
          EMPLOYMENT CREDENTIAL
        </p>
        <div className="mt-4 flex items-center justify-between gap-3">
          <p className="text-2xl font-black text-text-dark">
            {status === "Active" ? (
              <span className="text-[#00D283] flex items-center gap-2">
                <span className="relative flex h-3 w-3">
                  <span className="status-pulse absolute inline-flex h-full w-full rounded-full bg-[#00D283] opacity-75" />
                  <span className="relative inline-flex h-3 w-3 rounded-full bg-[#00D283]" />
                </span>
                Active Duty
              </span>
            ) : status === "Paused" ? (
              <span className="text-warning flex items-center gap-2">Paused</span>
            ) : (
              <span className="text-muted flex items-center gap-2">Inactive</span>
            )}
          </p>
          {employment?.startedAt ? (
            <span className="text-[10px] text-muted bg-bg-light/60 border border-primary/10 rounded px-2.5 py-1 font-bold font-mono">
              Started {new Date(employment.startedAt).toLocaleDateString()}
            </span>
          ) : null}
        </div>
        {employment?.agreementVersion ? (
          <p className="mt-3 text-[11px] text-muted font-medium">
            Agreement v{employment.agreementVersion}
            {acceptedAt ? ` · accepted ${acceptedAt}` : ""}
          </p>
        ) : (
          <p className="mt-3 text-[11px] text-muted font-medium">
            Hiring requires accepting the Employment Agreement. Rejecting cancels hire.
          </p>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {status === "Inactive" || !employment ? (
          <select
            value={currency}
            onChange={(event) => setCurrency(event.target.value)}
            className="rounded-xl border border-primary/15 bg-white px-4 py-2.5 text-xs font-bold text-text-dark focus:border-primary outline-none cursor-pointer shadow-sm"
            aria-label="Wallet currency"
          >
            {currencies.map((item) => (
              <option key={item} value={item} className="bg-white text-text-dark">
                {item}
              </option>
            ))}
          </select>
        ) : null}
        <button
          type="button"
          disabled={loading}
          onClick={() => void openAgreement(true)}
          className="rounded-xl bg-accent px-6 py-2.5 text-xs font-bold text-slate-900 shadow hover:bg-accent/95 cursor-pointer disabled:opacity-60 transition"
        >
          Hire Sentry
        </button>
        <button
          type="button"
          disabled={loading}
          onClick={() => void openAgreement(false)}
          className="rounded-xl border border-primary/10 bg-white px-6 py-2.5 text-xs font-bold text-text-dark hover:bg-slate-100 cursor-pointer disabled:opacity-60 transition shadow-sm"
        >
          View agreement
        </button>
        <button
          type="button"
          disabled={loading || status !== "Active"}
          onClick={() => void run("/api/employment/pause")}
          className="rounded-xl border border-primary/10 bg-white px-6 py-2.5 text-xs font-bold text-text-dark hover:bg-slate-100 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed transition shadow-sm"
        >
          Pause
        </button>
        <button
          type="button"
          disabled={loading || status !== "Paused"}
          onClick={() => void run("/api/employment/resume")}
          className="rounded-xl border border-primary/10 bg-white px-6 py-2.5 text-xs font-bold text-text-dark hover:bg-slate-100 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed transition shadow-sm"
        >
          Resume
        </button>
      </div>

      {message ? (
        <div className="rounded-xl border border-accent/25 bg-accent/10 px-4 py-3 text-xs text-slate-900 font-bold">
          {message}
        </div>
      ) : null}
      {error ? (
        <div className="rounded-xl border border-alert/25 bg-alert/10 px-4 py-3 text-xs text-alert font-bold">
          {error}
        </div>
      ) : null}

      {showAgreement ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-text-dark/40 p-4 backdrop-blur-[2px]">
          <div className="surface-card flex max-h-[90vh] w-full max-w-2xl flex-col border border-primary/15 shadow-xl">
            <div className="border-b border-primary/10 px-5 py-4">
              <h2 className="text-lg font-black text-text-dark">{agreementTitle}</h2>
              <p className="mt-1 text-[11px] font-bold uppercase tracking-wider text-muted">
                Version {agreementVersion}
                {hireMode ? " · Required before hire" : " · Read-only view"}
              </p>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-4">
              <pre className="whitespace-pre-wrap font-sans text-xs leading-relaxed text-text-dark">
                {agreementText}
              </pre>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2 border-t border-primary/10 px-5 py-4">
              <button
                type="button"
                disabled={loading}
                onClick={() => setShowAgreement(false)}
                className="rounded-xl border border-primary/15 bg-white px-4 py-2.5 text-xs font-bold text-text-dark hover:bg-slate-50 disabled:opacity-60"
              >
                Close
              </button>
              {hireMode ? (
                <>
                  <button
                    type="button"
                    disabled={loading}
                    onClick={() => void rejectAgreement()}
                    className="rounded-xl border border-alert/30 bg-alert/10 px-4 py-2.5 text-xs font-bold text-alert hover:bg-alert/15 disabled:opacity-60"
                  >
                    Reject — do not hire
                  </button>
                  <button
                    type="button"
                    disabled={loading}
                    onClick={() => void acceptAndHire()}
                    className="rounded-xl bg-primary px-5 py-2.5 text-xs font-bold text-white shadow hover:bg-primary/95 disabled:opacity-60"
                  >
                    {loading ? "Working…" : "Agree & hire Sentry"}
                  </button>
                </>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      <div className="relative overflow-hidden rounded-xl border border-primary/10 bg-white shadow-sm group">
        <div className="relative h-48 w-full overflow-hidden">
          <Image
            src="/sentry_real_work.png"
            alt="Sentry Active Labor & Verification"
            fill
            className="object-cover object-top group-hover:scale-105 transition-transform duration-500"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-white/95" />
        </div>
        <div className="px-5 pb-5 pt-2">
          <h3 className="text-sm font-black text-text-dark">
            Sentry Verification & Labor Logs
          </h3>
          <p className="mt-1 text-xs text-muted font-medium leading-relaxed">
            Proof of Work hashes, Telegram responses, and settlements are recorded
            on-chain under the Employment Agreement accepted at hire.
          </p>
        </div>
      </div>
    </div>
  );
}
