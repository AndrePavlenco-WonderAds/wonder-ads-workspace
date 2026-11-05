"use client";

// Origem de Pacientes — os relatórios (v78.69): um mês de cada vez, todas as
// clínicas ou uma. Os meses são os do calendário (como o Monthly Report e o
// roadmap), em hora de Lisboa.
//
// A frase de cima diz o mês numa linha; a «Pesquisa e IA» (Google + IAs) é o
// único número com o gradiente da WonderAds, porque é o que o SEO/GEO move.
// Cada origem tem sempre a mesma cor (config.ts), em todos os gráficos.

import { useMemo, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { ArrowDownRight, ArrowUpRight, ChevronDown, ChevronLeft, ChevronRight, Copy, Download, PenLine } from "lucide-react";
import type { OrigemClient } from "@/lib/origem/config";
import { placeWords, whereLabel } from "@/lib/origem/words";
import {
  NO_CHANNEL,
  dayLabel,
  daysInMonth,
  joinPt,
  leaders,
  lisbonParts,
  monthLabel,
  monthShort,
  pct,
  scopeOf,
  searchCount,
  type MonthStats,
  type SiteMonth,
} from "@/lib/origem/stats";
import { Sheet, WA_GRADIENT, cap } from "./origem-ui";

const SMALL_SAMPLE = 30;

function prevMonth(m: string): string {
  const [y, mo] = m.split("-").map(Number);
  return mo === 1 ? `${y - 1}-12` : `${y}-${String(mo - 1).padStart(2, "0")}`;
}

function signed(n: number, unit = ""): string {
  return `${n > 0 ? "+" : n < 0 ? "−" : ""}${Math.abs(n)}${unit}`;
}

export function OrigemReports({
  cfg,
  history,
  now,
  onRegister,
}: {
  cfg: OrigemClient;
  history: Record<string, MonthStats>;
  now: number;
  onRegister: () => void;
}) {
  const months = useMemo(() => Object.keys(history).sort(), [history]);
  const current = lisbonParts(now).month;
  const [month, setMonth] = useState(current);
  const [scope, setScope] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const idx = Math.max(0, months.indexOf(month));
  const shown = months[idx] ?? current;
  const prev = prevMonth(shown);
  const s = scopeOf(history[shown], shown, scope);
  const p = history[prev] ? scopeOf(history[prev], prev, scope) : null;
  const isOpen = shown === current;
  const site = scope ? cfg.sites.find((x) => x.id === scope) ?? null : null;
  const words = placeWords(cfg);
  const where = whereLabel(cfg, site);
  const top = leaders(cfg, s);
  const search = searchCount(cfg, s);
  const change = p && p.total ? Math.round(((s.total - p.total) / p.total) * 100) : null;
  const today = lisbonParts(now);
  const lastDay = daysInMonth(shown);

  const flash = (t: string) => {
    setNote(t);
    setTimeout(() => setNote((n) => (n === t ? null : n)), 2500);
  };

  function summary(): string {
    const lines = [
      `${cfg.brand}: origem dos ${cfg.person.many}`,
      `${cap(monthLabel(shown))}${isOpen ? " (em curso)" : ""}, ${site ? site.name : cfg.sites.length === 1 ? cfg.sites[0].name : `${words.all} ${words.the}s ${cfg.place.many}`}`,
      `Total: ${s.total}${change !== null ? ` (${signed(change, "%")} face a ${monthLabel(prev)})` : ""}`,
      `Pesquisa e IA (Google + IAs): ${search} (${pct(search, s.total)}%)`,
      "",
      ...cfg.sources.map((o) => `${o.label}: ${s.source[o.id] ?? 0} (${pct(s.source[o.id] ?? 0, s.total)}%)`),
    ];
    if (!scope && cfg.sites.length > 1) {
      lines.push("", `Por ${cfg.place.one}:`);
      for (const x of cfg.sites) lines.push(`${x.name}: ${scopeOf(history[shown], shown, x.id).total}`);
    }
    return lines.join("\n");
  }

  function csv(): string {
    const q = (v: string | number) => (/[;"\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));
    const head = [cap(cfg.place.one), ...cfg.sources.map((o) => o.label), ...cfg.channels.map((c) => `Canal: ${c.label}`), "Canal: sem indicação", "Total"];
    const row = (name: string, x: SiteMonth) =>
      [name, ...cfg.sources.map((o) => x.source[o.id] ?? 0), ...cfg.channels.map((c) => x.channel[c.id] ?? 0), x.channel[NO_CHANNEL] ?? 0, x.total];
    const rows = [head, ...cfg.sites.map((x) => row(x.name, scopeOf(history[shown], shown, x.id))), row("Total", scopeOf(history[shown], shown, null))];
    return "﻿" + rows.map((r) => r.map(q).join(";")).join("\r\n");
  }

  function download() {
    const url = URL.createObjectURL(new Blob([csv()], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `origem-${cfg.person.many}-${cfg.slug}-${shown}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    flash("Ficheiro descarregado.");
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(summary());
      flash("Resumo copiado.");
    } catch {
      flash("Não foi possível copiar neste aparelho.");
    }
  }

  const sorted = [...cfg.sources].sort((a, b) => (s.source[b.id] ?? 0) - (s.source[a.id] ?? 0));
  const channelRows = [...cfg.channels.map((c) => ({ id: c.id, label: c.label })), { id: NO_CHANNEL, label: "Sem indicação" }];
  const evolution = months.slice(-6);

  return (
    <div>
      {/* O mês e o âmbito */}
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-5">
        <div>
          <div className="flex items-center gap-1">
            <MonthArrow dir="prev" disabled={idx <= 0} onClick={() => setMonth(months[idx - 1])} />
            <h1 className="o-display min-w-0 whitespace-nowrap px-1 text-[26px] tracking-[-0.03em] min-[400px]:text-[30px] sm:text-[40px]">{cap(monthLabel(shown))}</h1>
            <MonthArrow dir="next" disabled={idx >= months.length - 1} onClick={() => setMonth(months[idx + 1])} />
          </div>
          <p className="mt-1 flex items-center gap-2 pl-1 text-[15px] text-[var(--o-muted)]">
            {isOpen ? (
              <>
                <span className="h-2 w-2 rounded-full bg-[var(--o-accent)] ring-4 ring-[var(--o-accent)]/20" aria-hidden />
                Em curso, fecha a {dayLabel(shown, lastDay)}. Atualiza sozinho.
              </>
            ) : (
              <>Mês fechado.</>
            )}
          </p>
        </div>

        {cfg.sites.length > 5 ? (
          // Muitos locais (lojas, salões, uma rede de clínicas): uma lista.
          <label className="relative inline-flex max-w-full">
            <span className="sr-only">{cap(cfg.place.one)}</span>
            <select
              value={scope ?? ""}
              onChange={(e) => setScope(e.target.value || null)}
              className="h-12 max-w-full appearance-none truncate rounded-[var(--o-pill)] bg-white pl-5 pr-11 text-[15px] font-bold text-[var(--o-ink)] outline-none ring-1 ring-[var(--o-line)] transition hover:ring-[var(--o-deep)] focus-visible:ring-2 focus-visible:ring-[var(--o-deep)]"
            >
              <option value="">
                {words.allCap} {words.the}s {cfg.place.many}
              </option>
              {cfg.sites.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.name}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--o-muted)]" aria-hidden />
          </label>
        ) : cfg.sites.length > 1 ? (
          <div className="flex max-w-full overflow-x-auto rounded-[var(--o-pill)] bg-white p-1 ring-1 ring-[var(--o-line)]" role="tablist" aria-label={cap(cfg.place.many)}>
            {[{ id: null as string | null, label: words.allCap }, ...cfg.sites.map((x) => ({ id: x.id as string | null, label: x.short }))].map((o) => {
              const on = scope === o.id;
              return (
                <button
                  key={o.id ?? "all"}
                  type="button"
                  role="tab"
                  aria-selected={on}
                  onClick={() => setScope(o.id)}
                  className={`whitespace-nowrap rounded-[var(--o-pill)] px-4 py-2 text-[14px] font-bold transition ${
                    on ? "bg-[var(--o-ink)] text-white" : "text-[var(--o-muted)] hover:text-[var(--o-ink)]"
                  }`}
                >
                  {o.label}
                </button>
              );
            })}
          </div>
        ) : null}
      </div>

      {/* A frase do mês */}
      <Sheet className="mt-7">
        {s.total === 0 ? (
          <div className="py-4 sm:py-6">
            <p className="o-display max-w-[24ch] text-[28px] leading-tight tracking-[-0.025em] sm:text-[36px]">
              {isOpen ? `Ainda não há registos em ${monthLabel(shown).split(" ")[0]}.` : `Não houve registos em ${monthLabel(shown).split(" ")[0]}.`}
            </p>
            {isOpen && (
              <>
                <p className="mt-3 max-w-[48ch] text-[16px] leading-relaxed text-[var(--o-muted)]">
                  Cada {cfg.person.one} registado {cfg.desk.at} aparece aqui no mesmo instante, com a origem e o canal.
                </p>
                <button
                  type="button"
                  onClick={onRegister}
                  className="mt-6 inline-flex h-12 items-center gap-2 rounded-[var(--o-pill)] bg-[var(--o-ink)] px-5 text-[15px] font-bold text-white transition hover:bg-[var(--o-deep)]"
                >
                  <PenLine className="h-4 w-4" /> Ir para o registo
                </button>
              </>
            )}
          </div>
        ) : (
          <>
            <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:gap-10">
              <div>
                <p className="flex items-end gap-3">
                  <span className="o-display text-[76px] leading-[0.85] tracking-[-0.05em] tabular-nums sm:text-[96px]">{s.total.toLocaleString("pt-PT")}</span>
                  <span className="pb-1 text-[19px] font-bold leading-tight">
                    {s.total === 1 ? `${cfg.person.one} novo` : `${cfg.person.many} novos`}
                    <span className="block text-[15px] font-medium text-[var(--o-muted)]">{where}</span>
                  </span>
                </p>
                <p className="mt-4 text-[15px] text-[var(--o-muted)]">
                  {change !== null ? (
                    <span className="inline-flex items-center gap-1">
                      <span className={`inline-flex items-center gap-0.5 font-bold ${change > 0 ? "text-[#1F7A4D]" : change < 0 ? "text-[#B8364A]" : "text-[var(--o-ink)]"}`}>
                        {change > 0 ? <ArrowUpRight className="h-4 w-4" /> : change < 0 ? <ArrowDownRight className="h-4 w-4" /> : null}
                        {signed(change, "%")}
                      </span>
                      face a {monthLabel(prev).split(" ")[0]}{isOpen ? ", até hoje" : ""}.
                    </span>
                  ) : p ? (
                    `Sem registos em ${monthLabel(prev).split(" ")[0]} para comparar.`
                  ) : (
                    "Primeiro mês de registos."
                  )}
                  {top.length > 0 && (
                    <>
                      {" "}
                      Mais comum: <strong className="font-bold text-[var(--o-ink)]">{joinPt(top.map((o) => o.label))}</strong>.
                    </>
                  )}
                </p>
              </div>

              <div className="relative overflow-hidden rounded-[calc(24px*var(--o-rs))] p-5 sm:p-6" style={{ background: "linear-gradient(120deg,rgba(52,62,215,.07),rgba(120,61,245,.08) 52%,rgba(197,53,201,.07))" }}>
                <p className="text-[15px] font-bold">Pesquisa e IA</p>
                <p className="o-display mt-1 text-[60px] leading-none tracking-[-0.04em] tabular-nums sm:text-[72px]">
                  <span style={{ background: WA_GRADIENT, WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" }}>{pct(search, s.total)}%</span>
                </p>
                <p className="mt-2 max-w-[38ch] text-[14.5px] leading-snug text-[var(--o-muted)]">
                  {search} {search === 1 ? "chegou" : "chegaram"} pelo Google ou por um assistente de IA, os canais que o SEO e o GEO da WonderAds trabalham.
                </p>
              </div>
            </div>

            <ShareBar cfg={cfg} x={s} className="mt-7 h-5" />
            <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2">
              {sorted.map((o) => (
                <span key={o.id} className="inline-flex items-center gap-2 text-[14px]">
                  <i className="h-2.5 w-2.5 rounded-full" style={{ background: o.color }} />
                  <span className="text-[var(--o-ink)]">{o.label}</span>
                  <span className="font-bold tabular-nums">{pct(s.source[o.id] ?? 0, s.total)}%</span>
                </span>
              ))}
            </div>
            {s.total < SMALL_SAMPLE && (
              <p className="mt-5 text-[13.5px] text-[var(--o-muted)]">Ainda são menos de {SMALL_SAMPLE} registos: as percentagens podem mudar bastante.</p>
            )}
          </>
        )}
      </Sheet>

      {s.total > 0 && (
        <>
          <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
            <Sheet title="De onde vieram" aside={p && p.total > 0 ? `diferença face a ${monthShort(prev)} em pontos percentuais` : undefined}>
              <ul className="space-y-3.5">
                {sorted.map((o, i) => {
                  const n = s.source[o.id] ?? 0;
                  const share = pct(n, s.total);
                  const delta = p && p.total ? share - pct(p.source[o.id] ?? 0, p.total) : null;
                  return (
                    <li key={o.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1.5 sm:grid-cols-[176px_minmax(0,1fr)_auto] sm:gap-x-4">
                      <span className="flex min-w-0 items-center gap-2 text-[15px]">
                        <i className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: o.color }} />
                        <span className="truncate">{o.label}</span>
                      </span>
                      <div className="order-3 col-span-2 sm:order-none sm:col-span-1">
                        <Bar value={n} max={Math.max(1, s.source[sorted[0].id] ?? 0)} color={o.color} delay={0.04 * i} />
                      </div>
                      <span className="flex w-[118px] items-baseline justify-end gap-2 tabular-nums">
                        <strong className="text-[16px] font-extrabold">{share}%</strong>
                        <span className="text-[13px] text-[var(--o-muted)]">{n}</span>
                        {delta !== null && (
                          <span className={`w-10 text-right text-[12.5px] font-semibold ${delta > 0 ? "text-[#1F7A4D]" : delta < 0 ? "text-[#B8364A]" : "text-[var(--o-muted)]"}`}>
                            {signed(delta)}
                          </span>
                        )}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </Sheet>

            <Sheet title="Como entraram em contacto">
              <ul className="space-y-3.5">
                {channelRows.map((c) => {
                  const n = s.channel[c.id] ?? 0;
                  const none = c.id === NO_CHANNEL;
                  return (
                    <li key={c.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1.5 sm:grid-cols-[minmax(0,118px)_minmax(0,1fr)_auto]">
                      <span className={`truncate text-[15px] ${none ? "text-[var(--o-muted)]" : ""}`}>{c.label}</span>
                      <div className="order-3 col-span-2 sm:order-none sm:col-span-1">
                        <Bar value={n} max={Math.max(1, ...channelRows.map((r) => s.channel[r.id] ?? 0))} color={none ? "var(--o-line-strong)" : "var(--o-deep)"} />
                      </div>
                      <span className="flex w-[74px] items-baseline justify-end gap-2 tabular-nums">
                        <strong className="text-[16px] font-extrabold">{pct(n, s.total)}%</strong>
                        <span className="text-[13px] text-[var(--o-muted)]">{n}</span>
                      </span>
                    </li>
                  );
                })}
              </ul>
            </Sheet>
          </div>

          <Sheet title="Dia a dia" aside={`${s.total} ${s.total === 1 ? "registo" : "registos"}`} className="mt-5">
            <DailyColumns month={shown} s={s} isOpen={isOpen} todayDay={today.day} />
          </Sheet>
        </>
      )}

      {(cfg.sites.length > 1 && !scope && s.total > 0) || evolution.length > 1 ? (
        <div className={`mt-5 grid gap-5 ${cfg.sites.length > 1 && !scope && s.total > 0 && evolution.length > 1 ? "lg:grid-cols-2" : ""}`}>
          {cfg.sites.length > 1 && !scope && s.total > 0 && (
            <Sheet title={`Por ${cfg.place.one}`}>
              <ul className="space-y-5">
                {cfg.sites
                  .map((x) => ({ x, m: scopeOf(history[shown], shown, x.id) }))
                  .sort((a, b) => b.m.total - a.m.total)
                  .map(({ x, m }) => {
                    const lead = leaders(cfg, m);
                    return (
                      <li key={x.id}>
                        <button type="button" onClick={() => setScope(x.id)} className="group block w-full text-left">
                          <span className="mb-2 flex flex-wrap items-baseline justify-between gap-x-3">
                            <span className="text-[16px] font-bold group-hover:text-[var(--o-deep)] group-hover:underline group-hover:underline-offset-4">{x.name}</span>
                            <span className="text-[14px] text-[var(--o-muted)]">
                              <strong className="text-[16px] font-extrabold tabular-nums text-[var(--o-ink)]">{m.total}</strong>
                              {lead.length > 0 ? `, mais comum: ${joinPt(lead.map((o) => o.label))}` : ""}
                            </span>
                          </span>
                          <ShareBar cfg={cfg} x={m} className="h-3.5" />
                        </button>
                      </li>
                    );
                  })}
              </ul>
            </Sheet>
          )}
          {evolution.length > 1 && (
            <Sheet title="Evolução" aside={`últimos ${evolution.length} meses`}>
              <Evolution cfg={cfg} history={history} months={evolution} scope={scope} active={shown} onPick={setMonth} />
            </Sheet>
          )}
        </div>
      ) : null}

      {s.total > 0 && (
        <div className="mt-7 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={copy}
            className="inline-flex h-12 items-center gap-2 rounded-[var(--o-pill)] bg-[var(--o-ink)] px-5 text-[15px] font-bold text-white transition hover:bg-[var(--o-deep)]"
          >
            <Copy className="h-4 w-4" /> Copiar resumo
          </button>
          <button
            type="button"
            onClick={download}
            className="inline-flex h-12 items-center gap-2 rounded-[var(--o-pill)] bg-white px-5 text-[15px] font-bold ring-1 ring-[var(--o-line)] transition hover:ring-[var(--o-deep)]"
          >
            <Download className="h-4 w-4" /> Descarregar CSV
          </button>
          {note && (
            <span className="text-[14px] font-semibold text-[var(--o-deep)]" role="status">
              {note}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

function MonthArrow({ dir, disabled, onClick }: { dir: "prev" | "next"; disabled: boolean; onClick: () => void }) {
  const Icon = dir === "prev" ? ChevronLeft : ChevronRight;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[var(--o-ink)] transition hover:bg-white hover:ring-1 hover:ring-[var(--o-line)] disabled:pointer-events-none disabled:opacity-25"
      aria-label={dir === "prev" ? "Mês anterior" : "Mês seguinte"}
    >
      <Icon className="h-6 w-6" />
    </button>
  );
}

/** Uma barra horizontal: 14 px, ponta arredondada, base reta. */
function Bar({ value, max, color, delay = 0 }: { value: number; max: number; color: string; delay?: number }) {
  const reduce = useReducedMotion();
  const w = value ? Math.max(1.5, (value / max) * 100) : 0;
  return (
    <div className="relative h-[14px] rounded-r-[4px] bg-[var(--o-paper)]">
      <motion.div
        className="absolute inset-y-0 left-0 rounded-r-[4px]"
        style={{ background: color }}
        initial={reduce ? false : { width: 0 }}
        animate={{ width: `${w}%` }}
        transition={{ duration: 0.6, delay, ease: [0.16, 1, 0.3, 1] }}
      />
    </div>
  );
}

/** As origens lado a lado, com 2 px de papel entre cada uma. */
function ShareBar({ cfg, x, className = "" }: { cfg: OrigemClient; x: SiteMonth; className?: string }) {
  if (!x.total) return <div className={`rounded-full bg-[var(--o-paper)] ${className}`} />;
  return (
    <div className={`flex gap-[2px] overflow-hidden rounded-full ${className}`} role="img" aria-label={cfg.sources.map((o) => `${o.label} ${pct(x.source[o.id] ?? 0, x.total)}%`).join(", ")}>
      {cfg.sources
        .filter((o) => (x.source[o.id] ?? 0) > 0)
        .map((o) => (
          <span key={o.id} title={`${o.label}: ${x.source[o.id]} (${pct(x.source[o.id] ?? 0, x.total)}%)`} className="block h-full" style={{ flex: x.source[o.id], background: o.color }} />
        ))}
    </div>
  );
}

const WEEKDAY = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

function DailyColumns({ month, s, isOpen, todayDay }: { month: string; s: SiteMonth; isOpen: boolean; todayDay: number }) {
  const reduce = useReducedMotion();
  const max = Math.max(1, ...s.days);
  const [y, m] = month.split("-").map(Number);
  const [hover, setHover] = useState<number | null>(null);
  const peak = s.days.indexOf(max);
  return (
    <div>
      <div className="relative mt-8 flex h-40 items-end gap-[2px] border-b border-[var(--o-line)] sm:gap-1" onMouseLeave={() => setHover(null)}>
        {s.days.map((n, i) => {
          const day = i + 1;
          const future = isOpen && day > todayDay;
          const isToday = isOpen && day === todayDay;
          const wd = new Date(Date.UTC(y, m - 1, day)).getUTCDay();
          const showLabel = hover === i || (hover === null && i === peak && n > 0);
          return (
            <button
              key={i}
              type="button"
              className="relative flex h-full flex-1 items-end justify-center outline-none"
              onMouseEnter={() => setHover(i)}
              onFocus={() => setHover(i)}
              onBlur={() => setHover(null)}
              aria-label={`${WEEKDAY[wd]} ${dayLabel(month, day)}: ${n}`}
              tabIndex={n ? 0 : -1}
            >
              <motion.span
                className="block w-full max-w-[24px] rounded-t-[4px]"
                style={{
                  background: isToday ? "var(--o-accent)" : future ? "transparent" : n ? "var(--o-deep)" : "var(--o-line)",
                  opacity: hover !== null && hover !== i ? 0.45 : 1,
                }}
                initial={reduce ? false : { height: 0 }}
                animate={{ height: n ? `${Math.max(4, (n / max) * 100)}%` : future ? 0 : 2 }}
                transition={{ duration: 0.5, delay: reduce ? 0 : 0.008 * i }}
              />
              {showLabel && (
                <span className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 -translate-x-1/2 whitespace-nowrap rounded-lg bg-[var(--o-ink)] px-2 py-1 text-[12px] font-bold text-white">
                  {n} <span className="font-medium text-white/60">{WEEKDAY[wd]} {day}</span>
                </span>
              )}
            </button>
          );
        })}
      </div>
      <div className="mt-2 flex gap-[2px] sm:gap-1" aria-hidden>
        {s.days.map((_, i) => {
          const day = i + 1;
          const show = day === 1 || day % 7 === 1 || day === s.days.length;
          return (
            <span key={i} className={`flex-1 text-center text-[11px] tabular-nums ${isOpen && day === todayDay ? "font-extrabold text-[var(--o-ink)]" : "text-[var(--o-muted)]"}`}>
              {show || (isOpen && day === todayDay) ? day : ""}
            </span>
          );
        })}
      </div>
      {isOpen && (
        <p className="mt-3 flex items-center gap-2 text-[13px] text-[var(--o-muted)]">
          <i className="h-2.5 w-2.5 rounded-sm bg-[var(--o-accent)]" /> Hoje
        </p>
      )}
    </div>
  );
}

function Evolution({
  cfg,
  history,
  months,
  scope,
  active,
  onPick,
}: {
  cfg: OrigemClient;
  history: Record<string, MonthStats>;
  months: string[];
  scope: string | null;
  active: string;
  onPick: (m: string) => void;
}) {
  const data = months.map((m) => ({ m, x: scopeOf(history[m], m, scope) }));
  const max = Math.max(1, ...data.map((d) => d.x.total));
  return (
    <div>
      <div className="flex h-48 items-end gap-3 border-b border-[var(--o-line)] sm:gap-5">
        {data.map(({ m, x }) => (
          <button key={m} type="button" onClick={() => onPick(m)} className="group flex h-full flex-1 flex-col items-center justify-end gap-2" aria-label={`${monthLabel(m)}: ${x.total}`}>
            <span className={`text-[13px] font-extrabold tabular-nums ${m === active ? "text-[var(--o-ink)]" : "text-[var(--o-muted)]"}`}>{x.total}</span>
            <span
              className={`flex w-full max-w-[44px] flex-col-reverse gap-[2px] overflow-hidden rounded-t-[6px] transition ${m === active ? "" : "opacity-70 group-hover:opacity-100"}`}
              style={{ height: `${Math.max(2, (x.total / max) * 100)}%`, background: x.total ? undefined : "var(--o-line)" }}
            >
              {cfg.sources.map((o) => {
                const n = x.source[o.id] ?? 0;
                return n ? <i key={o.id} style={{ flex: n, background: o.color }} className="block w-full" title={`${o.label}: ${n}`} /> : null;
              })}
            </span>
          </button>
        ))}
      </div>
      <div className="mt-2 flex gap-3 sm:gap-5">
        {data.map(({ m }) => (
          <span key={m} className={`flex-1 text-center text-[13px] ${m === active ? "font-extrabold text-[var(--o-ink)]" : "text-[var(--o-muted)]"}`}>
            {monthShort(m)}
          </span>
        ))}
      </div>
    </div>
  );
}
