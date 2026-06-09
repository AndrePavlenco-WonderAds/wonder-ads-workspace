"use client";

// Centered login card — username + password + "Sign in". On success
// the API sets the HMAC session cookie and we redirect back to the
// `?next=` path (or `/` when not present). Echoes the brand-gradient
// pill + soft glow that the rest of the workspace shell uses so the
// gate feels like the start of the app rather than a bolt-on.

import { useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { KeyRound, Loader2, LogIn, User } from "lucide-react";

export function LoginForm() {
  const router = useRouter();
  const sp = useSearchParams();
  const next = sp.get("next") ?? "/";
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error ?? "Wrong username or password.");
      }
      // Hard navigation so middleware re-runs against the new cookie
      // and any server components downstream see the auth payload on
      // their first render rather than the next.
      router.push(safeNextPath(next));
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setLoading(false);
    }
  }

  return (
    <section className="animate-fade-up mt-12 flex justify-center sm:mt-20">
      <div className="brand-gradient-border w-full max-w-md rounded-2xl bg-white/[0.035] p-8 backdrop-blur-md">
        <div className="flex flex-col items-center text-center">
          <span
            aria-hidden
            className="brand-gradient-bg flex h-14 w-14 items-center justify-center rounded-2xl shadow-[0_10px_40px_-8px_rgba(120,61,245,0.7)]"
          >
            <LogIn className="h-6 w-6 text-white" strokeWidth={2.25} />
          </span>
          <h1 className="mt-5 text-2xl font-semibold tracking-tight text-white">
            Wonder Ads Workspace
          </h1>
          <p className="mt-2 max-w-xs text-sm text-white/55">
            Sign in to access your department. Sessions stay open for
            48 hours.
          </p>
        </div>

        <form onSubmit={submit} className="mt-6 space-y-3">
          <div className="relative">
            <User className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Username"
              autoFocus
              autoComplete="username"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              className="w-full rounded-xl border border-white/12 bg-white/[0.05] px-4 py-2.5 pl-10 text-sm text-white outline-none transition placeholder:text-white/35 focus:border-white/30"
            />
          </div>
          <div className="relative">
            <KeyRound className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
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
            disabled={loading || !username.trim() || !password}
            className="brand-gradient-bg flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white shadow-[0_8px_28px_-6px_rgba(120,61,245,0.6)] transition hover:opacity-90 disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <LogIn className="h-4 w-4" />
            )}
            Sign in
          </button>
        </form>

        <p className="mt-5 text-center text-[11px] text-white/35">
          Lost your password? Ping Andre directly — passwords are
          regenerated, never recovered.
        </p>
      </div>
    </section>
  );
}

/** Only allow same-origin paths in the `next` redirect target — never
 *  redirect to a fully-qualified URL the user could craft into the
 *  query string. Falls back to `/` on anything fishy. */
function safeNextPath(next: string): string {
  if (!next || typeof next !== "string") return "/";
  if (!next.startsWith("/")) return "/";
  if (next.startsWith("//")) return "/";
  return next;
}
