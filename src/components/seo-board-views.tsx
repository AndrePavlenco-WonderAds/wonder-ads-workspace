"use client";

// As duas vistas da board do SEO DPT (v80.59), com um seletor por cima:
//
//   • Atual   — a fila de lanes (<SeoBoard/>, v80.58): desliza para o lado
//               quando os consultores não cabem.
//   • Plantel — uma carta de jogador por consultor (retrato 3:4, nome, NPS
//               médio). Tocar numa carta abre, por baixo da fila dela, uma
//               gaveta com os projetos em cartões grandes (à Google Imagens).
//               Escala com a equipa: as cartas são baixas e só uma gaveta
//               está aberta de cada vez.
//
// Por defeito o consultor vê o Plantel com a SUA gaveta já aberta; o
// SuperAdmin vê a Atual e, no Plantel, começa com tudo fechado. A escolha
// fica num cookie (`ws_seo_view`) para o servidor desenhar logo a vista
// certa na visita seguinte. Nasceu de um protótipo local com oito
// alternativas (Bento, Matriz, Carga, Órbita, Mapa, Colmeia…); ficou esta.

import Link from "next/link";
import { Fragment, useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowUpRight, IdCard, LayoutGrid, Star } from "lucide-react";
import { npsScoreColor } from "@/lib/nps-questions";
import { SEO_VIEW_COOKIE, type SeoBoardView } from "@/lib/seo-board-view";
import { ClientCard } from "./client-card";
import { SeoPauseToggle } from "./seo-pause-toggle";
import { ExtraConsultantsContext, SeoConsultantMigrate } from "./seo-consultant-migrate";
import { ConsultantAvatar, SeoBoard, averageNps, type SeoBoardColumn } from "./seo-board";


const VIEWS: Array<{ id: SeoBoardView; label: string; Icon: typeof LayoutGrid }> = [
  { id: "atual", label: "Atual", Icon: LayoutGrid },
  { id: "plantel", label: "Plantel", Icon: IdCard },
];

export function SeoBoardViews({
  columns,
  isAdmin,
  canReorder = false,
  extraConsultants = [],
  initialView,
  actions,
}: {
  columns: SeoBoardColumn[];
  isAdmin: boolean;
  canReorder?: boolean;
  extraConsultants?: string[];
  /** A vista que o servidor desenha: a do cookie, ou a de defeito do perfil. */
  initialView: SeoBoardView;
  /** Os atalhos do lado direito da faixa («IA no site», «Todos os consultores»). */
  actions?: ReactNode;
}) {
  const [view, setView] = useState<SeoBoardView>(initialView);

  function pick(v: SeoBoardView) {
    setView(v);
    document.cookie = `${SEO_VIEW_COOKIE}=${v}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
  }

  return (
    <ExtraConsultantsContext.Provider value={extraConsultants}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div role="tablist" aria-label="Vista da board" className="inline-flex rounded-full border border-white/12 bg-white/[0.03] p-1">
          {VIEWS.map(({ id, label, Icon }) => {
            const active = view === id;
            return (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => pick(id)}
                className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[12.5px] font-semibold transition ${
                  active ? "brand-gradient-bg text-white shadow-[0_6px_18px_-8px_rgba(120,61,245,0.9)]" : "text-white/55 hover:text-white"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
              </button>
            );
          })}
        </div>
        {actions && <div className="flex flex-wrap justify-end gap-2">{actions}</div>}
      </div>

      {view === "atual" ? (
        <SeoBoard columns={columns} isAdmin={isAdmin} canReorder={canReorder} extraConsultants={extraConsultants} />
      ) : (
        <SquadDrawer columns={columns} isAdmin={isAdmin} />
      )}
    </ExtraConsultantsContext.Provider>
  );
}

// ───────────────────────────────────────────────────────────── Plantel

const CARD_MIN = 190;
const GAP = 20;

function SquadDrawer({ columns, isAdmin }: { columns: SeoBoardColumn[]; isAdmin: boolean }) {
  // A carta de quem está a ver vem primeiro.
  const ordered = [...columns.filter((c) => c.isMine), ...columns.filter((c) => !c.isMine)];

  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(Math.round(e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // O consultor abre com a sua gaveta aberta; o SuperAdmin com tudo fechado.
  const mine = ordered.find((c) => c.isMine && c.clients.length > 0);
  const [open, setOpen] = useState<string | null>(mine?.name ?? null);

  // Cartas por fila (para a gaveta abrir por baixo da fila certa). Antes da
  // primeira medição, o número de colunas que cabe num portátil.
  const perRow = width
    ? Math.max(1, Math.min(ordered.length, Math.floor((width + GAP) / (CARD_MIN + GAP))))
    : Math.min(ordered.length, 6);
  const rows: SeoBoardColumn[][] = [];
  for (let i = 0; i < ordered.length; i += perRow) rows.push(ordered.slice(i, i + perRow));

  return (
    <div ref={ref} className="grid" style={{ gridTemplateColumns: `repeat(${perRow}, minmax(0, 1fr))`, gap: GAP }}>
      {rows.map((row, ri) => {
        const openCol = row.find((c) => c.name === open) ?? null;
        return (
          <Fragment key={ri}>
            {row.map((col) => (
              <PlayerCard
                key={col.name}
                col={col}
                active={col.name === open}
                onToggle={() => setOpen((cur) => (cur === col.name ? null : col.name))}
              />
            ))}
            {openCol && <Drawer col={openCol} isAdmin={isAdmin} onClose={() => setOpen(null)} />}
          </Fragment>
        );
      })}
    </div>
  );
}

function PlayerCard({ col, active, onToggle }: { col: SeoBoardColumn; active: boolean; onToggle: () => void }) {
  const { avg, rated } = averageNps(col.clients);
  const color = avg !== null ? npsScoreColor(avg) : "rgba(255,255,255,0.35)";
  const strong = Boolean(col.isMine) || active;
  return (
    <div className="relative">
      <section
        aria-label={`Carteira de ${col.name}`}
        className="group relative overflow-hidden rounded-[28px] p-[1.5px] transition hover:-translate-y-0.5"
        style={{
          background: strong
            ? "linear-gradient(160deg, #343ED7, #783DF5 50%, #C535C9)"
            : "linear-gradient(160deg, rgba(255,255,255,0.22), rgba(255,255,255,0.04) 45%, rgba(255,255,255,0.12))",
        }}
      >
        <div className="relative flex h-full flex-col overflow-hidden rounded-[27px] bg-[#0b0c14]">
          {/* A carta inteira abre/fecha a gaveta; o nome continua a levar
              ao roadmap (fica por cima do botão). */}
          <button
            type="button"
            onClick={onToggle}
            aria-expanded={active}
            aria-label={active ? `Fechar os projetos de ${col.name}` : `Abrir os projetos de ${col.name}`}
            className="absolute inset-0 z-[1] cursor-pointer"
          />
          {/* Retrato 3:4 — o recorte dos retratos da equipa, inteiro. */}
          <div className="relative aspect-[3/4] overflow-hidden">
            {col.avatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={col.avatar}
                alt=""
                className="h-full w-full object-cover object-top transition duration-500 group-hover:scale-[1.03]"
              />
            ) : (
              <div className="brand-gradient-bg flex h-full w-full items-center justify-center text-[64px] font-black text-white/90">
                {col.name.trim().charAt(0).toUpperCase()}
              </div>
            )}
            <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-[#0b0c14] via-[#0b0c14]/10 to-transparent" />
            <div
              aria-hidden
              className="absolute inset-0 opacity-35 mix-blend-soft-light"
              style={{ background: "linear-gradient(160deg, #343ED7, #783DF5 50%, #C535C9)" }}
            />
            <div className="absolute right-3 top-3 flex flex-col items-end gap-1">
              <Badges col={col} />
            </div>
          </div>
          <div className="relative -mt-8 px-3 text-center">
            <div className="relative z-[2] inline-flex max-w-full">
              <ConsultantName col={col} className="justify-center text-[16px] font-extrabold uppercase tracking-[0.06em] text-white" />
            </div>
            <span
              aria-hidden
              className="mx-auto mt-2 block h-px w-3/4"
              style={{ background: "linear-gradient(90deg, transparent, rgba(197,53,201,0.7), transparent)" }}
            />
          </div>
          <div
            className="mb-3.5 mt-2.5 flex items-center justify-center gap-2"
            title={avg !== null ? `NPS médio — ${rated} projeto${rated === 1 ? "" : "s"} com inquérito` : "Ainda sem NPS"}
          >
            <Star className="h-4 w-4" fill={avg !== null ? color : "none"} strokeWidth={avg !== null ? 0 : 1.5} style={{ color }} />
            <span className="tabular text-[28px] font-black leading-none" style={{ color: avg !== null ? "#fff" : color }}>
              {avg !== null ? avg.toFixed(1) : "—"}
            </span>
            <span className="text-[10px] font-bold uppercase tracking-[0.2em]" style={{ color }}>
              NPS
            </span>
          </div>
        </div>
      </section>
      {/* A seta que liga a carta aberta à gaveta. */}
      {active && (
        <span
          aria-hidden
          className="absolute -bottom-[14px] left-1/2 h-3 w-3 -translate-x-1/2 rotate-45 border-l border-t border-[#783DF5]/50 bg-[#100d20]"
        />
      )}
    </div>
  );
}

function Drawer({ col, isAdmin, onClose }: { col: SeoBoardColumn; isAdmin: boolean; onClose: () => void }) {
  return (
    <section
      aria-label={`Projetos de ${col.name}`}
      className="animate-fade-up rounded-3xl border border-[#783DF5]/40 bg-[#100d20] p-4 sm:p-5"
      style={{ gridColumn: "1 / -1" }}
    >
      <header className="mb-4 flex flex-wrap items-center gap-3">
        <ConsultantAvatar avatar={col.avatar} name={col.name} size="md" ring="ring-[#783DF5]/70" />
        <div className="min-w-0 flex-1">
          <ConsultantName col={col} className="text-[17px] font-bold tracking-tight text-white" />
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <span className="tabular rounded-full bg-white/[0.07] px-1.5 py-0.5 text-[10px] font-semibold text-white/65">
              {col.clients.length} {col.clients.length === 1 ? "projeto" : "projetos"}
            </span>
            <NpsAvg col={col} />
            <Badges col={col} />
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-full border border-white/12 px-3 py-1 text-[11.5px] font-medium text-white/60 transition hover:border-white/25 hover:text-white"
        >
          Fechar
        </button>
      </header>
      {col.clients.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-white/10 px-4 py-6 text-center text-[12px] text-white/35">
          Sem clientes ativos.
        </p>
      ) : (
        <div className="grid gap-3.5" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(232px, 1fr))" }}>
          {col.clients.map((c, i) => (
            <div key={c.slug} className="relative">
              <ClientCard
                title={c.title}
                icon={c.icon}
                logo={c.logo}
                logoBgMode={c.logoBgMode}
                logoSizing={c.logoSizing}
                href={`/seo/${c.slug}`}
                consultant={col.name}
                palette={c.palette}
                tier={c.tier}
                npsOverall={c.npsOverall}
                npsAt={c.npsAt}
                npsMonths={c.npsMonths}
                keywordGuarantee={c.keywordGuarantee}
                domain={c.domain}
                index={i}
                showArrow={false}
                showConsultant={false}
              />
              {/* Os botões do SuperAdmin, como na vista Atual. */}
              {isAdmin && (
                <>
                  <SeoConsultantMigrate slug={c.slug} title={c.title} currentConsultant={col.name} />
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

// ──────────────────────────────────────────────────────── peças comuns

function ConsultantName({ col, className }: { col: SeoBoardColumn; className: string }) {
  return col.roadmapHref ? (
    <Link
      href={col.roadmapHref}
      title={`Abrir o roadmap semanal de ${col.name}`}
      className={`group/name inline-flex max-w-full items-center gap-1.5 ${className}`}
    >
      <span className="truncate underline-offset-4 decoration-white/30 group-hover/name:underline">{col.name}</span>
      <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-white/40 transition group-hover/name:text-white" />
    </Link>
  ) : (
    <span className={`block truncate ${className}`}>{col.name}</span>
  );
}

function NpsAvg({ col }: { col: SeoBoardColumn }) {
  const { avg, rated } = averageNps(col.clients);
  return avg !== null ? (
    <span
      title={`Média de NPS — ${rated} cliente${rated === 1 ? "" : "s"} com inquérito`}
      className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10.5px] font-semibold tabular-nums"
      style={{ color: npsScoreColor(avg), background: `${npsScoreColor(avg)}1a` }}
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
  );
}

function Badges({ col }: { col: SeoBoardColumn }) {
  return (
    <>
      {col.newcomer && (
        <span className="whitespace-nowrap rounded-full border border-emerald-300/30 bg-emerald-400/[0.12] px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-[0.12em] text-emerald-200 backdrop-blur-sm">
          Novo
          {col.newcomer.startedAt && (
            <span className="font-semibold normal-case tracking-normal text-emerald-100/70">
              {" "}· {col.newcomer.startedAt.split("-").reverse().slice(0, 2).join("/")}
            </span>
          )}
        </span>
      )}
      {col.isMine && (
        <span className="whitespace-nowrap rounded-full border border-[#783DF5]/40 bg-[#783DF5]/[0.2] px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-[0.12em] text-[#d6c6ff] backdrop-blur-sm">
          A tua carteira
        </span>
      )}
    </>
  );
}
