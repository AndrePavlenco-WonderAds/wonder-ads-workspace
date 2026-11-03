"use client";

// O portão da Origem de Pacientes: o logótipo do cliente e um PIN de 6
// dígitos. Entra sozinho ao 6.º dígito; o aparelho fica com acesso 180 dias.

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, useAnimationControls } from "motion/react";
import { Check, Loader2, Lock } from "lucide-react";
import { BrandBackdrop, LogoPlate, MadeBy, WA_GRADIENT } from "./origem-ui";

export function OrigemGate({
  slug,
  brand,
  logo,
  peopleMany,
}: {
  slug: string;
  brand: string;
  logo: string | null;
  peopleMany: string;
}) {
  const router = useRouter();
  const [pin, setPin] = useState("");
  const [state, setState] = useState<"idle" | "loading" | "ok" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const shake = useAnimationControls();
  const inputRef = useRef<HTMLInputElement>(null);

  async function submit(value: string) {
    if (value.length !== 6 || state === "loading" || state === "ok") return;
    setState("loading");
    setError(null);
    try {
      const res = await fetch(`/api/origem/${slug}/auth`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin: value }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error ?? "Não foi possível entrar.");
      }
      setState("ok");
      setTimeout(() => router.refresh(), 600);
    } catch (err) {
      setState("error");
      setError(err instanceof Error ? err.message : "Não foi possível entrar.");
      setPin("");
      void shake.start({ x: [0, -12, 10, -8, 6, -3, 0], transition: { duration: 0.5 } });
      inputRef.current?.focus();
    }
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center px-4 py-16 text-white">
      <BrandBackdrop />
      <motion.div
        className="w-full max-w-[420px]"
        initial={{ opacity: 0, y: 24 }}
        animate={state === "ok" ? { opacity: 0, scale: 1.03, filter: "blur(8px)" } : { opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1], delay: state === "ok" ? 0.15 : 0 }}
      >
        <div className="flex flex-col items-center text-center">
          <motion.div initial={{ scale: 0.7, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", stiffness: 180, damping: 16, delay: 0.1 }}>
            <LogoPlate logo={logo} brand={brand} size="lg" />
          </motion.div>

          <span className="mt-9 inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/[0.04] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-white/60">
            <Lock className="h-3 w-3" /> Acesso da receção
          </span>
          <h1 className="mt-4 text-[32px] font-semibold leading-tight tracking-tight">
            <span className="brand-gradient-text">Origem dos {peopleMany}</span>
          </h1>
          <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-white/55">
            Introduza o PIN de 6 dígitos. Este aparelho fica com acesso durante 6 meses.
          </p>

          <motion.div animate={shake} className="mt-8 w-full">
            <label htmlFor="origem-pin" className="relative block cursor-text">
              <span className="sr-only">PIN</span>
              <input
                ref={inputRef}
                id="origem-pin"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="\d*"
                maxLength={6}
                autoFocus
                value={pin}
                onChange={(e) => {
                  const v = e.target.value.replace(/\D/g, "").slice(0, 6);
                  setPin(v);
                  if (state === "error") setState("idle");
                  if (v.length === 6) void submit(v);
                }}
                className="absolute inset-0 h-full w-full cursor-text opacity-0"
              />
              <div className="flex justify-center gap-2.5" aria-hidden>
                {Array.from({ length: 6 }, (_, i) => {
                  const filled = i < pin.length;
                  const active = i === pin.length && state !== "loading" && state !== "ok";
                  return (
                    <div
                      key={i}
                      className={`flex h-16 w-12 items-center justify-center rounded-2xl border text-2xl font-semibold transition-all duration-200 sm:w-14 ${
                        state === "error"
                          ? "border-rose-400/60 bg-rose-500/[0.06]"
                          : state === "ok"
                            ? "border-emerald-400/60 bg-emerald-500/10"
                            : active
                              ? "border-[#6EC1D6]/70 bg-white/[0.06] shadow-[0_0_0_4px_rgba(110,193,214,0.14)]"
                              : "border-white/12 bg-white/[0.04]"
                      }`}
                    >
                      <AnimatePresence>
                        {filled && (
                          <motion.span
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            exit={{ scale: 0 }}
                            className="h-3 w-3 rounded-full"
                            style={{ background: WA_GRADIENT }}
                          />
                        )}
                      </AnimatePresence>
                    </div>
                  );
                })}
              </div>
            </label>

            <div className="mt-5 flex h-6 items-center justify-center text-sm">
              {state === "loading" && <Loader2 className="h-5 w-5 animate-spin text-white/60" />}
              {state === "ok" && (
                <span className="inline-flex items-center gap-1.5 font-semibold text-emerald-300">
                  <Check className="h-4 w-4" /> Bem-vindo
                </span>
              )}
              {state === "error" && error && (
                <span className="text-rose-300" role="alert">
                  {error}
                </span>
              )}
            </div>
          </motion.div>

          <MadeBy className="mt-10" />
        </div>
      </motion.div>
    </main>
  );
}
