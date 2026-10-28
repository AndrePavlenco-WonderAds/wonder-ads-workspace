"use client";

// Etiqueta «NPS · mês» do SEO DPT + painel em hover (v78.32), ao lado da do
// tráfego orgânico e com a mesma mecânica (OrganicPulse): a pílula mostra a
// média do mês em curso e quantos projetos já responderam; ao passar o rato
// (ou focar, ou tocar) abre por baixo o mês anterior e o atual — média e
// taxa de preenchimento — e os projetos que já responderam e os que faltam.
// Os que faltam vão numa grelha compacta, todos à vista e sem o consultor
// (v78.33); sem título nem rodapé, que o painel lê-se sozinho.
//
// O painel vai por portal para o <body>: o cabeçalho do departamento anima
// com transform, e um z-index lá dentro nunca passaria por cima da board.

import Link from "next/link";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowDownRight, ArrowUpRight, CheckCircle2, Clock, Smile } from "lucide-react";
import { formatLisbonDate } from "@/lib/dates";

export type NpsTeamMonth = {
  /** «2026-10». */
  key: string;
  /** «outubro». */
  name: string;
  /** Média da equipa (2 casas, cortada) — null sem respostas. */
  average: number | null;
  filled: number;
  total: number;
};

export type NpsTeamProject = {
  slug: string;
  name: string;
  consultant: string;
  score: number | null;
  answeredAt: number | null;
};

export type NpsTeamChipProps = {
  previous: NpsTeamMonth;
  current: NpsTeamMonth;
  /** Os projetos do mês em curso. */
  projects: NpsTeamProject[];
};

const CLOSE_DELAY_MS = 180;
const avg = (n: number | null) => (n === null ? "—" : n.toFixed(2).replace(".", ","));
const pct = (m: NpsTeamMonth) => (m.total ? Math.round((m.filled / m.total) * 100) : 0);
const first = (name: string) => name.trim().split(/\s+/)[0] ?? name;

function scoreTone(score: number): string {
  if (score >= 9) return "bg-emerald-400/15 text-emerald-200 border-emerald-400/30";
  if (score >= 7) return "bg-amber-400/15 text-amber-200 border-amber-400/30";
  return "bg-rose-500/15 text-rose-200 border-rose-400/35";
}

export function NpsTeamChip(props: NpsTeamChipProps) {
  const { current } = props;
  const id = useId().replace(/:/g, "");
  const panelId = `nps-team-panel-${id}`;
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLSpanElement>(null);
  const closeTimer = useRef<number | null>(null);

  const cancelClose = useCallback(() => {
    if (closeTimer.current !== null) {
      window.clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  }, []);
  const scheduleClose = useCallback(() => {
    cancelClose();
    closeTimer.current = window.setTimeout(() => setOpen(false), CLOSE_DELAY_MS);
  }, [cancelClose]);
  const openNow = useCallback(() => {
    cancelClose();
    setOpen(true);
  }, [cancelClose]);

  useEffect(() => cancelClose, [cancelClose]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const [anchor, setAnchor] = useState<{ top: number; left: number; width: number } | null>(null);
  const place = useCallback(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const chip = wrap.getBoundingClientRect();
    const vw = window.innerWidth;
    const width = Math.min(820, vw - 32);
    const left = Math.max(16, Math.min(chip.left, vw - width - 16));
    setAnchor({ top: chip.bottom + 12 + window.scrollY, left: left + window.scrollX, width });
  }, []);
  useEffect(() => {
    if (!open) return;
    place();
    window.addEventListener("resize", place);
    return () => window.removeEventListener("resize", place);
  }, [open, place]);

  return (
    <span
      ref={wrapRef}
      className="inline-flex"
      onMouseEnter={openNow}
      onMouseLeave={scheduleClose}
      onFocus={openNow}
      onBlur={(e) => {
        if (!wrapRef.current?.contains(e.relatedTarget as Node | null)) scheduleClose();
      }}
    >
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={`NPS médio da equipa em ${current.name}: ${avg(current.average)} — abrir detalhe`}
        onClick={() => setOpen((o) => !o)}
        className="animate-count-pop inline-flex cursor-default items-center gap-2.5 rounded-full border border-[#783DF5]/45 bg-[#783DF5]/[0.14] px-3 py-1.5 text-white backdrop-blur-md transition-all duration-300 hover:scale-[1.03] hover:border-[#a78bfa]/70 hover:bg-[#783DF5]/[0.22] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#a78bfa]/60"
      >
        <Smile className="h-3.5 w-3.5 text-[#c4a6ff]" strokeWidth={2.5} />
        <span className="text-base font-bold leading-none tracking-tight tabular-nums">{avg(current.average)}</span>
        <span className="text-base font-medium uppercase leading-none tracking-[0.16em] text-[#d9c8ff]/80">
          nps · {current.name.slice(0, 3)}
        </span>
        <span aria-hidden className="h-4 w-px bg-[#c4a6ff]/25" />
        <span className="text-sm font-semibold leading-none tabular-nums text-[#d9c8ff]">
          {current.filled}/{current.total}
        </span>
      </button>
      {open &&
        anchor &&
        createPortal(
          <NpsTeamPanel {...props} id={panelId} anchor={anchor} onEnter={openNow} onLeave={scheduleClose} />,
          document.body,
        )}
    </span>
  );
}

function MonthCard({ m, live, previous }: { m: NpsTeamMonth; live: boolean; previous?: NpsTeamMonth }) {
  const p = pct(m);
  const delta = previous && m.average !== null && previous.average !== null ? m.average - previous.average : null;
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 sm:p-5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[14px] font-semibold capitalize text-white">{m.name}</p>
        <span
          className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
            live ? "bg-amber-400/15 text-amber-200" : "bg-white/[0.06] text-white/55"
          }`}
        >
          {live ? "a decorrer" : "fechado"}
        </span>
      </div>
      <div className="mt-3 flex items-end gap-3">
        <span className="text-[2.4rem] font-semibold leading-none tracking-[-0.03em] tabular-nums text-white">{avg(m.average)}</span>
        {delta !== null && (
          <span className={`mb-1 inline-flex items-center gap-0.5 text-[13px] font-semibold tabular-nums ${delta >= 0 ? "text-emerald-300" : "text-rose-300"}`}>
            {delta >= 0 ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
            {Math.abs(delta).toFixed(2).replace(".", ",")}
          </span>
        )}
      </div>
      <p className="mt-1 text-[12.5px] text-white/50">média da equipa</p>

      <div className="mt-4">
        <div className="flex items-baseline justify-between text-[13px]">
          <span className={`font-semibold tabular-nums ${p >= 50 ? "text-emerald-300" : "text-rose-300"}`}>{p}% preenchido</span>
          <span className="tabular-nums text-white/50">
            {m.filled} de {m.total}
          </span>
        </div>
        <div className="relative mt-1.5 h-2 rounded-full bg-white/[0.07]">
          <div className="h-full rounded-full" style={{ width: `${p}%`, background: "var(--brand-gradient)" }} />
          {/* A meta dos 50% — abaixo disso não há bónus de equipa. */}
          <span aria-hidden className="absolute -top-1 bottom-[-4px] left-1/2 w-px bg-white/45" />
        </div>
        <p className="mt-1 text-right text-[11px] text-white/35">meta 50%</p>
      </div>
    </div>
  );
}

function NpsTeamPanel({
  id,
  previous,
  current,
  projects,
  anchor,
  onEnter,
  onLeave,
}: NpsTeamChipProps & {
  id: string;
  anchor: { top: number; left: number; width: number };
  onEnter: () => void;
  onLeave: () => void;
}) {
  const done = projects.filter((p) => p.score !== null).sort((a, b) => (b.answeredAt ?? 0) - (a.answeredAt ?? 0));
  const missing = projects.filter((p) => p.score === null).sort((a, b) => a.name.localeCompare(b.name, "pt"));

  return (
    <div
      id={id}
      role="group"
      aria-label="NPS da equipa — detalhe"
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      style={{ top: anchor.top, left: anchor.left, width: anchor.width }}
      className="organic-panel-in absolute z-[70] overflow-hidden rounded-[28px] border border-[#783DF5]/30 bg-[#0d0b16]/95 shadow-[0_40px_90px_-30px_rgba(0,0,0,0.85),0_30px_80px_-40px_rgba(120,61,245,0.55)] backdrop-blur-xl"
    >
      <div aria-hidden className="pointer-events-none absolute -right-32 -top-44 h-[22rem] w-[22rem] rounded-full opacity-25 blur-3xl" style={{ background: "var(--brand-gradient)" }} />
      <div className="relative p-5 sm:p-7">
        <div className="grid gap-3 sm:grid-cols-2">
          <MonthCard m={previous} live={false} />
          <MonthCard m={current} live previous={previous} />
        </div>

        <div className="mt-5 grid gap-5 md:grid-cols-2">
          <div>
            <p className="flex items-center gap-1.5 text-[13.5px] font-semibold text-white">
              <CheckCircle2 className="h-4 w-4 text-emerald-300" />
              Já responderam em {current.name} <span className="font-normal text-white/45">· {done.length}</span>
            </p>
            {done.length === 0 ? (
              <p className="mt-2 text-[13px] text-white/45">Ainda ninguém este mês.</p>
            ) : (
              <ul className="mt-2 max-h-64 divide-y divide-white/[0.06] overflow-y-auto pr-1">
                {done.map((p) => (
                  <li key={p.slug} className="flex items-center justify-between gap-3 py-2 text-[13px]">
                    <span className="min-w-0">
                      <Link href={`/seo/${p.slug}/nps`} className="block truncate text-white/85 hover:text-white hover:underline">
                        {p.name}
                      </Link>
                      <span className="text-[11.5px] text-white/40">
                        {first(p.consultant)}
                        {p.answeredAt !== null && ` · ${formatLisbonDate(p.answeredAt)}`}
                      </span>
                    </span>
                    <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[12px] font-semibold tabular-nums ${scoreTone(p.score ?? 0)}`}>
                      {(p.score ?? 0).toFixed(1).replace(".", ",")}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div>
            <p className="flex items-center gap-1.5 text-[13.5px] font-semibold text-white">
              <Clock className="h-4 w-4 text-rose-300" />
              Faltam responder <span className="font-normal text-white/45">· {missing.length}</span>
            </p>
            {missing.length === 0 ? (
              <p className="mt-2 text-[13px] text-emerald-300">Todos responderam este mês.</p>
            ) : (
              <ul className="mt-2 grid grid-cols-2 gap-x-4">
                {missing.map((p) => (
                  <li key={p.slug} className="min-w-0 border-b border-white/[0.06] py-1.5 text-[12.5px] leading-snug">
                    <Link href={`/seo/${p.slug}/nps`} title={p.name} className="block truncate text-white/80 hover:text-white hover:underline">
                      {p.name}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
