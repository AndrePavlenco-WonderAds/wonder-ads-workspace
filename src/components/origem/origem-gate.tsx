"use client";

// O portão da Origem de Pacientes (v78.69; v78.76 em todos os clientes, com
// a letra e o logótipo de cada um): o logótipo do cliente e um PIN
// de 6 dígitos num teclado próprio — no tablet da receção não se abre o
// teclado do sistema por cima do ecrã. Um teclado físico também funciona.
// Entra sozinho ao 6.º dígito; o aparelho fica com acesso 180 dias.

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, useAnimationControls } from "motion/react";
import { Delete, Loader2 } from "lucide-react";
import { ClientLogo } from "./origem-ui";
import { WonderAdsSignature } from "./wonder-ads-signature";

const LENGTH = 6;

export function OrigemGate({
  slug,
  brand,
  logo,
  peopleMany,
  deskOf,
}: {
  slug: string;
  brand: string;
  logo: string | null;
  peopleMany: string;
  /** «da receção» / «da loja» / «da equipa». */
  deskOf: string;
}) {
  const router = useRouter();
  const [pin, setPin] = useState("");
  const [state, setState] = useState<"idle" | "loading" | "ok" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const shake = useAnimationControls();
  const busy = useRef(false);
  const pinRef = useRef("");

  const submit = useCallback(
    async (value: string) => {
      if (busy.current) return;
      busy.current = true;
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
        setTimeout(() => router.refresh(), 700);
      } catch (err) {
        busy.current = false;
        setState("error");
        setError(err instanceof Error ? err.message : "Não foi possível entrar.");
        pinRef.current = "";
        setPin("");
        void shake.start({ x: [0, -14, 12, -8, 6, -2, 0], transition: { duration: 0.45 } });
      }
    },
    [router, shake, slug],
  );

  const press = useCallback(
    (key: string) => {
      if (busy.current) return;
      const cur = pinRef.current;
      const next = key === "del" ? cur.slice(0, -1) : cur.length >= LENGTH ? cur : cur + key;
      pinRef.current = next;
      setPin(next);
      if (key !== "del") setState((s) => (s === "error" ? "idle" : s));
      if (key !== "del" && next.length === LENGTH) void submit(next);
    },
    [submit],
  );

  // Teclado físico (ou o do computador da equipa).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (/^\d$/.test(e.key)) press(e.key);
      else if (e.key === "Backspace") press("del");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [press]);

  const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "del"];

  return (
    <main className="flex min-h-[100dvh] flex-col px-5 pb-[max(20px,env(safe-area-inset-bottom))] pt-[max(20px,env(safe-area-inset-top))] sm:px-10">
      <motion.div
        className="mx-auto grid w-full max-w-5xl flex-1 items-center gap-10 py-8 lg:grid-cols-[minmax(0,1fr)_400px] lg:gap-20"
        animate={state === "ok" ? { opacity: 0, y: -12 } : { opacity: 1, y: 0 }}
        transition={{ duration: 0.45, delay: state === "ok" ? 0.25 : 0, ease: [0.16, 1, 0.3, 1] }}
      >
        <div className="text-center lg:text-left">
          <ClientLogo logo={logo} brand={brand} size="gate" className="mx-auto lg:mx-0" />
          <h1 className="o-display mt-10 text-[36px] leading-[1.02] tracking-[-0.035em] sm:mt-14 sm:text-[56px]">
            Origem dos
            <br className="hidden lg:block" /> {peopleMany}
          </h1>
          <p className="mx-auto mt-4 max-w-[34ch] text-[17px] leading-relaxed text-[var(--o-muted)] lg:mx-0">
            Introduza o PIN {deskOf}. Este aparelho fica com acesso durante 6 meses.
          </p>
        </div>

        <div className="mx-auto w-full max-w-[400px] rounded-[calc(32px*var(--o-rs))] bg-white p-6 shadow-[0_1px_0_var(--o-line),0_30px_60px_-40px_rgba(var(--o-ink-rgb),0.55)] ring-1 ring-[var(--o-line)] sm:p-8">
          <motion.div animate={shake} className="flex justify-center gap-3.5" role="status" aria-live="polite" aria-label={`${pin.length} de ${LENGTH} dígitos`}>
            {Array.from({ length: LENGTH }, (_, i) => {
              const filled = i < pin.length;
              return (
                <span
                  key={i}
                  className="h-4 w-4 rounded-full border-2 transition-all duration-150"
                  style={{
                    borderColor: state === "error" ? "#D2455A" : filled ? "var(--o-deep)" : "var(--o-line)",
                    background: state === "ok" ? "var(--o-accent)" : filled ? "var(--o-deep)" : "transparent",
                    transform: filled ? "scale(1.08)" : "scale(1)",
                  }}
                />
              );
            })}
          </motion.div>

          <div className="mt-4 flex h-6 items-center justify-center text-[15px]">
            {state === "loading" && <Loader2 className="h-5 w-5 animate-spin text-[var(--o-muted)]" aria-label="A verificar" />}
            {state === "ok" && <span className="font-bold text-[var(--o-deep)]">PIN certo. A abrir…</span>}
            {state === "error" && error && (
              <span className="font-semibold text-[#B8364A]" role="alert">
                {error}
              </span>
            )}
          </div>

          <div className="mt-5 grid grid-cols-3 gap-3">
            {keys.map((k, i) =>
              k === "" ? (
                <span key={i} />
              ) : (
                <button
                  key={i}
                  type="button"
                  onClick={() => press(k)}
                  aria-label={k === "del" ? "Apagar" : k}
                  className={`flex h-[68px] touch-manipulation select-none items-center justify-center rounded-[calc(20px*var(--o-rs))] text-[28px] font-bold transition active:scale-[0.96] sm:h-[72px] ${
                    k === "del"
                      ? "text-[var(--o-muted)] hover:bg-[var(--o-paper)] hover:text-[var(--o-ink)]"
                      : "bg-[var(--o-paper)] hover:bg-[var(--o-line)] active:bg-[var(--o-line)]"
                  }`}
                >
                  {k === "del" ? <Delete className="h-7 w-7" /> : k}
                </button>
              ),
            )}
          </div>
        </div>
      </motion.div>

      <footer className="flex justify-center lg:justify-start">
        <WonderAdsSignature />
      </footer>
    </main>
  );
}
