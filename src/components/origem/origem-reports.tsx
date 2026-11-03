"use client";

// Origem de Pacientes — os relatórios: um mês de cada vez, todas as clínicas
// ou uma. Os meses são os do calendário (como o Monthly Report e o roadmap),
// em hora de Lisboa.

import { useMemo, useState } from "react";
import { motion } from "motion/react";
import { ChevronLeft, ChevronRight, Copy, Download, Sparkles } from "lucide-react";
import type { OrigemClient } from "@/lib/origem/config";
import {
  NO_CHANNEL,
  daysInMonth,
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
import { Panel, WA_GRADIENT } from "./origem-ui";

const SMALL_SAMPLE = 30;

function prevMonth(m: string): string {
  const [y, mo] = m.split("-").map(Number);
  return mo === 1 ? `${y - 1}-12` : `${y}-${String(mo - 1).padStart(2, "0")}`;
}

function signed(n: number, unit = ""): string {
  return `${n > 0 ? "+" : n < 0 ? "−" : ""}${Math.abs(n)}${unit}`;
}

export function OrigemReports({ cfg, history, now }: { cfg: OrigemClient; history: Record<string, MonthStats>; now: number }) {
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
  const siteName = scope ? cfg.sites.find((x) => x.id === scope)?.name ?? "" : null;
  const top = leaders(cfg, s);
  const search = searchCount(cfg, s);
  const change = p && p.total ? Math.round(((s.total - p.total) / p.total) * 100) : null;
  const today = lisbonParts(now);
  const daysLeft = isOpen ? daysInMonth(shown) - today.day : 0;

  const flash = (t: string) => {
    setNote(t);
    setTimeout(() => setNote((n) => (n === t ? null : n)), 2500);
  };

  function summary(): string {
    const lines = [
      `${cfg.brand} · Origem dos ${cfg.person.many}`,
      `${cap(monthLabel(shown))}${isOpen ? " (em curso)" : ""} · ${siteName ?? `Todas as ${cfg.place.many}`}`,
      `Total: ${s.total}${change !== null ? ` (${signed(change, "%")} face a ${monthLabel(prev)})` : ""}`,
      `Pesquisa e IA (Google + IAs): ${search} (${pct(search, s.total)}%)`,
      "",
      ...cfg.sources.map((o) => `${o.label}: ${s.source[o.id] ?? 0} (${pct(s.source[o.id] ?? 0, s.total)}%)`),
    ];
    if (!scope) {
      lines.push("", `Por ${cfg.place.one}:`);
      for (const site of cfg.sites) lines.push(`${site.name}: ${scopeOf(history[shown], shown, site.id).total}`);
    }
    return lines.join("\n");
  }

  function csv(): string {
    const q = (v: string | number) => (/[;"\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));
    const head = [cap(cfg.place.one), ...cfg.sources.map((o) => o.label), ...cfg.channels.map((c) => `Canal: ${c.label}`), "Canal: sem indicação", "Total"];
    const row = (name: string, x: SiteMonth) =>
      [name, ...cfg.sources.map((o) => x.source[o.id] ?? 0), ...cfg.channels.map((c) => x.channel[c.id] ?? 0), x.channel[NO_CHANNEL] ?? 0, x.total];
    const rows = [
      head,
      ...cfg.sites.map((site) => row(site.name, scopeOf(history[shown], shown, site.id))),
      row("Total", scopeOf(history[shown], shown, null)),
    ];
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

  const sortedSources = [...cfg.sources].sort((a, b) => (s.source[b.id] ?? 0) - (s.source[a.id] ?? 0));
  const channelRows = [...cfg.channels.map((c) => ({ id: c.id, label: c.label })), { id: NO_CHANNEL, label: "Sem indicação" }];
  const channelMax = Math.max(1, ...channelRows.map((c) => s.channel[c.id] ?? 0));
  const evolution = months.slice(-6);

  return (
    <div>
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#8CC2D0]">Relatórios</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-[42px] sm:leading-[1.1]">De onde vêm os {cfg.person.many}</h1>
        <p className="mt-2 text-sm text-white/55">Mês a mês, em hora de Lisboa. Os números do mês em curso atualizam-se sozinhos.</p>
      </div>

      {/* Mês e âmbito */}
      <div className="mt-7 flex flex-wrap items-center gap-3">
        <div className="flex items-center rounded-2xl border border-white/10 bg-white/[0.03] p-1">
          <button
            type="button"
            onClick={() => setMonth(months[idx - 1])}
            disabled={idx <= 0}
            className="rounded-xl p-2 text-white/60 transition hover:bg-white/10 hover:text-white disabled:opacity-25"
            aria-label="Mês anterior"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="min-w-[170px] px-2 text-center text-sm font-semibold">{cap(monthLabel(shown))}</span>
          <button
            type="button"
            onClick={() => setMonth(months[idx + 1])}
            disabled={idx >= months.length - 1}
            className="rounded-xl p-2 text-white/60 transition hover:bg-white/10 hover:text-white disabled:opacity-25"
            aria-label="Mês seguinte"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
        <span
          className={`rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] ${
            isOpen ? "bg-[#C9D22B]/15 text-[#DDE46A]" : "bg-white/[0.06] text-white/50"
          }`}
        >
          {isOpen ? "Em curso" : "Fechado"}
        </span>
        {cfg.sites.length > 1 && (
          <div className="flex flex-wrap rounded-2xl border border-white/10 bg-white/[0.03] p-1 sm:ml-auto">
            {[{ id: null as string | null, label: "Todas" }, ...cfg.sites.map((x) => ({ id: x.id as string | null, label: x.short }))].map((o) => (
              <button
                key={o.id ?? "all"}
                type="button"
                onClick={() => setScope(o.id)}
                className={`rounded-xl px-3.5 py-1.5 text-sm font-semibold transition ${
                  scope === o.id ? "bg-white/[0.1] text-white" : "text-white/50 hover:text-white/80"
                }`}
              >
                {o.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Números do mês */}
      <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile label={`${cap(cfg.person.many)} novos`} value={s.total.toLocaleString("pt-PT")}>
          {change !== null ? (
            <span className={change > 0 ? "text-emerald-300" : change < 0 ? "text-rose-300" : ""}>
              {signed(change, "%")} face a {monthShort(prev)}
            </span>
          ) : p ? (
            `sem registos em ${monthShort(prev)}`
          ) : (
            "primeiro mês de registos"
          )}
        </Tile>
        <Tile label="Principal origem" value={top.length ? top.map((o) => o.label).join(" e ") : "—"} small>
          {top.length ? `${pct(s.source[top[0].id] ?? 0, s.total)}% dos registos` : "à espera do primeiro registo"}
        </Tile>
        <Tile label="Pesquisa e IA" value={s.total ? `${pct(search, s.total)}%` : "—"} highlight>
          {search} {search === 1 ? "chegou" : "chegaram"} pelo Google ou por uma IA
        </Tile>
        <Tile label={isOpen ? "Até fechar o mês" : "Mês"} value={isOpen ? `${daysLeft} ${daysLeft === 1 ? "dia" : "dias"}` : "Fechado"}>
          {isOpen ? `fecha a ${daysInMonth(shown)} de ${monthShort(shown)}` : `${daysInMonth(shown)} dias registados`}
        </Tile>
      </div>

      {s.total > 0 && s.total < SMALL_SAMPLE && (
        <p className="mt-4 text-xs text-white/45">Menos de {SMALL_SAMPLE} registos: as percentagens ainda podem mudar bastante.</p>
      )}

      <div className="mt-6 grid gap-4 lg:grid-cols-[3fr_2fr]">
        <Panel title={siteName ? `Origens · ${siteName}` : `Origens · todas as ${cfg.place.many}`}>
          {s.total === 0 ? (
            <Empty cfg={cfg} isOpen={isOpen} />
          ) : (
            <div className="space-y-3.5">
              {sortedSources.map((o, i) => {
                const n = s.source[o.id] ?? 0;
                const share = pct(n, s.total);
                const delta = p && p.total ? share - pct(p.source[o.id] ?? 0, p.total) : null;
                return (
                  <div key={o.id} className="grid grid-cols-[minmax(0,150px)_1fr_auto] items-center gap-3 sm:grid-cols-[180px_1fr_auto]">
                    <span className="flex items-center gap-2 truncate text-sm text-white/80">
                      <i className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: o.color }} />
                      <span className="truncate">{o.label}</span>
                    </span>
                    <div className="h-3 overflow-hidden rounded-full bg-white/[0.06]">
                      <motion.div
                        className="h-full rounded-full"
                        style={{ background: o.color }}
                        initial={{ width: 0 }}
                        animate={{ width: `${(n / s.total) * 100}%` }}
                        transition={{ duration: 0.7, delay: 0.04 * i, ease: [0.16, 1, 0.3, 1] }}
                      />
                    </div>
                    <span className="flex w-[104px] items-baseline justify-end gap-2 text-right tabular-nums">
                      <strong className="text-sm">{share}%</strong>
                      <span className="text-xs text-white/40">{n}</span>
                      {delta !== null && (
                        <span className={`text-[11px] ${delta > 0 ? "text-emerald-300/80" : delta < 0 ? "text-rose-300/80" : "text-white/30"}`}>
                          {signed(delta)} pp
                        </span>
                      )}
                    </span>
                  </div>
                );
              })}
              {p && p.total > 0 && <p className="pt-1 text-[11px] text-white/35">pp: diferença em pontos percentuais face a {monthLabel(prev)}.</p>}
            </div>
          )}
        </Panel>

        <Panel title="Como fizeram o contacto">
          {s.total === 0 ? (
            <p className="text-sm text-white/40">Sem registos neste mês.</p>
          ) : (
            <div className="space-y-3">
              {channelRows.map((c) => {
                const n = s.channel[c.id] ?? 0;
                return (
                  <div key={c.id}>
                    <div className="mb-1 flex items-baseline justify-between text-sm">
                      <span className={c.id === NO_CHANNEL ? "text-white/45" : "text-white/80"}>{c.label}</span>
                      <span className="tabular-nums text-white/55">
                        {n} <span className="text-xs text-white/35">· {pct(n, s.total)}%</span>
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-white/[0.06]">
                      <motion.div
                        className="h-full rounded-full"
                        style={{ background: c.id === NO_CHANNEL ? "rgba(255,255,255,0.18)" : "linear-gradient(90deg,#3E7486,#8CC2D0)" }}
                        initial={{ width: 0 }}
                        animate={{ width: `${(n / channelMax) * 100}%` }}
                        transition={{ duration: 0.6 }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Panel>
      </div>

      <Panel title="Dia a dia" className="mt-4" aside={<span className="text-xs text-white/40">{s.total} registos em {monthLabel(shown)}</span>}>
        <DailyBars s={s} isOpen={isOpen} todayDay={today.day} />
      </Panel>

      {!scope && cfg.sites.length > 1 && (
        <Panel title={`Por ${cfg.place.one}`} className="mt-4">
          <div className="space-y-4">
            {cfg.sites
              .map((site) => ({ site, x: scopeOf(history[shown], shown, site.id) }))
              .sort((a, b) => b.x.total - a.x.total)
              .map(({ site, x }) => {
                const lead = leaders(cfg, x);
                return (
                  <button key={site.id} type="button" onClick={() => setScope(site.id)} className="block w-full rounded-2xl p-2 text-left transition hover:bg-white/[0.03]">
                    <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
                      <span className="font-semibold">{site.name}</span>
                      <span className="text-sm text-white/55">
                        <strong className="tabular-nums text-white">{x.total}</strong> registos
                        {lead.length > 0 && <> · principal: {lead.map((o) => o.label).join(" e ")}</>}
                      </span>
                    </div>
                    <StackBar cfg={cfg} x={x} />
                  </button>
                );
              })}
          </div>
          <Legend cfg={cfg} />
        </Panel>
      )}

      {evolution.length > 1 && (
        <Panel title="Evolução" className="mt-4" aside={<span className="text-xs text-white/40">últimos {evolution.length} meses</span>}>
          <Evolution cfg={cfg} history={history} months={evolution} scope={scope} active={shown} onPick={setMonth} />
          <Legend cfg={cfg} />
        </Panel>
      )}

      {s.total > 0 && (
        <div className="mt-6 flex flex-wrap items-center gap-2">
          <button type="button" onClick={copy} className="inline-flex items-center gap-2 rounded-xl border border-white/12 px-4 py-2.5 text-sm font-semibold text-white/80 transition hover:bg-white/[0.06]">
            <Copy className="h-4 w-4" /> Copiar resumo
          </button>
          <button type="button" onClick={download} className="inline-flex items-center gap-2 rounded-xl border border-white/12 px-4 py-2.5 text-sm font-semibold text-white/80 transition hover:bg-white/[0.06]">
            <Download className="h-4 w-4" /> Descarregar CSV
          </button>
          {note && <span className="text-sm text-white/50">{note}</span>}
        </div>
      )}
    </div>
  );
}

function Tile({ label, value, children, small, highlight }: { label: string; value: string; children: React.ReactNode; small?: boolean; highlight?: boolean }) {
  return (
    <div className={`relative overflow-hidden rounded-3xl border p-4 sm:p-5 ${highlight ? "border-violet-400/25 bg-violet-500/[0.06]" : "border-white/[0.07] bg-white/[0.025]"}`}>
      {highlight && <Sparkles className="absolute right-4 top-4 h-4 w-4 text-violet-300/60" />}
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/45">{label}</p>
      <p className={`mt-2 font-semibold tracking-tight ${small ? "text-lg leading-snug sm:text-xl" : "text-3xl sm:text-[34px]"}`}>
        {highlight ? <span className="brand-gradient-text">{value}</span> : value}
      </p>
      <p className="mt-1 text-xs text-white/45">{children}</p>
    </div>
  );
}

function Empty({ cfg, isOpen }: { cfg: OrigemClient; isOpen: boolean }) {
  return (
    <div className="rounded-2xl border border-dashed border-white/10 px-5 py-8 text-center">
      <p className="text-sm text-white/60">{isOpen ? "Ainda não há registos este mês." : "Não houve registos neste mês."}</p>
      {isOpen && (
        <p className="mt-1 text-xs text-white/40">
          Cada {cfg.person.one} registado no separador «Registar» aparece aqui de imediato.
        </p>
      )}
    </div>
  );
}

function StackBar({ cfg, x }: { cfg: OrigemClient; x: SiteMonth }) {
  return (
    <div className="flex h-3 overflow-hidden rounded-full bg-white/[0.06]">
      {x.total > 0 &&
        cfg.sources
          .filter((o) => (x.source[o.id] ?? 0) > 0)
          .map((o) => (
            <i
              key={o.id}
              title={`${o.label}: ${x.source[o.id]} (${pct(x.source[o.id] ?? 0, x.total)}%)`}
              style={{ flex: x.source[o.id], background: o.color }}
              className="block h-full border-r border-[#07080d]/60 last:border-0"
            />
          ))}
    </div>
  );
}

function Legend({ cfg }: { cfg: OrigemClient }) {
  return (
    <div className="mt-5 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-white/50">
      {cfg.sources.map((o) => (
        <span key={o.id} className="inline-flex items-center gap-1.5">
          <i className="h-2 w-2 rounded-full" style={{ background: o.color }} />
          {o.label}
        </span>
      ))}
    </div>
  );
}

function DailyBars({ s, isOpen, todayDay }: { s: SiteMonth; isOpen: boolean; todayDay: number }) {
  const max = Math.max(1, ...s.days);
  return (
    <div>
      <div className="flex h-28 items-end gap-[3px] sm:gap-1">
        {s.days.map((n, i) => {
          const future = isOpen && i + 1 > todayDay;
          const isToday = isOpen && i + 1 === todayDay;
          return (
            <div key={i} className="group relative flex h-full flex-1 items-end" title={`Dia ${i + 1}: ${n}`}>
              <motion.div
                className="w-full rounded-t-[4px]"
                style={{
                  background: isToday ? WA_GRADIENT : future ? "rgba(255,255,255,0.04)" : n ? "linear-gradient(180deg,#8CC2D0,#3E7486)" : "rgba(255,255,255,0.06)",
                }}
                initial={{ height: 0 }}
                animate={{ height: n ? `${Math.max(6, (n / max) * 100)}%` : "3px" }}
                transition={{ duration: 0.5, delay: 0.01 * i }}
              />
              {n > 0 && (
                <span className="pointer-events-none absolute -top-6 left-1/2 hidden -translate-x-1/2 rounded-md bg-white px-1.5 py-0.5 text-[10px] font-semibold text-black group-hover:block">
                  {n}
                </span>
              )}
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex justify-between text-[10px] tabular-nums text-white/30">
        <span>1</span>
        <span>{Math.ceil(s.days.length / 2)}</span>
        <span>{s.days.length}</span>
      </div>
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
    <div className="flex h-44 items-end gap-3 sm:gap-5">
      {data.map(({ m, x }) => (
        <button key={m} type="button" onClick={() => onPick(m)} className="flex h-full flex-1 flex-col items-center justify-end gap-2">
          <span className="text-xs font-semibold tabular-nums text-white/70">{x.total}</span>
          <div
            className={`flex w-full max-w-[56px] flex-col-reverse overflow-hidden rounded-xl ${m === active ? "ring-2 ring-white/40 ring-offset-2 ring-offset-[#0b0c12]" : ""}`}
            style={{ height: `${Math.max(3, (x.total / max) * 100)}%`, background: x.total ? undefined : "rgba(255,255,255,0.06)" }}
          >
            {cfg.sources.map((o) => {
              const n = x.source[o.id] ?? 0;
              return n ? <i key={o.id} style={{ flex: n, background: o.color }} className="block w-full" title={`${o.label}: ${n}`} /> : null;
            })}
          </div>
          <span className={`text-xs ${m === active ? "font-semibold text-white" : "text-white/40"}`}>{monthShort(m)}</span>
        </button>
      ))}
    </div>
  );
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
