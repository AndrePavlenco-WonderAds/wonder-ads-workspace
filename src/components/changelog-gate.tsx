"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Lock, Loader2 } from "lucide-react";

export function ChangelogGate() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/changelog-auth", {
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
            <Lock className="h-6 w-6 text-white" strokeWidth={2.25} />
          </span>
          <h1 className="mt-5 text-2xl font-semibold tracking-tight text-white">
            Superadmin password required
          </h1>
          <p className="mt-2 text-sm text-white/55">
            The changelog is restricted. Enter the superadmin password to
            continue.
          </p>
        </div>

        <form onSubmit={submit} className="mt-6 space-y-3">
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            autoFocus
            className="w-full rounded-xl border border-white/12 bg-white/[0.05] px-4 py-2.5 text-sm text-white outline-none transition placeholder:text-white/35 focus:border-white/30"
          />
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
      </div>
    </section>
  );
}
