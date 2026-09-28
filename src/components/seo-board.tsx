"use client";

// Board de clientes do SEO DPT — UMA FILA DE LANES, uma por consultor.
//
// DESENHO (v77.48, afinado na v77.49). A grelha anterior (4 colunas no
// máximo) mandava o 5.º consultor para uma segunda linha, por baixo da
// equipa — a Maria ficava «debaixo» do João B. em vez de ao lado. Agora a
// equipa lê-se sempre numa só linha, como estão sentados:
//
//   • ≥ xl (1280px): a board ocupa a largura toda da página e as N lanes
//     dividem-na em partes iguais. Cinco, seis, sete consultores — continua
//     a ser uma linha; cada lane fica só mais estreita.
//   • < xl: as lanes têm largura fixa e a fila desliza na horizontal com
//     snap. A faixa de atalhos por cima diz onde se está e salta para a
//     lane de cada consultor.
//
// O cabeçalho de cada lane é o retrato + o nome (grande) + o total no canto,
// e NÃO é sticky (v77.49, a pedido do André: ao descer, a lista é que manda).
// A lane de quem está a ver é realçada; «Por atribuir» é âmbar de propósito:
// um cliente aí é uma atribuição por resolver, não um estado normal.
//
// `compact` é a versão dos pausados/suspensos: lanes mais estreitas, cabeçalho
// pequeno e uma linha por cliente em vez de um cartão — está lá, mas não
// compete com a carteira ativa.

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowUpRight, Star } from "lucide-react";
import type { ClientPalette } from "@/lib/client-colors";
import { paletteToGradient } from "@/lib/client-colors";
import type { ClientTier } from "@/lib/client-tiers";
import type { LogoBgMode, LogoSizing } from "@/lib/client-meta";
import { npsScoreColor } from "@/lib/nps-questions";
import { ClientCard } from "./client-card";
import { LogoChip } from "./logo-chip";
import { TierBadge } from "./tier-badge";
import { SeoPauseToggle } from "./seo-pause-toggle";
import { SeoConsultantMigrate } from "./seo-consultant-migrate";

export type SeoBoardCard = {
  slug: string;
  title: string;
  icon: string | null;
  logo: string | null;
  logoBgMode: LogoBgMode;
  logoSizing: LogoSizing;
  palette: ClientPalette;
  tier: ClientTier;
  npsOverall: number | null;
  npsAt: number | null;
  keywordGuarantee: boolean;
  domain: string | null;
};

export type SeoBoardColumn = {
  name: string;
  /** Link para o roadmap semanal — null quando quem vê não pode abrir. */
  roadmapHref: string | null;
  /** Retrato do consultor (public/team/avatar), ou null → inicial. */
  avatar?: string | null;
  /** A carteira de quem está a ver — a lane ganha o realce. */
  isMine?: boolean;
  clients: SeoBoardCard[];
};

/** Nome → id de âncora estável para a faixa de atalhos. */
function laneId(name: string, compact: boolean): string {
  const slug = name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `${compact ? "paused" : "lane"}-${slug || "x"}`;
}

/** Média de NPS de uma carteira — só sobre quem respondeu. */
function averageNps(clients: SeoBoardCard[]): {
  avg: number | null;
  rated: number;
} {
  const rated = clients.filter((c) => c.npsOverall !== null);
  if (rated.length === 0) return { avg: null, rated: 0 };
  const avg =
    rated.reduce((s, c) => s + (c.npsOverall ?? 0), 0) / rated.length;
  return { avg, rated: rated.length };
}

export function SeoBoard({
  columns,
  isAdmin,
  paused = false,
}: {
  columns: SeoBoardColumn[];
  isAdmin: boolean;
  /** Secção de pausados: versão compacta (lanes estreitas, linhas em vez
   *  de cartões, tudo mais apagado). */
  paused?: boolean;
}) {
  const compact = paused;
  const trackRef = useRef<HTMLDivElement>(null);
  // Lane em vista na fila deslizante (< xl) — realça o atalho certo.
  const [inView, setInView] = useState<string | null>(null);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    const lanes = Array.from(track.querySelectorAll<HTMLElement>("[data-lane]"));
    if (lanes.length === 0) return;
    const io = new IntersectionObserver(
      (entries) => {
        // A lane mais visível ganha; empates resolvem-se pela ordem.
        let best: { id: string; ratio: number } | null = null;
        for (const e of entries) {
          const id = (e.target as HTMLElement).dataset.lane ?? "";
          if (e.isIntersecting && (!best || e.intersectionRatio > best.ratio)) {
            best = { id, ratio: e.intersectionRatio };
          }
        }
        if (best) setInView(best.id);
      },
      { root: track, threshold: [0.4, 0.6, 0.8] },
    );
    for (const l of lanes) io.observe(l);
    return () => io.disconnect();
  }, [columns.length]);

  function jumpTo(id: string) {
    const el = document.getElementById(id);
    el?.scrollIntoView({ behavior: "smooth", inline: "start", block: "nearest" });
  }

  if (columns.length === 0) return null;

  return (
    <div className="relative">
      {/* Faixa de atalhos — só quando as lanes não cabem todas (< xl), e só
          na board ativa: a dos pausados é pequena e não precisa. */}
      {!compact && (
        <nav
          aria-label="Consultores"
          className="mb-4 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] xl:hidden [&::-webkit-scrollbar]:hidden"
        >
          {columns.map((col) => {
            const id = laneId(col.name, compact);
            const active = inView === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => jumpTo(id)}
                aria-current={active ? "true" : undefined}
                className={`inline-flex shrink-0 items-center gap-2 rounded-full border px-3 py-1.5 text-[11.5px] font-semibold tracking-tight transition ${
                  active
                    ? "border-[#783DF5]/60 bg-[#783DF5]/[0.14] text-white"
                    : "border-white/12 bg-white/[0.03] text-white/60 hover:border-white/25 hover:text-white/85"
                }`}
              >
                {col.name}
                <span
                  className={`tabular rounded-full px-1.5 py-px text-[10px] ${
                    active ? "bg-white/15 text-white" : "bg-white/[0.06] text-white/45"
                  }`}
                >
                  {col.clients.length}
                </span>
              </button>
            );
          })}
        </nav>
      )}

      {/* A fila. < xl: flex deslizante com snap, a sangrar até às margens da
          página; ≥ xl: grelha de N partes iguais, sem scroll. */}
      <div
        ref={trackRef}
        className={`-mx-6 flex snap-x snap-mandatory overflow-x-auto overflow-y-hidden px-6 pt-2 [scrollbar-width:none] sm:-mx-10 sm:px-10 xl:mx-0 xl:grid xl:snap-none xl:overflow-visible xl:px-0 xl:pb-0 [&::-webkit-scrollbar]:hidden ${
          compact ? "gap-3 pb-3" : "gap-4 pb-5 2xl:gap-5"
        }`}
        style={{
          gridTemplateColumns: `repeat(${columns.length}, minmax(0, 1fr))`,
          scrollPaddingInline: "1.5rem",
        }}
      >
        {columns.map((col) => (
          <Lane
            key={col.name}
            id={laneId(col.name, compact)}
            column={col}
            isAdmin={isAdmin}
            compact={compact}
          />
        ))}
      </div>
    </div>
  );
}

/** Retrato do consultor no topo da lane — a foto do roster, ou a inicial
 *  sobre o degradê da marca quando ainda não há retrato publicado. */
function ConsultantAvatar({
  avatar,
  name,
  size,
  ring,
}: {
  avatar: string | null | undefined;
  name: string;
  size: "md" | "sm";
  ring: string;
}) {
  const dim = size === "md" ? "h-11 w-11 text-[15px]" : "h-7 w-7 text-[11px]";
  return (
    <span
      aria-hidden
      className={`relative flex shrink-0 items-center justify-center overflow-hidden rounded-full font-bold text-white ring-2 ${ring} ${dim} ${
        avatar ? "" : "brand-gradient-bg"
      }`}
    >
      {avatar ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={avatar}
          alt=""
          className="h-full w-full object-cover object-top"
        />
      ) : (
        name.trim().charAt(0).toUpperCase()
      )}
    </span>
  );
}

function Lane({
  id,
  column,
  isAdmin,
  compact,
}: {
  id: string;
  column: SeoBoardColumn;
  isAdmin: boolean;
  compact: boolean;
}) {
  const { avg, rated } = averageNps(column.clients);
  const orphan = column.name === "Por atribuir";
  const mine = Boolean(column.isMine) && !orphan;

  const laneTone = orphan
    ? "border-amber-400/30 bg-amber-500/[0.05]"
    : mine
      ? "border-[#783DF5]/45 bg-[#783DF5]/[0.045] shadow-[0_24px_70px_-40px_rgba(120,61,245,0.9)]"
      : "border-white/[0.07] bg-white/[0.02]";
  const ringTone = orphan
    ? "ring-amber-400/50"
    : mine
      ? "ring-[#783DF5]/70"
      : "ring-white/15";
  const countTone = orphan
    ? "bg-amber-400/15 text-amber-200"
    : mine
      ? "brand-gradient-bg text-white"
      : "bg-white/[0.07] text-white/80";

  const nameNode = column.roadmapHref ? (
    <Link
      href={column.roadmapHref}
      className="group inline-flex max-w-full items-center gap-1.5 transition hover:text-white"
      title={`Abrir o roadmap semanal de ${column.name}`}
    >
      <span className="truncate underline-offset-4 decoration-white/30 group-hover:underline">
        {column.name}
      </span>
      <ArrowUpRight
        className={`shrink-0 text-white/40 transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-white ${
          compact ? "h-3 w-3" : "h-4 w-4"
        }`}
      />
    </Link>
  ) : (
    <span className="block truncate">{column.name}</span>
  );

  return (
    <section
      id={id}
      data-lane={id}
      aria-label={`Carteira de ${column.name}`}
      className={`relative flex shrink-0 snap-start flex-col rounded-3xl border xl:w-auto xl:min-w-0 xl:shrink ${laneTone} ${
        compact ? "w-[224px] p-2 opacity-80 transition hover:opacity-100" : "w-[276px] p-3"
      }`}
    >
      {/* Fio de luz no topo — assina a lane sem lhe pôr moldura a mais. */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-8 top-0 h-px"
        style={{
          background: orphan
            ? "linear-gradient(90deg, transparent, rgba(251,191,36,0.7), transparent)"
            : mine
              ? "linear-gradient(90deg, transparent, rgba(120,61,245,0.9), rgba(197,53,201,0.6), transparent)"
              : "linear-gradient(90deg, transparent, rgba(255,255,255,0.22), transparent)",
        }}
      />

      {/* Cabeçalho: retrato + nome (grande) + total no canto. */}
      <header
        className={`flex items-start justify-between gap-3 ${
          compact ? "px-1 pb-2 pt-1" : "px-1.5 pb-3.5 pt-1.5"
        }`}
      >
        <div className="flex min-w-0 items-center gap-3">
          <ConsultantAvatar
            avatar={column.avatar}
            name={column.name}
            size={compact ? "sm" : "md"}
            ring={ringTone}
          />
          <div className="min-w-0">
            <h3
              className={`truncate tracking-tight text-white ${
                compact
                  ? "text-[13px] font-semibold"
                  : "text-[18px] font-bold leading-tight"
              }`}
            >
              {nameNode}
            </h3>
            {!compact && (
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                {avg !== null ? (
                  <span
                    title={`Média de satisfação (NPS) da carteira — ${rated} cliente${rated === 1 ? "" : "s"} com inquérito`}
                    className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums"
                    style={{
                      color: npsScoreColor(avg),
                      background: `${npsScoreColor(avg)}1a`,
                    }}
                  >
                    <Star className="h-2.5 w-2.5" fill="currentColor" strokeWidth={0} />
                    {avg.toFixed(1)}
                    <span className="font-medium opacity-70">NPS</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full bg-white/[0.05] px-1.5 py-0.5 text-[10px] uppercase tracking-[0.12em] text-white/30">
                    <Star className="h-2.5 w-2.5" />
                    sem NPS
                  </span>
                )}
                {mine && (
                  <span className="rounded-full border border-[#783DF5]/40 bg-[#783DF5]/[0.12] px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-[0.12em] text-[#c3aaff]">
                    A tua carteira
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
        <span
          className={`tabular inline-flex shrink-0 items-center justify-center rounded-full font-bold ${countTone} ${
            compact ? "h-6 min-w-6 px-1.5 text-[11px]" : "mt-0.5 h-8 min-w-8 px-2 text-[13px]"
          }`}
          title={`${column.clients.length} cliente${column.clients.length === 1 ? "" : "s"}`}
        >
          {column.clients.length}
        </span>
      </header>

      {/* Régua entre o cabeçalho e a carteira. */}
      <span
        aria-hidden
        className={`mx-1 block h-px ${compact ? "mb-2" : "mb-3.5"}`}
        style={{
          background:
            "linear-gradient(90deg, rgba(255,255,255,0.14), rgba(255,255,255,0.05) 60%, transparent)",
        }}
      />

      {column.clients.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-white/10 px-4 py-8 text-center text-[12px] text-white/35">
          Sem clientes {compact ? "pausados" : "ativos"}.
        </p>
      ) : compact ? (
        <div className="space-y-1.5">
          {column.clients.map((c) => (
            <div key={c.slug} className="relative">
              <Link
                href={`/seo/${c.slug}`}
                className={`flex items-center gap-2.5 rounded-xl border border-white/[0.06] bg-white/[0.02] py-2 pl-2.5 transition hover:border-white/15 hover:bg-white/[0.05] ${
                  isAdmin ? "pr-[4.75rem]" : "pr-2.5"
                }`}
              >
                <LogoChip
                  logo={c.logo}
                  emoji={c.icon}
                  alt={`${c.title} logo`}
                  gradient={paletteToGradient(c.palette)}
                  size="sm"
                  bgMode={c.logoBgMode}
                  sizing={c.logoSizing}
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[12.5px] font-medium text-white/80">
                    {c.title}
                  </span>
                  <span className="mt-0.5 flex items-center gap-1.5">
                    <TierBadge tier={c.tier} />
                  </span>
                </span>
              </Link>
              {isAdmin && (
                <>
                  <SeoConsultantMigrate
                    slug={c.slug}
                    title={c.title}
                    currentConsultant={column.name}
                  />
                  <SeoPauseToggle slug={c.slug} title={c.title} paused />
                </>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-3.5">
          {column.clients.map((c, i) => (
            <div key={c.slug} className="relative">
              <ClientCard
                title={c.title}
                icon={c.icon}
                logo={c.logo}
                logoBgMode={c.logoBgMode}
                logoSizing={c.logoSizing}
                href={`/seo/${c.slug}`}
                consultant={column.name}
                palette={c.palette}
                tier={c.tier}
                npsOverall={c.npsOverall}
                npsAt={c.npsAt}
                keywordGuarantee={c.keywordGuarantee}
                domain={c.domain}
                index={i}
                showArrow={false}
                showConsultant={false}
              />
              {isAdmin && (
                <>
                  <SeoConsultantMigrate
                    slug={c.slug}
                    title={c.title}
                    currentConsultant={column.name}
                  />
                  <SeoPauseToggle slug={c.slug} title={c.title} paused={false} />
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
