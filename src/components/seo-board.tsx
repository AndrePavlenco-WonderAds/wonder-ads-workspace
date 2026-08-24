"use client";

// Board de clientes do SEO DPT (v76.88) — o lado cliente da grelha de
// colunas por consultor. O servidor resolve tudo o que precisa de I/O
// (logos, NPS, garantia, domínio) e entrega dados serializáveis; aqui
// vive o que faz a board rápida de USAR:
//
//   • pesquisa instantânea (tecla «/» foca, Esc limpa), sem acentos
//   • filtros por tier e «só com garantia»
//   • cabeçalho de coluna com média de NPS e nº de garantias
//   • colunas vazias somem enquanto se filtra, com contagem X/Y
//
// SEM fotos dos consultores — decisão do André (24/08): as fotos ficam
// no header e no «Ver como…», a board mantém só os nomes.

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Search, ShieldCheck, Star, X } from "lucide-react";
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

const TIER_FILTERS: Array<{ key: ClientTier; label: string }> = [
  { key: "growth", label: "Growth" },
  { key: "core", label: "Core" },
  { key: "lite", label: "Lite" },
];

/** Comparação sem acentos nem maiúsculas — «clinica» encontra «Clínica». */
function norm(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export function SeoBoard({
  columns,
  isAdmin,
  paused = false,
}: {
  columns: SeoBoardColumn[];
  isAdmin: boolean;
  /** Secção de pausados: cartões esbatidos e sem barra de filtros. */
  paused?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [tiers, setTiers] = useState<Set<ClientTier>>(new Set());
  const [guaranteeOnly, setGuaranteeOnly] = useState(false);
  const searchRef = useRef<HTMLInputElement | null>(null);

  const filtering = query.trim().length > 0 || tiers.size > 0 || guaranteeOnly;

  // «/» foca a pesquisa a partir de qualquer sítio da página (menos de
  // dentro de outro campo); Esc dentro do campo limpa e desfoca.
  useEffect(() => {
    if (paused) return;
    function onKey(e: KeyboardEvent) {
      if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) return;
      if (t?.isContentEditable) return;
      e.preventDefault();
      searchRef.current?.focus();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [paused]);

  const q = norm(query.trim());
  const visible = useMemo(
    () =>
      columns
        .map((col) => ({
          ...col,
          matches: col.clients.filter((c) => {
            if (q && !norm(c.title).includes(q) && !norm(c.domain ?? "").includes(q)) {
              return false;
            }
            if (tiers.size > 0 && !tiers.has(c.tier)) return false;
            if (guaranteeOnly && !c.keywordGuarantee) return false;
            return true;
          }),
        }))
        .filter((col) => !filtering || col.matches.length > 0),
    [columns, q, tiers, guaranteeOnly, filtering],
  );

  const totalClients = columns.reduce((n, c) => n + c.clients.length, 0);
  const totalMatches = visible.reduce((n, c) => n + c.matches.length, 0);

  function toggleTier(t: ClientTier) {
    setTiers((cur) => {
      const next = new Set(cur);
      if (next.has(t)) next.delete(t);
      else next.add(t);
      return next;
    });
  }

  function clearFilters() {
    setQuery("");
    setTiers(new Set());
    setGuaranteeOnly(false);
  }

  return (
    <div>
      {!paused && (
        <div className="mb-8 flex flex-wrap items-center gap-2.5">
          <label className="group relative flex min-w-0 flex-1 items-center sm:max-w-xs">
            <Search className="pointer-events-none absolute left-3 h-3.5 w-3.5 text-white/35 transition group-focus-within:text-white/70" />
            <input
              ref={searchRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  setQuery("");
                  (e.target as HTMLInputElement).blur();
                }
              }}
              placeholder="Procurar cliente…  ( / )"
              aria-label="Procurar cliente"
              className="w-full rounded-full border border-white/12 bg-white/[0.04] py-2 pl-9 pr-8 text-sm text-white placeholder:text-white/30 outline-none transition focus:border-[color:var(--brand-purple)]/50 focus:bg-white/[0.06]"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                aria-label="Limpar pesquisa"
                className="absolute right-2.5 rounded-full p-0.5 text-white/40 transition hover:bg-white/10 hover:text-white"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </label>

          <div className="flex items-center gap-1.5">
            {TIER_FILTERS.map((t) => {
              const active = tiers.has(t.key);
              return (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => toggleTier(t.key)}
                  aria-pressed={active}
                  className={`rounded-full border px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] transition ${
                    active
                      ? "border-[color:var(--brand-purple)]/70 bg-[color:var(--brand-purple)]/20 text-white"
                      : "border-white/12 text-white/55 hover:border-white/30 hover:text-white/85"
                  }`}
                >
                  {t.label}
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => setGuaranteeOnly((v) => !v)}
              aria-pressed={guaranteeOnly}
              title="Só clientes com contrato de garantia de Premium Keywords"
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] transition ${
                guaranteeOnly
                  ? "border-amber-400/60 bg-amber-400/[0.14] text-amber-200"
                  : "border-white/12 text-white/55 hover:border-amber-400/40 hover:text-amber-200/85"
              }`}
            >
              <ShieldCheck className="h-3 w-3" />
              Garantia
            </button>
          </div>

          {filtering && (
            <span className="flex items-center gap-2 text-[11px] text-white/45">
              {totalMatches} de {totalClients} clientes
              <button
                type="button"
                onClick={clearFilters}
                className="rounded-full border border-white/12 px-2 py-0.5 font-medium text-white/60 transition hover:border-white/30 hover:text-white"
              >
                Limpar
              </button>
            </span>
          )}
        </div>
      )}

      {visible.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-white/12 bg-white/[0.02] px-4 py-14 text-center">
          <Search className="h-6 w-6 text-white/25" />
          <p className="text-sm text-white/50">
            Nenhum cliente corresponde a esta pesquisa.
          </p>
          <button
            type="button"
            onClick={clearFilters}
            className="rounded-full border border-white/15 px-4 py-1.5 text-xs font-medium text-white/70 transition hover:border-white/35 hover:text-white"
          >
            Limpar filtros
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {visible.map((col) => (
            <ColumnView
              key={col.name}
              column={col}
              matches={col.matches}
              filtering={filtering}
              isAdmin={isAdmin}
              paused={paused}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ColumnView({
  column,
  matches,
  filtering,
  isAdmin,
  paused,
}: {
  column: SeoBoardColumn;
  matches: SeoBoardCard[];
  filtering: boolean;
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
            {filtering ? `${matches.length}/${column.clients.length}` : column.clients.length}
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
        {matches.map((c, i) => (
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
