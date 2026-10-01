"use client";

// Uma ronda de «Uma verdade, duas mentiras»: as 3 frases de uma pessoa,
// toda a gente (menos ela) escolhe qual é a verdade; quando todos votam ou
// o tempo acaba, o servidor revela e os carimbos caem — mentiras primeiro,
// a verdade no fim.

import { useMemo } from "react";
import { AnimatePresence, LayoutGroup, motion } from "motion/react";
import { Check, Eye, Hourglass, Mic } from "lucide-react";
import { POINTS_CORRECT, POINTS_FOOLED, type GameView, type PlayerView } from "@/lib/minigames/types";
import { Avatar, AvatarStack, Confetti, CountdownRing, LETTERS, STATEMENT_TONES, firstName } from "./ui";
import { useCountdown } from "./use-game";

type Act = (action: string, payload?: Record<string, unknown>) => Promise<boolean>;

/** Atraso de cada carimbo na revelação: as mentiras primeiro, a verdade no fim. */
function stampDelay(i: number, truth: number) {
  if (i === truth) return 1.5;
  const lies = [0, 1, 2].filter((k) => k !== truth);
  return 0.35 + lies.indexOf(i) * 0.45;
}

export function OneTruthRound({
  view,
  act,
  busy,
  offset,
}: {
  view: GameView;
  act: Act;
  busy: string | null;
  offset: number;
}) {
  const cur = view.current!;
  const revealed = view.phase === "reveal";
  const isAuthor = cur.author.username === view.me.username;
  const canVote = view.me.joined && !isAuthor && !revealed;
  const remaining = useCountdown(revealed ? null : view.deadline, offset, view.serverNow);
  const byUser = useMemo(() => new Map(view.players.map((p) => [p.username, p])), [view.players]);
  const authorName = firstName(cur.author.name);

  const votersOf = (i: number) =>
    (cur.votes ?? [])
      .filter((v) => v.choice === i)
      .map((v) => byUser.get(v.username))
      .filter((p): p is PlayerView => Boolean(p));

  const myDelta = cur.deltas?.[view.me.username] ?? 0;
  const iGuessedRight = revealed && cur.myVote !== null && cur.myVote === cur.truth;
  const fooled = revealed ? (cur.votes ?? []).filter((v) => v.choice !== cur.truth).length : 0;

  return (
    <div>
      {/* Cabeçalho da ronda */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          {Array.from({ length: view.totalRounds }, (_, i) => (
            <span
              key={i}
              className={`h-1.5 rounded-full transition-all duration-500 ${
                i < cur.index ? "w-5 bg-white/40" : i === cur.index ? "w-9 brand-gradient-bg" : "w-5 bg-white/10"
              }`}
            />
          ))}
          <span className="ml-2 text-xs font-medium uppercase tracking-[0.16em] text-white/45">
            Ronda {cur.index + 1} de {view.totalRounds}
          </span>
        </div>
        {remaining !== null && view.roundSeconds ? (
          <CountdownRing seconds={remaining} total={view.roundSeconds} size={58} />
        ) : !revealed ? (
          <span className="inline-flex items-center gap-1.5 text-xs text-white/40">
            <Hourglass className="h-3.5 w-3.5" /> sem limite de tempo
          </span>
        ) : null}
      </div>

      {/* Quem é */}
      <div className="mt-6 flex flex-col items-center text-center">
        <motion.div
          key={`${cur.index}-avatar`}
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 260, damping: 18 }}
        >
          <Avatar name={cur.author.name} avatar={cur.author.avatar} size={84} ring />
        </motion.div>
        <AnimatePresence mode="wait">
          <motion.div
            key={`${revealed}-${isAuthor}`}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="mt-4"
          >
            {revealed ? (
              <>
                <h2 className="text-2xl font-semibold text-white sm:text-3xl">A verdade de {authorName} era…</h2>
                <p className="mt-1.5 text-sm text-white/50">
                  {cur.votes?.length ? `${fooled} de ${cur.votes.length} caíram nas mentiras.` : "Ninguém chegou a votar."}
                </p>
              </>
            ) : isAuthor ? (
              <>
                <h2 className="text-2xl font-semibold text-white sm:text-3xl">É a tua ronda 🤫</h2>
                <p className="mt-1.5 text-sm text-white/50">Cara de poker! Os outros estão a tentar descobrir qual é a tua verdade.</p>
              </>
            ) : (
              <>
                <h2 className="text-2xl font-semibold text-white sm:text-3xl">
                  Qual destas é a verdade de <span className="brand-gradient-text">{authorName}</span>?
                </h2>
                <p className="mt-1.5 text-sm text-white/50">
                  {view.me.joined
                    ? cur.myVote === null
                      ? "Toca na frase que achas verdadeira — as outras duas são mentira."
                      : "Palpite registado. Podes mudar até à revelação."
                    : "Estás só a ver — entra na sala para jogar a próxima."}
                </p>
              </>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* As 3 frases */}
      <div className="mt-8 grid gap-4 md:grid-cols-3">
        {cur.statements.map((text, i) => {
          const tone = STATEMENT_TONES[i];
          const picked = cur.myVote === i;
          const isTruth = revealed && cur.truth === i;
          const isLie = revealed && cur.truth !== i;
          const myTruth = isAuthor && cur.myTruth === i;
          const dim = canVote && cur.myVote !== null && !picked;
          const delay = revealed && cur.truth !== null ? stampDelay(i, cur.truth) : 0;
          const voters = revealed ? votersOf(i) : [];
          return (
            <motion.button
              key={`${cur.index}-${i}`}
              type="button"
              disabled={!canVote || busy === "vote"}
              onClick={() => canVote && act("vote", { round: cur.index, choice: i })}
              initial={{ opacity: 0, y: 24, rotate: [-2, 1, 2][i] }}
              animate={{
                opacity: isLie ? 0.62 : dim ? 0.55 : 1,
                y: 0,
                rotate: 0,
                scale: isTruth ? 1.03 : picked && !revealed ? 1.02 : 1,
              }}
              transition={{
                opacity: { delay: isLie ? delay : 0, duration: 0.4 },
                scale: { delay: isTruth ? delay : 0, type: "spring", stiffness: 300, damping: 16 },
                default: { delay: revealed ? 0 : 0.08 * i, type: "spring", stiffness: 220, damping: 20 },
              }}
              whileHover={canVote ? { y: -4 } : undefined}
              whileTap={canVote ? { scale: 0.98 } : undefined}
              className={`group relative flex min-h-[170px] flex-col overflow-hidden rounded-3xl border p-5 text-left transition-colors sm:min-h-[200px] sm:p-6 ${
                canVote ? "cursor-pointer" : "cursor-default"
              } ${
                isTruth
                  ? "border-emerald-400/70 bg-emerald-400/[0.08]"
                  : picked && !revealed
                    ? "border-transparent bg-white/[0.06]"
                    : "border-white/10 bg-white/[0.03] hover:border-white/20"
              }`}
              style={
                isTruth
                  ? { boxShadow: "0 0 0 1px rgba(52,211,153,0.35), 0 24px 70px -24px rgba(52,211,153,0.75)" }
                  : picked && !revealed
                    ? { boxShadow: `0 0 0 2px ${tone.ring}, 0 22px 60px -22px ${tone.ring}` }
                    : undefined
              }
            >
              {/* letra gigante de fundo */}
              <span
                aria-hidden
                className="pointer-events-none absolute -bottom-6 -right-2 select-none text-[120px] font-black leading-none opacity-[0.07]"
                style={{ color: tone.ring }}
              >
                {LETTERS[i]}
              </span>
              <span className="flex items-center justify-between gap-2">
                <span
                  className="flex h-9 w-9 items-center justify-center rounded-xl text-sm font-extrabold"
                  style={{ background: tone.soft, color: tone.text, boxShadow: `inset 0 0 0 1px ${tone.ring}55` }}
                >
                  {LETTERS[i]}
                </span>
                {picked && !revealed && (
                  <motion.span
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-wider text-white"
                    style={{ background: tone.ring }}
                  >
                    <Check className="h-3 w-3" strokeWidth={3.5} /> o teu palpite
                  </motion.span>
                )}
                {myTruth && !revealed && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/40 bg-emerald-400/10 px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-wider text-emerald-300">
                    <Eye className="h-3 w-3" /> a tua verdade
                  </span>
                )}
              </span>
              <span className="relative mt-4 flex-1 text-[17px] font-medium leading-snug text-white sm:text-lg">{text}</span>

              {revealed && (
                <span className="relative mt-4 flex min-h-[28px] items-center justify-between gap-2">
                  {voters.length > 0 ? (
                    <AvatarStack people={voters} size={26} />
                  ) : (
                    <span className="text-[11px] text-white/30">ninguém</span>
                  )}
                  <span className="text-[11px] font-semibold tabular-nums text-white/45">
                    {picked && <span className="mr-1.5 uppercase tracking-wider text-white/70">o teu palpite ·</span>}
                    {voters.length} {voters.length === 1 ? "voto" : "votos"}
                  </span>
                </span>
              )}

              {/* carimbo */}
              <AnimatePresence>
                {revealed && cur.truth !== null && (
                  <motion.span
                    initial={{ scale: 2.6, opacity: 0, rotate: isTruth ? -3 : -8 }}
                    animate={{ scale: 1, opacity: 1, rotate: isTruth ? -3 : -8 }}
                    transition={{ delay, type: "spring", stiffness: 420, damping: 18 }}
                    className={`pointer-events-none absolute right-4 top-4 rounded-lg border-[3px] px-2.5 py-0.5 text-base font-black uppercase tracking-[0.12em] sm:right-5 sm:top-5 sm:text-lg ${
                      isTruth
                        ? "border-emerald-300 bg-emerald-400/15 text-emerald-200 shadow-[0_0_40px_rgba(52,211,153,0.45)]"
                        : "border-rose-400/80 bg-rose-500/10 text-rose-300"
                    }`}
                  >
                    {isTruth ? "Verdade" : "Mentira"}
                  </motion.span>
                )}
              </AnimatePresence>
            </motion.button>
          );
        })}
      </div>

      {/* Por baixo: quem já votou / o resultado */}
      {!revealed ? (
        <VotersStrip view={view} />
      ) : (
        <RevealFooter
          view={view}
          isAuthor={isAuthor}
          iGuessedRight={iGuessedRight}
          myDelta={myDelta}
          fooled={fooled}
          authorName={authorName}
        />
      )}
    </div>
  );
}

function VotersStrip({ view }: { view: GameView }) {
  const cur = view.current!;
  const voted = new Set(cur.voted);
  const expected = view.players.filter((p) => p.username !== cur.author.username);
  return (
    <div className="mt-8 flex flex-col items-center gap-3">
      <div className="flex flex-wrap justify-center gap-2">
        {expected.map((p) => {
          const done = voted.has(p.username);
          return (
            <motion.span
              key={p.username}
              animate={{ opacity: done ? 1 : 0.35, scale: done ? 1 : 0.92 }}
              className="relative"
              title={`${p.name}${done ? " já votou" : " ainda está a pensar"}`}
            >
              <Avatar name={p.name} avatar={p.avatar} size={36} />
              <AnimatePresence>
                {done && (
                  <motion.span
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    exit={{ scale: 0 }}
                    transition={{ type: "spring", stiffness: 500, damping: 18 }}
                    className="absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-400 text-emerald-950 ring-2 ring-[#0b0c12]"
                  >
                    <Check className="h-2.5 w-2.5" strokeWidth={4} />
                  </motion.span>
                )}
              </AnimatePresence>
            </motion.span>
          );
        })}
      </div>
      <p className="text-xs text-white/45">
        <span className="font-semibold tabular-nums text-white/80">{cur.voted.length}</span> de {cur.expectedVoters} já votaram
        {cur.voted.length < cur.expectedVoters ? " — revela quando todos votarem" : ""}
      </p>
    </div>
  );
}

function RevealFooter({
  view,
  isAuthor,
  iGuessedRight,
  myDelta,
  fooled,
  authorName,
}: {
  view: GameView;
  isAuthor: boolean;
  iGuessedRight: boolean;
  myDelta: number;
  fooled: number;
  authorName: string;
}) {
  const cur = view.current!;
  const participated = cur.myVote !== null;
  let banner: { tone: "good" | "bad" | "author"; title: string; sub: string } | null = null;
  if (isAuthor && !cur.votes?.length) {
    banner = null;
  } else if (isAuthor) {
    banner =
      fooled > 0
        ? { tone: "author", title: `Enganaste ${fooled} ${fooled === 1 ? "pessoa" : "pessoas"}! 🎭`, sub: `+${fooled * POINTS_FOOLED} pontos (${POINTS_FOOLED} por cada)` }
        : { tone: "bad", title: "Toda a gente te topou! 😅", sub: "Na próxima, mentiras mais credíveis." }
  } else if (participated) {
    banner = iGuessedRight
      ? { tone: "good", title: "Acertaste! 🎉", sub: `+${POINTS_CORRECT} pontos` }
      : { tone: "bad", title: "Desta vez não!", sub: `A verdade era a ${LETTERS[cur.truth ?? 0]}. ${authorName} ganha pontos à tua custa.` };
  } else if (view.me.joined) {
    banner = { tone: "bad", title: "Não chegaste a votar", sub: "Na próxima, vota antes de o tempo acabar." };
  }

  return (
    <div className="mt-8 space-y-6">
      {iGuessedRight && <Confetti burst={`r${cur.index}`} pieces={70} delay={1.6} />}
      {isAuthor && fooled >= 2 && <Confetti burst={`a${cur.index}`} pieces={60} delay={1.6} />}
      {banner && (
        <motion.div
          initial={{ opacity: 0, y: 16, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ delay: 1.9, type: "spring", stiffness: 260, damping: 20 }}
          className={`mx-auto flex max-w-xl items-center justify-between gap-4 rounded-2xl border px-5 py-4 ${
            banner.tone === "good"
              ? "border-emerald-400/40 bg-emerald-400/10"
              : banner.tone === "author"
                ? "border-[#A35BFF]/50 bg-[#783DF5]/12"
                : "border-rose-400/30 bg-rose-500/[0.07]"
          }`}
        >
          <div>
            <p className="text-lg font-semibold text-white">{banner.title}</p>
            <p className="text-sm text-white/60">{banner.sub}</p>
          </div>
          {myDelta > 0 && (
            <motion.span
              initial={{ scale: 0 }}
              animate={{ scale: [0, 1.25, 1] }}
              transition={{ delay: 2.1, duration: 0.5 }}
              className="shrink-0 text-2xl font-black tabular-nums text-emerald-300"
            >
              +{myDelta}
            </motion.span>
          )}
        </motion.div>
      )}

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 2.4 }}
        className="flex items-center justify-center gap-2 text-sm text-white/55"
      >
        <Mic className="h-4 w-4 text-[#E04FD0]" />
        {isAuthor ? "Conta lá a história da tua verdade!" : `${authorName}, conta lá a história!`}
      </motion.p>

      <Scoreboard view={view} />
    </div>
  );
}

export function Scoreboard({ view }: { view: GameView }) {
  const deltas = view.current?.deltas ?? {};
  const ranked = [...view.players].sort((a, b) => b.score - a.score || a.name.localeCompare(b.name, "pt"));
  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 2.6 }}
      className="mx-auto max-w-xl rounded-3xl border border-white/10 bg-white/[0.03] p-4 sm:p-5"
    >
      <h3 className="mb-2 px-1 text-xs font-semibold uppercase tracking-[0.16em] text-white/45">Classificação</h3>
      <LayoutGroup>
        <ol className="space-y-1">
          {ranked.map((p, i) => {
            const d = deltas[p.username] ?? 0;
            const me = p.username === view.me.username;
            return (
              <motion.li
                key={p.username}
                layout
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
                className={`flex items-center gap-3 rounded-2xl px-2.5 py-2 ${me ? "bg-white/[0.06]" : ""}`}
              >
                <span className={`w-6 text-center text-sm font-bold tabular-nums ${i === 0 ? "text-amber-300" : i === 1 ? "text-slate-300" : i === 2 ? "text-orange-300" : "text-white/35"}`}>
                  {i + 1}
                </span>
                <Avatar name={p.name} avatar={p.avatar} size={30} />
                <span className="min-w-0 flex-1 truncate text-sm text-white/85">
                  {p.name}
                  {me && <span className="ml-1.5 text-xs text-white/40">(tu)</span>}
                </span>
                {d > 0 && (
                  <motion.span
                    initial={{ opacity: 0, x: -6 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 2.8 }}
                    className="rounded-full bg-emerald-400/15 px-2 py-0.5 text-[11px] font-bold tabular-nums text-emerald-300"
                  >
                    +{d}
                  </motion.span>
                )}
                <span className="w-14 text-right text-sm font-bold tabular-nums text-white">{p.score}</span>
              </motion.li>
            );
          })}
        </ol>
      </LayoutGroup>
    </motion.section>
  );
}
