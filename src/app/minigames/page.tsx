// /minigames — a zona de Mini-games da equipa (v77.71).
//
// Um hub de blocos de jogos; por agora há um, «Uma verdade, duas mentiras».
// SÓ OS SUPERADMINS ABREM SALAS (o botão só existe para eles e a API
// recusa os outros). Os consultores chegam cá pelo URL ou pelo link da sala
// e só podem ENTRAR — o hub atualiza-se sozinho quando uma sala abre. Os
// viewers ficam de fora pelo middleware, como no resto da app.

import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowRight, Gamepad2, Sparkles, Timer, Trophy, Users } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { CreateRoomButton } from "@/components/minigames/create-room-button";
import { HubWatcher } from "@/components/minigames/hub-watcher";
import { FannedCards } from "@/components/minigames/ui";
import { getCurrentEmployee } from "@/lib/auth/server";
import { formatDate } from "@/lib/dates";
import { getActiveSummary, listHistory } from "@/lib/minigames/one-truth-store";
import { MINIGAME_LABEL, POINTS_CORRECT, POINTS_FOOLED, type GameSummary } from "@/lib/minigames/types";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata = {
  title: "Mini-games — Wonder Ads Workspace",
};

const PHASE_LABEL: Record<GameSummary["phase"], string> = {
  lobby: "à espera de jogadores",
  guessing: "a decorrer",
  reveal: "a decorrer",
  final: "terminado",
  cancelled: "cancelada",
};

export default async function MinigamesPage() {
  const employee = await getCurrentEmployee();
  if (!employee) return null;
  const [active, history] = await Promise.all([getActiveSummary().catch(() => null), listHistory()]);

  return (
    <PageShell backHref="/" backLabel="workspace">
      <section className="animate-fade-up mt-4 sm:mt-6">
        <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.2em] text-white/40">
          <Gamepad2 className="h-3.5 w-3.5 text-[#c4a1ff]" />
          Zona de jogos da equipa
        </p>
        <h1 className="mt-2 text-4xl font-semibold leading-[1.05] tracking-tight text-white sm:text-5xl">
          Mini-<span className="brand-gradient-text">games</span>
        </h1>
        <p className="mt-3 max-w-2xl text-base text-white/65 sm:text-lg">
          Abre-se uma sala, cada pessoa entra no seu telemóvel ou portátil e joga-se ao vivo — na reunião de equipa, no
          team building ou só para desanuviar à sexta.
        </p>
      </section>

      {active && (
        <section className="animate-fade-up mt-8">
          <Link
            href={`/minigames/${active.id}`}
            className="brand-gradient-border group relative flex flex-wrap items-center justify-between gap-5 overflow-hidden rounded-3xl bg-white/[0.03] p-5 transition hover:bg-white/[0.05] sm:p-6"
          >
            <div className="pointer-events-none absolute -left-10 -top-16 h-48 w-48 rounded-full bg-[#783DF5]/25 blur-3xl" />
            <div className="relative flex items-center gap-4">
              <span className="relative flex h-3 w-3">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400 opacity-70" />
                <span className="relative inline-flex h-3 w-3 rounded-full bg-rose-400" />
              </span>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-rose-300">Ao vivo agora</p>
                <p className="mt-0.5 text-lg font-semibold text-white">{MINIGAME_LABEL[active.kind]}</p>
                <p className="text-sm text-white/55">
                  Sala de {active.hostName} · {active.players} na sala · {PHASE_LABEL[active.phase]}
                </p>
              </div>
            </div>
            <span className="brand-gradient-bg relative inline-flex items-center gap-2 rounded-2xl px-5 py-3 text-sm font-semibold text-white shadow-[0_14px_40px_-14px_rgba(120,61,245,0.9)] transition group-hover:brightness-110">
              Entrar na sala <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
            </span>
          </Link>
        </section>
      )}

      <section className="animate-fade-up mt-10 grid gap-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        {/* Bloco 1 — Uma verdade, duas mentiras */}
        <article className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.03]">
          <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-[#C535C9]/15 blur-3xl" />
          <div className="relative grid gap-6 p-6 sm:p-8 md:grid-cols-[auto_1fr] md:items-center">
            <div className="flex justify-center md:px-4">
              <FannedCards />
            </div>
            <div>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2.5 py-0.5 text-[10.5px] font-bold uppercase tracking-wider text-emerald-300">
                <Sparkles className="h-3 w-3" /> Novo
              </span>
              <h2 className="mt-3 text-2xl font-semibold text-white sm:text-3xl">{MINIGAME_LABEL["one-truth"]}</h2>
              <p className="mt-2 text-sm leading-relaxed text-white/60">
                Cada pessoa escreve 3 frases sobre si: <span className="text-emerald-300">uma verdadeira</span> e{" "}
                <span className="text-rose-300">duas inventadas</span>. Ronda a ronda, a equipa tenta descobrir a verdade de
                cada colega — e quem mente bem também ganha.
              </p>
              <div className="mt-4 flex flex-wrap gap-2 text-[11px] text-white/60">
                <Chip icon={<Users className="h-3 w-3" />}>2+ jogadores</Chip>
                <Chip icon={<Timer className="h-3 w-3" />}>10–20 min</Chip>
                <Chip icon={<Trophy className="h-3 w-3" />}>pódio no fim</Chip>
              </div>
            </div>
          </div>

          <ol className="relative grid gap-3 border-t border-white/8 px-6 py-5 sm:grid-cols-3 sm:px-8">
            {[
              ["Escreve", "3 frases sobre ti e marca qual é a verdade."],
              ["Adivinha", "Em cada ronda, escolhe a frase verdadeira do colega."],
              ["Pontua", `+${POINTS_CORRECT} por verdade descoberta · +${POINTS_FOOLED} por cada pessoa que enganas.`],
            ].map(([title, body], i) => (
              <li key={title} className="flex gap-3">
                <span className="brand-gradient-bg flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white">
                  {i + 1}
                </span>
                <span>
                  <span className="block text-sm font-semibold text-white">{title}</span>
                  <span className="block text-xs leading-relaxed text-white/50">{body}</span>
                </span>
              </li>
            ))}
          </ol>

          <div className="relative border-t border-white/8 bg-black/15 px-6 py-5 sm:px-8">
            {active ? (
              <Link
                href={`/minigames/${active.id}`}
                className="inline-flex items-center gap-2 text-sm font-semibold text-white transition hover:text-[#d2b4ff]"
              >
                Já há uma sala aberta — entrar <ArrowRight className="h-4 w-4" />
              </Link>
            ) : employee.isAdmin ? (
              <CreateRoomButton />
            ) : null}
            <HubWatcher activeId={active?.id ?? null} waiting={!active && !employee.isAdmin} />
          </div>
        </article>

        {/* Os próximos blocos */}
        <article className="flex flex-col items-center justify-center rounded-[2rem] border border-dashed border-white/12 bg-white/[0.015] p-8 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-white/40">
            <Gamepad2 className="h-7 w-7" />
          </span>
          <h2 className="mt-4 text-lg font-semibold text-white/80">Mais jogos a caminho</h2>
          <p className="mt-1 max-w-xs text-sm text-white/45">
            Esta zona vai crescer — os próximos mini-games aparecem aqui, cada um no seu bloco.
          </p>
        </article>
      </section>

      {history.length > 0 && (
        <section className="animate-fade-up mt-12">
          <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-white/55">Jogos anteriores</h2>
          <ul className="mt-4 divide-y divide-white/[0.06] overflow-hidden rounded-3xl border border-white/10 bg-white/[0.02]">
            {history.map((g) => (
              <li key={g.id}>
                <Link
                  href={`/minigames/${g.id}`}
                  className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3.5 transition hover:bg-white/[0.03]"
                >
                  <span className="w-24 shrink-0 text-xs tabular-nums text-white/45">{formatDate(g.finishedAt ?? g.createdAt)}</span>
                  <span className="min-w-0 flex-1 truncate text-sm text-white/85">
                    {MINIGAME_LABEL[g.kind]}
                    <span className="ml-2 text-xs text-white/40">
                      {g.players} jogadores · sala de {g.hostName}
                    </span>
                  </span>
                  {g.winner && (
                    <span className="inline-flex items-center gap-2 text-xs text-white/70">
                      <Trophy className="h-3.5 w-3.5 text-amber-300" />
                      {g.winner.name}
                      <span className="tabular-nums text-white/40">{g.winner.score} pts</span>
                    </span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </PageShell>
  );
}

function Chip({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1">
      {icon}
      {children}
    </span>
  );
}
