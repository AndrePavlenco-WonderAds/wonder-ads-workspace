"use client";

// O fim do jogo: pódio com os três primeiros, prémios e a classificação
// completa. Os confetes caem uma vez, quando o pódio sobe.

import Link from "next/link";
import { motion } from "motion/react";
import { ArrowLeft, Crown } from "lucide-react";
import type { FinalRow, GameView } from "@/lib/minigames/types";
import { Avatar, Confetti } from "./ui";

const PLACES = [
  { place: 2, height: 128, medal: "🥈", tone: "from-slate-300/25 to-slate-300/[0.04]", border: "border-slate-300/30", delay: 0.5 },
  { place: 1, height: 176, medal: "🥇", tone: "from-amber-300/30 to-amber-300/[0.04]", border: "border-amber-300/45", delay: 0.9 },
  { place: 3, height: 96, medal: "🥉", tone: "from-orange-400/25 to-orange-400/[0.04]", border: "border-orange-400/30", delay: 0.2 },
];

export function OneTruthFinal({ view }: { view: GameView }) {
  const ranking = view.final?.ranking ?? [];
  const awards = view.final?.awards ?? [];
  const top = (place: number): FinalRow | undefined => ranking[place - 1];
  const myPlace = ranking.findIndex((r) => r.username === view.me.username) + 1;

  return (
    <div className="relative">
      <Confetti burst="final" pieces={140} delay={1.1} />

      <div className="text-center">
        <motion.p
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-xs font-semibold uppercase tracking-[0.22em] text-white/45"
        >
          Fim de jogo
        </motion.p>
        <motion.h2
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: "spring", stiffness: 200, damping: 16 }}
          className="mt-2 text-4xl font-semibold tracking-tight text-white sm:text-5xl"
        >
          O <span className="brand-gradient-text">pódio</span>
        </motion.h2>
        {myPlace > 0 && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.6 }}
            className="mt-2 text-sm text-white/55"
          >
            {myPlace === 1 ? "Ganhaste! 👑 Hoje ninguém te levou a melhor." : `Ficaste em ${myPlace}.º lugar de ${ranking.length}.`}
          </motion.p>
        )}
      </div>

      {/* Pódio */}
      <div className="mx-auto mt-10 grid max-w-2xl grid-cols-3 items-end gap-3 sm:gap-5">
        {PLACES.map((p) => {
          const row = top(p.place);
          return (
            <div key={p.place} className="flex flex-col items-center">
              {row ? (
                <motion.div
                  initial={{ opacity: 0, y: 30, scale: 0.6 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ delay: p.delay + 0.35, type: "spring", stiffness: 240, damping: 16 }}
                  className="mb-3 flex flex-col items-center text-center"
                >
                  <span className="relative">
                    {p.place === 1 && (
                      <motion.span
                        initial={{ y: -20, opacity: 0, rotate: -20 }}
                        animate={{ y: 0, opacity: 1, rotate: -8 }}
                        transition={{ delay: 1.5, type: "spring", stiffness: 300, damping: 12 }}
                        className="absolute -top-7 left-1/2 -translate-x-1/2 text-amber-300 drop-shadow-[0_4px_12px_rgba(252,211,77,0.6)]"
                      >
                        <Crown className="h-8 w-8" fill="currentColor" />
                      </motion.span>
                    )}
                    <Avatar name={row.name} avatar={row.avatar} size={p.place === 1 ? 84 : 64} ring={p.place === 1} />
                  </span>
                  <span className="mt-2 max-w-[9rem] truncate text-sm font-semibold text-white">{row.name}</span>
                  <span className="text-xs font-bold tabular-nums text-white/60">{row.score} pts</span>
                </motion.div>
              ) : (
                <div className="mb-3 h-[100px]" />
              )}
              <motion.div
                initial={{ height: 0 }}
                animate={{ height: row ? p.height : 40 }}
                transition={{ delay: p.delay, type: "spring", stiffness: 120, damping: 18 }}
                className={`flex w-full items-start justify-center overflow-hidden rounded-t-2xl border border-b-0 bg-gradient-to-b pt-3 ${p.tone} ${p.border}`}
              >
                <span className="text-3xl sm:text-4xl">{row ? p.medal : ""}</span>
              </motion.div>
            </div>
          );
        })}
      </div>
      <div className="mx-auto h-px max-w-2xl bg-white/15" />

      {/* Prémios */}
      {awards.length > 0 && (
        <div className="mx-auto mt-10 grid max-w-4xl gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {awards.map((a, i) => (
            <motion.div
              key={a.key}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 2 + i * 0.15 }}
              className="rounded-3xl border border-white/10 bg-white/[0.03] p-5"
            >
              <div className="flex items-center gap-3">
                <span className="text-3xl">{a.emoji}</span>
                <div>
                  <p className="font-semibold text-white">{a.title}</p>
                  <p className="text-xs text-white/50">{a.blurb}</p>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {a.winners.map((w) => (
                  <span key={w.username} className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/20 py-1 pl-1 pr-3 text-xs text-white/80">
                    <Avatar name={w.name} avatar={w.avatar} size={22} />
                    {w.name}
                  </span>
                ))}
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Classificação completa */}
      <motion.section
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 2.4 }}
        className="mx-auto mt-10 max-w-2xl rounded-3xl border border-white/10 bg-white/[0.03] p-4 sm:p-6"
      >
        <div className="grid grid-cols-[2rem_1fr_auto_auto_auto] items-center gap-x-3 gap-y-2 text-sm">
          <span />
          <span className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-white/35">Jogador</span>
          <span className="text-right text-[10.5px] font-semibold uppercase tracking-[0.14em] text-white/35" title="Verdades descobertas">Acertos</span>
          <span className="text-right text-[10.5px] font-semibold uppercase tracking-[0.14em] text-white/35" title="Pessoas enganadas na própria ronda">Enganou</span>
          <span className="text-right text-[10.5px] font-semibold uppercase tracking-[0.14em] text-white/35">Pontos</span>
          {ranking.map((r, i) => {
            const me = r.username === view.me.username;
            return (
              <div key={r.username} className={`contents ${me ? "[&>*]:text-white" : ""}`}>
                <span className="text-center font-bold tabular-nums text-white/45">{i + 1}</span>
                <span className="flex min-w-0 items-center gap-2.5">
                  <Avatar name={r.name} avatar={r.avatar} size={28} />
                  <span className="truncate text-white/85">
                    {r.name}
                    {me && <span className="ml-1.5 text-xs text-white/40">(tu)</span>}
                  </span>
                </span>
                <span className="text-right tabular-nums text-white/60">{r.correct}</span>
                <span className="text-right tabular-nums text-white/60">{r.fooled}</span>
                <span className="text-right font-bold tabular-nums text-white">{r.score}</span>
              </div>
            );
          })}
        </div>
      </motion.section>

      <div className="mt-10 flex justify-center">
        <Link
          href="/minigames"
          className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/[0.04] px-5 py-2.5 text-sm font-medium text-white/80 transition hover:bg-white/[0.08] hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" /> Voltar aos Mini-games
        </Link>
      </div>
    </div>
  );
}
