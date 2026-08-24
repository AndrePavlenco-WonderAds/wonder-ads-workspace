"use client";

// Board de clientes do SEO DPT (v76.88) — grelha de colunas por
// consultor, com cabeçalho de coluna a mostrar a média de NPS e o nº de
// garantias da carteira. O servidor resolve tudo o que precisa de I/O
// (logos, NPS, garantia, domínio) e entrega dados serializáveis.
//
// A barra de pesquisa + filtros da primeira versão foi removida a pedido
// do André (v76.89) — com ~25 clientes a board lê-se de uma vez e a barra
// só empurrava as colunas para baixo. SEM fotos dos consultores, também
// por decisão dele: as fotos ficam no header e no «Ver como…».

import Link from "next/link";
import { ArrowUpRight, ShieldCheck, Star } from "lucide-react";
import type { ClientPalette } from "@/lib/client-colors";
import type { ClientTier } from "@/lib/client-tiers";
import type { LogoBgMode, LogoSizing } from "@/lib/client-meta";
import { npsScoreColor } from "@/lib/nps-questions";
import { ClientCard } from "./client-card";
import { SeoPauseToggle } from "./seo-pause-toggle";

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
  clients: SeoBoardCard[];
};

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
  return (
    <div className="grid grid-cols-1 gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {columns.map((col) => (
        <ColumnView
          key={col.name}
          column={col}
          isAdmin={isAdmin}
          paused={paused}
        />
      ))}
    </div>
  );
}

function ColumnView({
  column,
  isAdmin,
  paused,
}: {
  column: SeoBoardColumn;
  isAdmin: boolean;
  paused: boolean;
}) {
  // Média de NPS da coluna — só sobre quem respondeu, e sobre a carteira
  // TODA do consultor, não sobre o subconjunto filtrado (a média é dele,
  // não da pesquisa).
  const rated = column.clients.filter((c) => c.npsOverall !== null);
  const avgNps =
    rated.length > 0
      ? rated.reduce((s, c) => s + (c.npsOverall ?? 0), 0) / rated.length
      : null;
  const guarantees = column.clients.filter((c) => c.keywordGuarantee).length;

  return (
    <div className="space-y-5">
      <header className="border-b border-white/8 pb-3">
        <div className="flex items-baseline justify-between gap-2">
          <h3 className="min-w-0 text-sm font-semibold uppercase tracking-[0.18em] text-white/70">
            {column.roadmapHref ? (
              <Link
                href={column.roadmapHref}
                className="group inline-flex items-baseline gap-1.5 text-white/80 transition hover:text-white"
                title={`Abrir o roadmap semanal de ${column.name}`}
              >
                <span className="truncate underline-offset-4 decoration-white/30 group-hover:underline">
                  {column.name}
                </span>
                <ArrowUpRight className="h-3 w-3 shrink-0 self-center opacity-0 transition group-hover:opacity-70" />
              </Link>
            ) : (
              <span className="truncate">{column.name}</span>
            )}
          </h3>
          <span className="shrink-0 text-xs font-medium uppercase tracking-[0.18em] text-white/35">
            {column.clients.length}
          </span>
        </div>
        {(avgNps !== null || guarantees > 0) && (
          <div className="mt-2 flex items-center gap-1.5">
            {avgNps !== null && (
              <span
                title={`Média de satisfação (NPS) da carteira — ${rated.length} cliente(s) com inquérito`}
                className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold"
                style={{
                  color: npsScoreColor(avgNps),
                  background: `${npsScoreColor(avgNps)}1a`,
                }}
              >
                <Star className="h-2.5 w-2.5" fill="currentColor" strokeWidth={0} />
                {avgNps.toFixed(1)}
              </span>
            )}
            {guarantees > 0 && (
              <span
                title={`${guarantees} cliente(s) com contrato de garantia de Premium Keywords`}
                className="inline-flex items-center gap-1 rounded-full bg-amber-400/[0.12] px-1.5 py-0.5 text-[10px] font-semibold text-amber-200"
              >
                <ShieldCheck className="h-2.5 w-2.5" />
                {guarantees}
              </span>
            )}
          </div>
        )}
      </header>
      <div className="space-y-4">
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
              <SeoPauseToggle slug={c.slug} title={c.title} paused={paused} />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
