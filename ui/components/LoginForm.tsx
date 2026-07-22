"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Login failed");
      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <label className="block text-xs font-bold uppercase tracking-wider text-muted">
        Corporate Email Address
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mt-2.5 w-full rounded-xl border border-primary/20 bg-white px-4 py-3 text-text-dark outline-none focus:border-primary transition text-sm font-normal placeholder:text-muted/60"
          placeholder="you@company.com"
        />
      </label>
      {error && (
        <p className="text-xs text-alert font-bold bg-alert/10 border border-alert/20 rounded-lg px-3 py-2">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-full bg-primary px-6 py-3.5 text-xs font-bold text-white shadow hover:bg-primary/95 cursor-pointer disabled:opacity-60 transition"
      >
        {loading ? "Verifying Credentials…" : "Establish Connection"}
      </button>
    </form>
  );
}

