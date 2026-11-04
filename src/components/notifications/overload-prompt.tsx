"use client";

// Excesso de notificações (v78.70) — o pop-up no meio do ecrã e a faixa no
// painel do sino. As regras estão em `lib/notifications/overload.ts`.
//
//  • AVISO (7–9): aparece uma vez por dia, e outra vez sempre que o número
//    sobe. «Percebi» fecha-o logo. Lembra-se do que já mostrou em
//    localStorage — é só uma cortesia; o nível em si vem do servidor.
//  • EXCESSO (10+, até descer abaixo de 5): aparece em CADA página nova. O
//    «Continuar» só acorda ao fim de 3 segundos — chato de propósito, mas sem
//    trancar ninguém fora do trabalho.
//  • A exceção: quem chega a uma página pelo botão de uma notificação está a
//    fazer exatamente o que o aviso pede. Essa navegação não leva pop-up.
//
// Sai para o <body> por portal pelo mesmo motivo que o painel: o header tem
// `backdrop-blur`, que prende os `position: fixed` à caixa dele.

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { BellRing, CheckCircle2 } from "lucide-react";
import { formatDate } from "@/lib/dates";
import {
  OVERLOAD_CLEAR_BELOW,
  OVERLOAD_EXCESS_AT,
  OVERLOAD_WARN_AT,
  nextOverloadLevel,
  overloadToClear,
  type OverloadLevel,
  type OverloadState,
} from "@/lib/notifications/overload";

const EXCESS_DISMISS_DELAY_S = 3;

// Âmbito do módulo, não do componente: o sino volta a montar a cada página,
// e é precisamente entre páginas que isto tem de se lembrar.
let lastExcessPath: string | null = null;
let skipFor: { path: string; until: number } | null = null;

/** Chamado pelo botão de ação de uma notificação: a página a que leva não
 *  mostra o pop-up — a pessoa já vai a caminho de resolver. */
export function skipOverloadPromptFor(href: string) {
  try {
    const url = new URL(href, window.location.href);
    if (url.origin !== window.location.origin) return;
    skipFor = { path: url.pathname, until: Date.now() + 20_000 };
  } catch {
    /* href estranho — mostra o aviso, que é o comportamento por omissão */
  }
}

function lisbonDay(ms: number): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Lisbon",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(ms);
}

type Ack = { day: string; count: number };

function ackKey(username: string): string {
  return `wa:notif-overload-ack:${username}`;
}

function readAck(username: string): Ack | null {
  try {
    const raw = window.localStorage.getItem(ackKey(username));
    if (!raw) return null;
    const v = JSON.parse(raw) as Partial<Ack>;
    return typeof v.day === "string" && typeof v.count === "number"
      ? { day: v.day, count: v.count }
      : null;
  } catch {
    return null;
  }
}

function writeAck(username: string, ack: Ack) {
  try {
    window.localStorage.setItem(ackKey(username), JSON.stringify(ack));
  } catch {
    /* sem storage, o aviso volta na próxima página — aceitável */
  }
}

function plural(n: number, one: string, many: string): string {
  return n === 1 ? one : many;
}

export function OverloadPrompt({
  state,
  username,
  onResolve,
}: {
  state: OverloadState;
  username: string;
  /** Abre o painel do sino no separador «As minhas». */
  onResolve: () => void;
}) {
  const pathname = usePathname();
  const reduce = useReducedMotion();
  const [shown, setShown] = useState<null | "warn" | "excess">(null);
  const [wait, setWait] = useState(0);
  const [mounted, setMounted] = useState(false);
  const primaryRef = useRef<HTMLButtonElement>(null);
  useEffect(() => setMounted(true), []);

  // Decidir se esta página leva aviso.
  useEffect(() => {
    if (state.level === "excess") {
      if (lastExcessPath === pathname) return;
      lastExcessPath = pathname;
      const skip = skipFor;
      skipFor = null;
      if (skip && skip.path === pathname && Date.now() < skip.until) return;
      setShown("excess");
      return;
    }
    lastExcessPath = null;
    if (state.level === "warn") {
      const ack = readAck(username);
      if (ack && ack.day === lisbonDay(Date.now()) && ack.count >= state.count) {
        return;
      }
      setShown("warn");
    }
  }, [pathname, state.level, state.count, username]);

  // O «Continuar» do excesso acorda ao fim de 3 s.
  useEffect(() => {
    if (shown !== "excess") return;
    setWait(EXCESS_DISMISS_DELAY_S);
    const t = window.setInterval(() => {
      setWait((w) => {
        if (w <= 1) {
          window.clearInterval(t);
          return 0;
        }
        return w - 1;
      });
    }, 1000);
    return () => window.clearInterval(t);
  }, [shown]);

  const close = useCallback(() => {
    if (shown === "warn") {
      writeAck(username, { day: lisbonDay(Date.now()), count: state.count });
    }
    setShown(null);
  }, [shown, state.count, username]);

  const canDismiss = shown === "warn" || wait === 0;

  // Escape fecha (quando já se pode), o body não rola por trás, e o foco
  // vai para «Resolver agora».
  useEffect(() => {
    if (!shown) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && canDismiss) close();
    };
    window.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const f = window.setTimeout(() => primaryRef.current?.focus(), 60);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
      window.clearTimeout(f);
    };
  }, [shown, canDismiss, close]);

  if (!mounted) return null;

  const excess = shown === "excess";
  const count = state.count;
  const toClear = overloadToClear(state);
  const missing = Math.max(0, OVERLOAD_EXCESS_AT - count);
  const sinceToday =
    state.since !== null && lisbonDay(state.since) === lisbonDay(Date.now());

  return createPortal(
    <AnimatePresence>
      {shown && (
        <motion.div
          key="overload"
          className="fixed inset-0 z-[70] flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduce ? 0 : 0.18 }}
        >
          <div
            aria-hidden
            onClick={canDismiss ? close : undefined}
            className="absolute inset-0 bg-black/70 backdrop-blur-[3px]"
          />
          <motion.div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="overload-title"
            aria-describedby="overload-body"
            initial={reduce ? false : { opacity: 0, y: 18, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
            className="relative w-full max-w-[480px] overflow-hidden rounded-[22px] border border-white/10 bg-[color:var(--background)] shadow-[0_40px_120px_-30px_rgba(0,0,0,0.95)]"
          >
            <span
              aria-hidden
              className={`absolute inset-x-0 top-0 h-[3px] ${excess ? "bg-[#e11d48]" : "bg-amber-400"}`}
            />

            <div className="px-6 pb-6 pt-7 sm:px-8 sm:pb-7 sm:pt-8">
              <div className="flex items-center gap-2.5">
                <span
                  aria-hidden
                  className={`flex h-9 w-9 items-center justify-center rounded-xl border ${
                    excess
                      ? "border-rose-400/35 bg-rose-500/[0.12] text-rose-200"
                      : "border-amber-300/35 bg-amber-400/[0.1] text-amber-200"
                  }`}
                >
                  <BellRing className="h-[18px] w-[18px]" />
                </span>
                <p
                  className={`text-[13px] font-semibold ${excess ? "text-rose-200" : "text-amber-200"}`}
                >
                  {excess ? "Excesso de notificações" : "Perto do limite"}
                </p>
              </div>

              <h2
                id="overload-title"
                className="mt-5 text-[26px] font-semibold leading-[1.15] tracking-tight text-white sm:text-[28px]"
              >
                Tens <span className="tabular">{count}</span>{" "}
                {plural(count, "notificação", "notificações")} por resolver
              </h2>

              <OverloadMeter count={count} className="mt-6" animate={!reduce} />

              <p
                id="overload-body"
                className="mt-6 text-[14px] leading-relaxed text-white/65"
              >
                {excess ? (
                  <>
                    Estás em excesso{" "}
                    {state.since === null
                      ? ""
                      : sinceToday
                        ? "desde hoje"
                        : `desde ${formatDate(state.since)}`}
                    . Este aviso aparece em cada página que abrires até ficares
                    com menos de {OVERLOAD_CLEAR_BELOW}.{" "}
                    <span className="font-semibold text-white">
                      Resolve mais {toClear} para o desligar.
                    </span>
                  </>
                ) : (
                  <>
                    <span className="font-semibold text-white">
                      {missing === 1
                        ? "Falta 1 para o excesso."
                        : `Faltam ${missing} para o excesso.`}
                    </span>{" "}
                    Aos {OVERLOAD_EXCESS_AT}, este aviso passa a aparecer em
                    cada página que abrires, até ficares com menos de{" "}
                    {OVERLOAD_CLEAR_BELOW}.
                  </>
                )}
              </p>

              <div className="mt-7 flex flex-col-reverse gap-2.5 sm:flex-row">
                <button
                  type="button"
                  onClick={close}
                  disabled={!canDismiss}
                  className="tabular inline-flex h-11 items-center justify-center rounded-xl border border-white/12 px-4 text-[13.5px] font-medium text-white/70 transition hover:border-white/25 hover:text-white disabled:cursor-not-allowed disabled:opacity-45 sm:flex-1"
                >
                  {excess
                    ? wait > 0
                      ? `Continuar daqui a ${wait} s`
                      : "Continuar para a página"
                    : "Percebi"}
                </button>
                <button
                  ref={primaryRef}
                  type="button"
                  onClick={() => {
                    setShown(null);
                    if (!excess) {
                      writeAck(username, {
                        day: lisbonDay(Date.now()),
                        count: state.count,
                      });
                    }
                    onResolve();
                  }}
                  className="brand-gradient-bg inline-flex h-11 items-center justify-center rounded-xl px-5 text-[13.5px] font-semibold text-white transition hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/70 sm:flex-[1.3]"
                >
                  Resolver agora
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

/** Uma barra por notificação, pintada pela zona em que cai: livre (1–4),
 *  aviso (7–9), excesso (10+). As vazias mostram quanto falta. */
function OverloadMeter({
  count,
  className = "",
  animate,
}: {
  count: number;
  className?: string;
  animate: boolean;
}) {
  const slots = Math.max(OVERLOAD_EXCESS_AT + 2, Math.min(count, 16));
  const overflow = Math.max(0, count - slots);
  const zone = (i: number) =>
    i >= OVERLOAD_EXCESS_AT
      ? "bg-[#f43f5e]"
      : i >= OVERLOAD_WARN_AT
        ? "bg-amber-400"
        : i >= OVERLOAD_CLEAR_BELOW
          ? "bg-white/45"
          : "bg-emerald-400";

  return (
    <div className={className} aria-hidden>
      <div className="flex items-center gap-2">
        <div
          className="grid flex-1 gap-[3px]"
          style={{ gridTemplateColumns: `repeat(${slots}, minmax(0, 1fr))` }}
        >
          {Array.from({ length: slots }, (_, k) => {
            const i = k + 1;
            const filled = i <= count;
            return filled ? (
              <motion.span
                key={i}
                className={`h-3 rounded-[3px] ${zone(i)}`}
                initial={animate ? { opacity: 0, scaleY: 0.4 } : false}
                animate={{ opacity: 1, scaleY: 1 }}
                transition={{ delay: animate ? 0.15 + k * 0.04 : 0, duration: 0.22 }}
              />
            ) : (
              <span key={i} className="h-3 rounded-[3px] bg-white/[0.07]" />
            );
          })}
        </div>
        {overflow > 0 && (
          <span className="tabular shrink-0 text-[12px] font-semibold text-rose-200">
            +{overflow}
          </span>
        )}
      </div>
      <div
        className="mt-2 grid gap-[3px] text-[11px] font-medium"
        style={{
          gridTemplateColumns: `repeat(${slots}, minmax(0, 1fr))`,
          marginRight: overflow > 0 ? "2.25rem" : undefined,
        }}
      >
        <span
          className="whitespace-nowrap text-emerald-300/80"
          style={{ gridColumn: `1 / span ${OVERLOAD_CLEAR_BELOW - 1}` }}
        >
          Livre
        </span>
        <span
          className="whitespace-nowrap text-amber-200/85"
          style={{
            gridColumn: `${OVERLOAD_WARN_AT} / span ${OVERLOAD_EXCESS_AT - OVERLOAD_WARN_AT}`,
          }}
        >
          Aviso
        </span>
        <span
          className="whitespace-nowrap text-rose-200/90"
          style={{ gridColumn: `${OVERLOAD_EXCESS_AT} / span ${slots - OVERLOAD_EXCESS_AT + 1}` }}
        >
          Excesso
        </span>
      </div>
    </div>
  );
}

/** A faixa no topo do painel do sino, para quem está em aviso ou excesso.
 *  Conta com o número AO VIVO do painel: cada «Concluído» desce-a já, e
 *  quando a pessoa sai do excesso diz-lho ali mesmo. */
export function OverloadBanner({
  serverLevel,
  liveCount,
}: {
  serverLevel: OverloadLevel;
  liveCount: number;
}) {
  if (serverLevel === "ok") return null;
  const level = nextOverloadLevel(liveCount, serverLevel);

  if (level === "ok") {
    return (
      <div className="flex items-start gap-2.5 border-b border-emerald-400/20 bg-emerald-500/[0.08] px-5 py-3 text-[12.5px] leading-relaxed text-emerald-100">
        <CheckCircle2 className="mt-[1px] h-4 w-4 shrink-0 text-emerald-300" />
        <span>
          {serverLevel === "excess"
            ? "Já não estás em excesso. O aviso deixa de aparecer nas páginas."
            : "Abaixo do limite. Bom trabalho."}
        </span>
      </div>
    );
  }

  const toClear = overloadToClear({ level, count: liveCount, since: null });
  return (
    <div
      className={`flex items-start gap-2.5 border-b px-5 py-3 text-[12.5px] leading-relaxed ${
        level === "excess"
          ? "border-rose-400/20 bg-rose-500/[0.08] text-rose-100"
          : "border-amber-300/20 bg-amber-400/[0.07] text-amber-100"
      }`}
    >
      <BellRing
        className={`mt-[1px] h-4 w-4 shrink-0 ${level === "excess" ? "text-rose-300" : "text-amber-300"}`}
      />
      <span>
        {level === "excess" ? (
          <>
            <span className="font-semibold">Em excesso.</span> Resolve mais{" "}
            {toClear} e o aviso deixa de aparecer em cada página.
          </>
        ) : (
          <>
            <span className="font-semibold">Perto do limite.</span>{" "}
            {OVERLOAD_EXCESS_AT - liveCount === 1
              ? "Falta 1"
              : `Faltam ${OVERLOAD_EXCESS_AT - liveCount}`}{" "}
            para o excesso; resolve {toClear}{" "}
            {plural(toClear, "notificação", "notificações")} e o aviso para.
          </>
        )}
      </span>
    </div>
  );
}
