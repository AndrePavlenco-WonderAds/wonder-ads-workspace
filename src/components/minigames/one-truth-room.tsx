"use client";

// A sala de «Uma verdade, duas mentiras» — junta os ecrãs de cada fase
// (lobby → rondas → pódio), a barra do anfitrião e o ecrã «Ronda N» que
// aparece entre rondas. Todo o estado vem de useGame (polling do servidor).

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import {
  ArrowRight,
  Check,
  Copy,
  Eye,
  Flag,
  Loader2,
  Play,
  Trophy,
  X,
} from "lucide-react";
import { MINIGAME_LABEL, type GameView } from "@/lib/minigames/types";
import { OneTruthLobby } from "./one-truth-lobby";
import { OneTruthRound } from "./one-truth-round";
import { OneTruthFinal } from "./one-truth-final";
import { Avatar, AvatarStack, FannedCards, firstName } from "./ui";
import { useGame } from "./use-game";

type Act = (action: string, payload?: Record<string, unknown>) => Promise<boolean>;

export function OneTruthRoom({ initial }: { initial: GameView }) {
  const { view, gone, error, clearError, busy, act, offset } = useGame(initial.id, initial);
  const intro = useRoundIntro(view);

  useEffect(() => {
    if (!error) return;
    const t = setTimeout(clearError, 4500);
    return () => clearTimeout(t);
  }, [error, clearError]);

  if (gone) {
    return (
      <EmptyState title="Esta sala já não existe" body="Pode ter expirado ou sido apagada. Volta aos Mini-games para ver se há outra aberta." />
    );
  }

  const live = view.phase === "guessing" || view.phase === "reveal";
  const showJoin = !view.me.joined && (view.phase === "lobby" || live);

  return (
    <div className={view.me.canHost && view.phase !== "final" && view.phase !== "cancelled" ? "pb-28" : ""}>
      <RoomHeader view={view} />

      <div className="mt-8">
        {view.phase === "cancelled" ? (
          <EmptyState title="Sala cancelada" body={`${firstName(view.hostName)} fechou esta sala antes do fim. Fica para a próxima!`} />
        ) : view.phase === "final" ? (
          <OneTruthFinal view={view} />
        ) : showJoin && view.phase === "lobby" ? (
          <JoinCard view={view} act={act} busy={busy} />
        ) : view.phase === "lobby" ? (
          <OneTruthLobby view={view} act={act} busy={busy} />
        ) : live && view.current ? (
          <>
            {showJoin && <JoinStrip act={act} busy={busy} />}
            <OneTruthRound view={view} act={act} busy={busy} offset={offset} />
          </>
        ) : null}
      </div>

      {view.me.canHost && <HostBar view={view} act={act} busy={busy} />}

      <AnimatePresence>{intro && <RoundIntro key={intro.key} view={view} />}</AnimatePresence>

      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed inset-x-0 bottom-24 z-[70] mx-auto flex w-fit max-w-[92vw] items-center gap-3 rounded-2xl border border-rose-400/30 bg-[#1a0d14]/95 px-4 py-3 text-sm text-rose-100 shadow-2xl backdrop-blur"
            role="alert"
          >
            {error}
            <button type="button" onClick={clearError} className="text-rose-300/70 hover:text-rose-100" aria-label="Fechar">
              <X className="h-4 w-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/** Mostra o ecrã «Ronda N» quando uma ronda nova começa (não ao abrir a página). */
function useRoundIntro(view: GameView) {
  const [intro, setIntro] = useState<{ key: string } | null>(null);
  const seen = useRef<string | null>(
    view.phase === "guessing" || view.phase === "reveal" ? `${view.current?.index}` : null,
  );
  const index = view.current?.index ?? null;
  useEffect(() => {
    if (view.phase !== "guessing" || index === null) return;
    const key = `${index}`;
    if (seen.current === key) return;
    seen.current = key;
    setIntro({ key });
  }, [view.phase, index]);
  // O temporizador de saída vive à parte: o efeito de cima corre a cada
  // poll, e um cleanup ali cancelava a saída e o ecrã ficava preso.
  useEffect(() => {
    if (!intro) return;
    const t = setTimeout(() => setIntro(null), 2300);
    return () => clearTimeout(t);
  }, [intro]);
  return intro;
}

function RoundIntro({ view }: { view: GameView }) {
  const cur = view.current;
  if (!cur) return null;
  const mine = cur.author.username === view.me.username;
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.35 } }}
      className="fixed inset-0 z-[65] flex flex-col items-center justify-center bg-[#07080d]/92 backdrop-blur-md"
    >
      <motion.p
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-xs font-semibold uppercase tracking-[0.3em] text-white/45"
      >
        Ronda {cur.index + 1} de {view.totalRounds}
      </motion.p>
      <motion.div
        initial={{ scale: 0.3, opacity: 0, rotate: -12 }}
        animate={{ scale: 1, opacity: 1, rotate: 0 }}
        transition={{ type: "spring", stiffness: 220, damping: 14, delay: 0.1 }}
        className="mt-6"
      >
        <Avatar name={cur.author.name} avatar={cur.author.avatar} size={132} ring />
      </motion.div>
      <motion.h2
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35 }}
        className="mt-6 px-6 text-center text-3xl font-semibold text-white sm:text-5xl"
      >
        {mine ? (
          <>É a tua vez 🤫</>
        ) : (
          <>
            As frases de <span className="brand-gradient-text">{firstName(cur.author.name)}</span>
          </>
        )}
      </motion.h2>
      <motion.div
        initial={{ scaleX: 0 }}
        animate={{ scaleX: 1 }}
        transition={{ duration: 2, ease: "linear" }}
        className="brand-gradient-bg mt-8 h-1 w-48 origin-left rounded-full"
      />
    </motion.div>
  );
}

function RoomHeader({ view }: { view: GameView }) {
  const [copied, setCopied] = useState(false);
  // Nas rondas o ecrã é das frases: no telemóvel o cabeçalho encolhe.
  const live = view.phase === "guessing" || view.phase === "reveal";
  const chip =
    view.phase === "lobby"
      ? { label: "Sala aberta · à espera de jogadores", dot: "bg-amber-300" }
      : view.phase === "guessing" || view.phase === "reveal"
        ? { label: `Ao vivo · ronda ${(view.current?.index ?? 0) + 1} de ${view.totalRounds}`, dot: "bg-rose-400" }
        : view.phase === "final"
          ? { label: "Terminado", dot: "bg-emerald-400" }
          : { label: "Cancelada", dot: "bg-white/40" };
  async function copy() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {}
  }
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/40">
          <Link href="/minigames" className="transition hover:text-white/70">Mini-games</Link>
          <span className="mx-1.5 text-white/20">/</span>
          sala de {firstName(view.hostName)}
        </p>
        <h1 className={`mt-2 font-semibold tracking-tight text-white sm:text-4xl ${live ? "text-xl" : "text-3xl"}`}>
          {MINIGAME_LABEL[view.kind]}
        </h1>
        <span className="mt-3 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-white/65">
          <span className="relative flex h-2 w-2">
            {view.phase !== "final" && view.phase !== "cancelled" && (
              <span className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-60 ${chip.dot}`} />
            )}
            <span className={`relative inline-flex h-2 w-2 rounded-full ${chip.dot}`} />
          </span>
          {chip.label}
        </span>
      </div>
      <div className={`items-center gap-3 ${live ? "hidden sm:flex" : "flex"}`}>
        <AvatarStack people={view.players} size={30} max={7} />
        {(view.phase === "lobby" || view.phase === "guessing" || view.phase === "reveal") && (
          <button
            type="button"
            onClick={copy}
            className="inline-flex items-center gap-1.5 rounded-full border border-white/12 bg-white/[0.04] px-3.5 py-2 text-xs font-medium text-white/75 transition hover:bg-white/[0.08] hover:text-white"
          >
            {copied ? <Check className="h-3.5 w-3.5 text-emerald-300" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? "Link copiado" : "Copiar link da sala"}
          </button>
        )}
      </div>
    </div>
  );
}

function JoinCard({ view, act, busy }: { view: GameView; act: Act; busy: string | null }) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative mx-auto max-w-xl overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.03] p-8 text-center sm:p-10"
    >
      <div className="pointer-events-none absolute -top-24 left-1/2 h-56 w-56 -translate-x-1/2 rounded-full bg-[#783DF5]/25 blur-3xl" />
      <FannedCards />
      <h2 className="relative mt-6 text-2xl font-semibold text-white">{firstName(view.hostName)} abriu uma sala</h2>
      <p className="relative mt-2 text-sm text-white/55">
        Escreves 3 frases sobre ti — uma verdadeira e duas inventadas. Depois, ronda a ronda, tentas descobrir a verdade de cada colega.
      </p>
      {view.players.length > 0 && (
        <div className="relative mt-6 flex items-center justify-center gap-3 text-xs text-white/50">
          <AvatarStack people={view.players} size={32} max={8} />
          {view.players.length} na sala
        </div>
      )}
      <button
        type="button"
        onClick={() => act("join")}
        disabled={busy === "join"}
        className="brand-gradient-bg relative mt-8 inline-flex items-center gap-2 rounded-2xl px-8 py-3.5 text-base font-semibold text-white shadow-[0_18px_50px_-16px_rgba(120,61,245,0.95)] transition hover:brightness-110 disabled:opacity-60"
      >
        {busy === "join" ? <Loader2 className="h-5 w-5 animate-spin" /> : <Play className="h-5 w-5" fill="currentColor" />}
        Entrar na sala
      </button>
    </motion.section>
  );
}

function JoinStrip({ act, busy }: { act: Act; busy: string | null }) {
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#A35BFF]/30 bg-[#783DF5]/10 px-4 py-3 text-sm text-white/75">
      <span className="inline-flex items-center gap-2">
        <Eye className="h-4 w-4 text-[#d2b4ff]" /> O jogo já começou — entra e adivinha a partir de agora (sem ronda tua).
      </span>
      <button
        type="button"
        onClick={() => act("join")}
        disabled={busy === "join"}
        className="brand-gradient-bg inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-semibold text-white disabled:opacity-60"
      >
        {busy === "join" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" fill="currentColor" />}
        Entrar a meio
      </button>
    </div>
  );
}

/** Barra fixa do anfitrião (SuperAdmin). Os botões mudam com a fase. */
function HostBar({ view, act, busy }: { view: GameView; act: Act; busy: string | null }) {
  const [confirmEnd, setConfirmEnd] = useState(false);
  if (view.phase === "final" || view.phase === "cancelled") return null;
  const ready = view.players.filter((p) => p.ready).length;
  const cur = view.current;
  const lastRound = cur ? cur.index + 1 >= view.totalRounds : false;

  let primary: { label: string; icon: ReactNode; action: string; disabled?: boolean; hint?: string } | null = null;
  if (view.phase === "lobby") {
    primary = {
      label: `Começar o jogo`,
      icon: <Play className="h-4 w-4" fill="currentColor" />,
      action: "start",
      disabled: ready < 2,
      hint:
        ready < 2
          ? `Precisa de 2+ pessoas com as frases prontas (${ready} até agora)`
          : `${ready} rondas · quem não estiver pronto joga só a adivinhar`,
    };
  } else if (view.phase === "guessing") {
    primary = {
      label: "Revelar já",
      icon: <Eye className="h-4 w-4" />,
      action: "reveal",
      hint: cur ? `${cur.voted.length} de ${cur.expectedVoters} votaram` : undefined,
    };
  } else if (view.phase === "reveal") {
    primary = lastRound
      ? { label: "Ver o pódio", icon: <Trophy className="h-4 w-4" />, action: "finish", hint: "Era a última ronda" }
      : { label: "Próxima ronda", icon: <ArrowRight className="h-4 w-4" />, action: "next", hint: `Faltam ${view.totalRounds - (cur?.index ?? 0) - 1}` };
  }

  const secondary =
    view.phase === "lobby"
      ? { label: "Cancelar sala", action: "cancel", confirm: "Cancelar mesmo? Ninguém chega a jogar." }
      : { label: "Terminar já", action: "finish", confirm: "Terminar já? Contam só as rondas reveladas." };

  return (
    <div className="fixed inset-x-0 bottom-4 z-40 flex justify-center px-4">
      <motion.div
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="flex w-full max-w-2xl flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-400/25 bg-[#120f0a]/90 px-4 py-3 shadow-[0_20px_60px_-20px_rgba(0,0,0,0.9)] backdrop-blur-xl"
      >
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-300/80">Anfitrião</p>
          <p className="truncate text-xs text-white/55">{primary?.hint}</p>
        </div>
        <div className="flex items-center gap-2">
          {confirmEnd ? (
            <>
              <span className="hidden text-xs text-white/60 sm:inline">{secondary.confirm}</span>
              <button
                type="button"
                onClick={async () => {
                  await act(secondary.action);
                  setConfirmEnd(false);
                }}
                disabled={busy !== null}
                className="rounded-xl bg-rose-500/90 px-3 py-2 text-xs font-semibold text-white hover:bg-rose-500 disabled:opacity-60"
              >
                Sim
              </button>
              <button type="button" onClick={() => setConfirmEnd(false)} className="rounded-xl px-3 py-2 text-xs text-white/60 hover:text-white">
                Não
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmEnd(true)}
              className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs text-white/50 transition hover:bg-white/[0.06] hover:text-white"
            >
              <Flag className="h-3.5 w-3.5" /> {secondary.label}
            </button>
          )}
          {primary && !confirmEnd && (
            <button
              type="button"
              onClick={() => act(primary!.action)}
              disabled={primary.disabled || busy !== null}
              className="inline-flex items-center gap-2 rounded-xl bg-amber-400 px-4 py-2.5 text-sm font-semibold text-amber-950 shadow-[0_10px_30px_-10px_rgba(251,191,36,0.8)] transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
            >
              {busy === primary.action ? <Loader2 className="h-4 w-4 animate-spin" /> : primary.icon}
              {primary.label}
            </button>
          )}
        </div>
      </motion.div>
    </div>
  );
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="mx-auto mt-10 max-w-lg rounded-3xl border border-white/10 bg-white/[0.03] p-8 text-center">
      <h2 className="text-xl font-semibold text-white">{title}</h2>
      <p className="mt-2 text-sm text-white/55">{body}</p>
      <Link
        href="/minigames"
        className="mt-6 inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/[0.04] px-5 py-2.5 text-sm font-medium text-white/80 transition hover:bg-white/[0.08] hover:text-white"
      >
        Voltar aos Mini-games
      </Link>
    </div>
  );
}
