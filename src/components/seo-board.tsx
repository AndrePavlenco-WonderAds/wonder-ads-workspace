"use client";

// Board de clientes do SEO DPT — UMA FILA DE LANES, uma por consultor.
//
// DESENHO (v77.48). A grelha anterior (4 colunas no máximo) mandava o 5.º
// consultor para uma segunda linha, por baixo da equipa — a Maria ficava
// «debaixo» do João B. em vez de ao lado. Agora a equipa lê-se sempre numa
// só linha, como estão sentados:
//
//   • ≥ xl (1280px): a board sai do contentor de 7xl e ocupa a largura toda
//     da página; as N lanes dividem-na em partes iguais. Cinco, seis, sete
//     consultores — continua a ser uma linha; cada lane fica só mais
//     estreita. O cabeçalho de cada lane é STICKY: ao descer pelas carteiras
//     compridas, o nome de quem é a coluna continua à vista.
//   • < xl: as lanes têm largura fixa e a fila desliza na horizontal com
//     snap (arrasta-se com o dedo ou o trackpad). A faixa de atalhos por
//     cima diz onde se está e salta para a lane de cada consultor.
//
// A lane de quem está a ver é realçada («A tua carteira»). Uma lane de
// «Por atribuir» é âmbar de propósito: um cliente aí é uma atribuição por
// resolver, não um estado normal.
//
// Sem fotos dos consultores, por decisão do André (v76.88): as caras vivem
// no header e no «Ver como…». O servidor resolve tudo o que precisa de I/O
// (logos, NPS, garantia, domínio) e entrega dados serializáveis.

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowUpRight, Star, UserRound } from "lucide-react";
import type { ClientPalette } from "@/lib/client-colors";
import type { ClientTier } from "@/lib/client-tiers";
import type { LogoBgMode, LogoSizing } from "@/lib/client-meta";
import { npsScoreColor } from "@/lib/nps-questions";
import { ClientCard } from "./client-card";
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
  /** A carteira de quem está a ver — a lane ganha o realce. */
  isMine?: boolean;
  clients: SeoBoardCard[];
};

/** Nome → id de âncora estável para a faixa de atalhos. */
function laneId(name: string, paused: boolean): string {
  const slug = name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `${paused ? "paused" : "lane"}-${slug || "x"}`;
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
  /** Secção de pausados: cartões esbatidos. */
  paused?: boolean;
}) {
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
      {/* Faixa de atalhos — só quando as lanes não cabem todas (< xl). */}
      <nav
        aria-label="Consultores"
        className="mb-4 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] xl:hidden [&::-webkit-scrollbar]:hidden"
      >
        {columns.map((col) => {
          const id = laneId(col.name, paused);
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

      {/* A fila. < xl: flex deslizante com snap, a sangrar até às margens da
          página; ≥ xl: grelha de N partes iguais, sem scroll. */}
      <div
        ref={trackRef}
        className="-mx-6 flex snap-x snap-mandatory gap-4 overflow-x-auto overflow-y-hidden px-6 pb-5 pt-2 [scrollbar-width:none] sm:-mx-10 sm:px-10 xl:mx-0 xl:grid xl:snap-none xl:overflow-visible xl:px-0 xl:pb-0 2xl:gap-5 [&::-webkit-scrollbar]:hidden"
        style={{
          gridTemplateColumns: `repeat(${columns.length}, minmax(0, 1fr))`,
          scrollPaddingInline: "1.5rem",
        }}
      >
        {columns.map((col, i) => (
          <Lane
            key={col.name}
            id={laneId(col.name, paused)}
            index={i + 1}
            column={col}
            isAdmin={isAdmin}
            paused={paused}
          />
        ))}
      </div>
    </div>
  );
}

function Lane({
  id,
  index,
  column,
  isAdmin,
  paused,
}: {
  id: string;
  index: number;
  column: SeoBoardColumn;
  isAdmin: boolean;
  paused: boolean;
}) {
  const { avg, rated } = averageNps(column.clients);
  const orphan = column.name === "Por atribuir";
  const mine = Boolean(column.isMine) && !orphan;

  return (
    <section
      id={id}
      data-lane={id}
      aria-label={`Carteira de ${column.name}`}
      className={`relative flex w-[276px] shrink-0 snap-start flex-col rounded-3xl border p-3 xl:w-auto xl:min-w-0 xl:shrink ${
        orphan
          ? "border-amber-400/30 bg-amber-500/[0.05]"
          : mine
            ? "border-[#783DF5]/45 bg-[#783DF5]/[0.045] shadow-[0_24px_70px_-40px_rgba(120,61,245,0.9)]"
            : "border-white/[0.07] bg-white/[0.02]"
      } ${paused ? "opacity-90" : ""}`}
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

      {/* Cabeçalho — sticky em ≥ xl, para o nome ficar à vista ao descer. */}
      <header
        className={`z-10 rounded-2xl border px-3.5 py-3 backdrop-blur-md xl:sticky xl:top-20 ${
          orphan
            ? "border-amber-400/25 bg-[#12100a]/90"
            : mine
              ? "border-[#783DF5]/35 bg-[#0d0a1c]/90"
              : "border-white/[0.07] bg-[#0b0c14]/90"
        }`}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p
              className={`readout ${
                orphan ? "text-amber-200/70" : mine ? "text-[#c3aaff]" : "text-white/35"
              }`}
            >
              {orphan
                ? "Atribuição por resolver"
                : mine
                  ? "A tua carteira"
                  : `Consultor ${index.toString().padStart(2, "0")}`}
            </p>
            <h3 className="mt-1 text-[15px] font-semibold tracking-tight text-white">
              {column.roadmapHref ? (
                <Link
                  href={column.roadmapHref}
                  className="group inline-flex max-w-full items-center gap-1.5 transition hover:text-white"
                  title={`Abrir o roadmap semanal de ${column.name}`}
                >
                  <span className="truncate underline-offset-4 decoration-white/30 group-hover:underline">
                    {column.name}
                  </span>
                  <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-white/40 transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-white" />
                </Link>
              ) : (
                <span className="block truncate">{column.name}</span>
              )}
            </h3>
          </div>
          <span
            className={`tabular mt-0.5 inline-flex h-7 min-w-7 shrink-0 items-center justify-center rounded-full px-2 text-[12px] font-bold ${
              orphan
                ? "bg-amber-400/15 text-amber-200"
                : mine
                  ? "brand-gradient-bg text-white"
                  : "bg-white/[0.07] text-white/80"
            }`}
            title={`${column.clients.length} cliente${column.clients.length === 1 ? "" : "s"}`}
          >
            {column.clients.length}
          </span>
        </div>

        <div className="mt-2.5 flex flex-wrap items-center gap-1.5 text-[10.5px] text-white/40">
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
          <span className="inline-flex items-center gap-1">
            <UserRound className="h-3 w-3" />
            {column.clients.length === 1
              ? "1 cliente"
              : `${column.clients.length} clientes`}
          </span>
        </div>
      </header>

      {/* Cartões */}
      {column.clients.length === 0 ? (
        <p className="mt-3 rounded-2xl border border-dashed border-white/10 px-4 py-8 text-center text-[12px] text-white/35">
          Sem clientes {paused ? "pausados" : "ativos"}.
        </p>
      ) : (
        <div className="mt-3 space-y-3.5">
          {column.clients.map((c, i) => (
            <div key={c.slug} className="relative">
              <div
                className={
                  paused ? "opacity-55 transition hover:opacity-80" : undefined
                }
              >
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
              </div>
              {isAdmin && (
                <>
                  <SeoConsultantMigrate
                    slug={c.slug}
                    title={c.title}
                    currentConsultant={column.name}
                  />
                  <SeoPauseToggle slug={c.slug} title={c.title} paused={paused} />
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
