"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Lock, Loader2, ShieldCheck } from "lucide-react";

export function AdminGate() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin-auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error ?? "Incorrect password");
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setLoading(false);
    }
  }

  return (
    <section className="animate-fade-up mt-16 flex justify-center sm:mt-24">
      <div className="brand-gradient-border w-full max-w-md rounded-2xl bg-white/[0.035] p-8 backdrop-blur-md">
        <div className="flex flex-col items-center text-center">
          <span
            aria-hidden
            className="brand-gradient-bg flex h-14 w-14 items-center justify-center rounded-2xl shadow-[0_10px_40px_-8px_rgba(120,61,245,0.7)]"
          >
            <ShieldCheck className="h-6 w-6 text-white" strokeWidth={2.25} />
          </span>
          <h1 className="mt-5 text-2xl font-semibold tracking-tight text-white">
            Admin Control Panel
          </h1>
          <p className="mt-2 text-sm text-white/55">
            Restricted area. Enter the superadmin password to manage clients
            across every department.
          </p>
        </div>

        <form onSubmit={submit} className="mt-6 space-y-3">
          <div className="relative">
            <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              autoFocus
              autoComplete="current-password"
              className="w-full rounded-xl border border-white/12 bg-white/[0.05] px-4 py-2.5 pl-10 text-sm text-white outline-none transition placeholder:text-white/35 focus:border-white/30"
            />
          </div>
          {error && (
            <p className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-300">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={loading || !password}
            className="brand-gradient-bg flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white shadow-[0_8px_28px_-6px_rgba(120,61,245,0.6)] transition hover:opacity-90 disabled:opacity-50"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            Unlock
          </button>
        </form>

        <p className="mt-5 text-center text-[11px] text-white/35">
          Session expires after 7 days of inactivity.
        </p>
      </div>
    </section>
  );
}
