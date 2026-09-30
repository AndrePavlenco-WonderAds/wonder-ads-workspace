"use client";

// O portão da plataforma: logo da marca, uma password, e a entrada.

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, useAnimationControls } from "motion/react";
import { ArrowRight, Check, Eye, EyeOff, Loader2, Lock } from "lucide-react";
import { HairStrands, MadeBy, StarRow } from "./hub-ui";

export function HubGate({ slug, brand, logo }: { slug: string; brand: string; logo: string | null }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [state, setState] = useState<"idle" | "loading" | "ok" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const shake = useAnimationControls();
  const inputRef = useRef<HTMLInputElement>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!password || state === "loading" || state === "ok") return;
    setState("loading");
    setError(null);
    try {
      const res = await fetch(`/api/reviews-hub/${slug}/auth`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error ?? "Não foi possível entrar.");
      }
      setState("ok");
      setTimeout(() => router.refresh(), 650);
    } catch (err) {
      setState("error");
      setError(err instanceof Error ? err.message : "Não foi possível entrar.");
      void shake.start({ x: [0, -12, 10, -8, 6, -3, 0], transition: { duration: 0.5 } });
      inputRef.current?.select();
    }
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden px-5 py-16">
      <HairStrands />
      <motion.div
        className="relative w-full max-w-[420px]"
        initial={{ opacity: 0, y: 24, scale: 0.98 }}
        animate={state === "ok" ? { opacity: 0, scale: 1.04, filter: "blur(8px)" } : { opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: state === "ok" ? 0.55 : 0.8, ease: [0.16, 1, 0.3, 1], delay: state === "ok" ? 0.15 : 0 }}
      >
        <div className="flex flex-col items-center text-center">
          <motion.div
            className="relative"
            initial={{ scale: 0.6, opacity: 0, rotate: -6 }}
            animate={{ scale: 1, opacity: 1, rotate: 0 }}
            transition={{ type: "spring", stiffness: 180, damping: 16, delay: 0.1 }}
          >
            <div className="absolute -inset-6 rounded-[36px] bg-[radial-gradient(closest-side,rgba(167,139,250,0.35),transparent)] blur-xl" />
            <div className="relative flex h-28 w-40 items-center justify-center rounded-3xl bg-white p-5 shadow-[0_20px_60px_-20px_rgba(120,61,245,0.6)]">
              {logo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logo} alt={brand} className="max-h-full max-w-full object-contain" />
              ) : (
                <span className="text-lg font-semibold text-black">{brand}</span>
              )}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35, duration: 0.6 }}
            className="mt-9"
          >
            <span className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/[0.04] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-white/60">
              <StarRow value={5} size={10} animateIn gap={1} />
              Plataforma de reviews
            </span>
            <h1 className="mt-4 text-[34px] font-semibold leading-tight tracking-tight">
              <span className="brand-gradient-text">Respostas a Reviews</span>
            </h1>
            <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-white/55">
              Todas as reviews Google dos salões {brand} num só sítio — com respostas escritas à medida
              de cada avaliação.
            </p>
          </motion.div>

          <motion.div
            className="mt-8 w-full"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.6 }}
          >
          <motion.form onSubmit={submit} animate={shake} className="w-full">
            <label htmlFor="rhub-password" className="sr-only">
              Password
            </label>
            <div
              className={`group relative flex items-center rounded-2xl border bg-white/[0.04] transition-all duration-300 focus-within:bg-white/[0.06] ${
                state === "error"
                  ? "border-rose-400/60 shadow-[0_0_0_4px_rgba(251,113,133,0.12)]"
                  : "border-white/12 focus-within:border-violet-400/60 focus-within:shadow-[0_0_0_4px_rgba(139,92,246,0.16)]"
              }`}
            >
              <Lock className="ml-4 h-4 w-4 shrink-0 text-white/40 transition group-focus-within:text-violet-300" />
              <input
                ref={inputRef}
                id="rhub-password"
                type={show ? "text" : "password"}
                autoComplete="current-password"
                autoFocus
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (state === "error") setState("idle");
                }}
                placeholder="Password"
                className="h-14 w-full bg-transparent px-3 text-[15px] text-white outline-none placeholder:text-white/30"
              />
              <button
                type="button"
                onClick={() => setShow((v) => !v)}
                className="mr-2 rounded-lg p-2 text-white/40 transition hover:bg-white/5 hover:text-white/80"
                aria-label={show ? "Esconder password" : "Mostrar password"}
              >
                {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>

            <AnimatePresence>
              {error && (
                <motion.p
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mt-3 text-left text-sm text-rose-300"
                  role="alert"
                >
                  {error}
                </motion.p>
              )}
            </AnimatePresence>

            <motion.button
              type="submit"
              disabled={!password || state === "loading" || state === "ok"}
              whileHover={{ scale: 1.015 }}
              whileTap={{ scale: 0.98 }}
              className="relative mt-4 flex h-14 w-full items-center justify-center gap-2 overflow-hidden rounded-2xl text-[15px] font-semibold text-white shadow-[0_18px_40px_-16px_rgba(120,61,245,0.8)] transition disabled:cursor-not-allowed disabled:opacity-60"
              style={{
                background:
                  state === "ok"
                    ? "linear-gradient(135deg,#10b981,#34d399)"
                    : "linear-gradient(135deg,#343ed7 0%,#783df5 55%,#c535c9 100%)",
              }}
            >
              <AnimatePresence mode="wait" initial={false}>
                {state === "loading" ? (
                  <motion.span key="l" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                    <Loader2 className="h-5 w-5 animate-spin" />
                  </motion.span>
                ) : state === "ok" ? (
                  <motion.span
                    key="ok"
                    initial={{ scale: 0, rotate: -90 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ type: "spring", stiffness: 400, damping: 15 }}
                    className="flex items-center gap-2"
                  >
                    <Check className="h-5 w-5" /> Bem-vindo
                  </motion.span>
                ) : (
                  <motion.span
                    key="go"
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    className="flex items-center gap-2"
                  >
                    Entrar <ArrowRight className="h-4 w-4" />
                  </motion.span>
                )}
              </AnimatePresence>
            </motion.button>
          </motion.form>
          </motion.div>

          <MadeBy className="mt-10" />
        </div>
      </motion.div>
    </main>
  );
}
