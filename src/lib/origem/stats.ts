// Origem de Pacientes — as contas (puro: servidor e browser).
//
// Os registos guardam-se um a um (store.ts); o browser só recebe as
// contagens de cada mês, por clínica: por origem, por canal e por dia.

import type { OrigemClient } from "./config";
import { sourceIdOf } from "./config";

/** Um registo: uma pessoa nova, numa clínica, com uma origem. */
export type OrigemVote = {
  id: string;
  site: string;
  source: string;
  /** Como fez o contacto — opcional. */
  channel: string | null;
  /** Epoch ms, marcado no servidor. */
  at: number;
  /** «AAAA-MM» e dia do mês, em hora de Lisboa (marcados no servidor). */
  month: string;
  day: number;
  /** Aparelho que registou (id aleatório do browser) — só serve para anular. */
  device: string;
  /** «client» (o PIN) ou o username da equipa. */
  by: string;
};

/** As contagens de um mês numa clínica (ou somadas). */
export type SiteMonth = {
  total: number;
  source: Record<string, number>;
  /** «none» = sem canal indicado. */
  channel: Record<string, number>;
  /** Índice 0 = dia 1. */
  days: number[];
};

export type MonthStats = {
  month: string;
  sites: Record<string, SiteMonth>;
};

export const NO_CHANNEL = "none";

export function daysInMonth(month: string): number {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

export function emptySiteMonth(month: string): SiteMonth {
  return { total: 0, source: {}, channel: {}, days: Array.from({ length: daysInMonth(month) }, () => 0) };
}

/** As contagens de um mês a partir dos registos. */
export function monthStats(cfg: OrigemClient, month: string, votes: OrigemVote[]): MonthStats {
  const sites: Record<string, SiteMonth> = {};
  for (const s of cfg.sites) sites[s.id] = emptySiteMonth(month);
  for (const v of votes) {
    const site = sites[v.site];
    if (!site) continue;
    const src = sourceIdOf(cfg, v.source);
    const ch = v.channel && cfg.channels.some((c) => c.id === v.channel) ? v.channel : NO_CHANNEL;
    site.total += 1;
    site.source[src] = (site.source[src] ?? 0) + 1;
    site.channel[ch] = (site.channel[ch] ?? 0) + 1;
    if (v.day >= 1 && v.day <= site.days.length) site.days[v.day - 1] += 1;
  }
  return { month, sites };
}

/** Soma as clínicas pedidas (todas, se `siteId` for null). */
export function scopeOf(stats: MonthStats | undefined, month: string, siteId: string | null): SiteMonth {
  const out = emptySiteMonth(month);
  if (!stats) return out;
  for (const [id, s] of Object.entries(stats.sites)) {
    if (siteId && id !== siteId) continue;
    out.total += s.total;
    for (const [k, n] of Object.entries(s.source)) out.source[k] = (out.source[k] ?? 0) + n;
    for (const [k, n] of Object.entries(s.channel)) out.channel[k] = (out.channel[k] ?? 0) + n;
    s.days.forEach((n, i) => {
      if (i < out.days.length) out.days[i] += n;
    });
  }
  return out;
}

export const pct = (v: number, total: number) => (total ? Math.round((v / total) * 100) : 0);

/** As origens com mais registos (empates incluídos). */
export function leaders(cfg: OrigemClient, s: SiteMonth): OrigemClient["sources"] {
  const max = Math.max(0, ...cfg.sources.map((o) => s.source[o.id] ?? 0));
  return max ? cfg.sources.filter((o) => (s.source[o.id] ?? 0) === max) : [];
}

/** Quantos vieram de pesquisa (Google + IAs). */
export function searchCount(cfg: OrigemClient, s: SiteMonth): number {
  return cfg.sources.filter((o) => o.search).reduce((a, o) => a + (s.source[o.id] ?? 0), 0);
}

const MONTHS_PT = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const MONTHS_SHORT = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

/** «novembro de 2026». */
export function monthLabel(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return `${MONTHS_PT[m - 1]} de ${y}`;
}

/** «nov». */
export function monthShort(month: string): string {
  return MONTHS_SHORT[Number(month.split("-")[1]) - 1] ?? month;
}

/** Os meses de `from` a `to` (inclusive), do mais antigo para o mais recente. */
export function monthsBetween(from: string, to: string): string[] {
  const out: string[] = [];
  let [y, m] = from.split("-").map(Number);
  const [ty, tm] = to.split("-").map(Number);
  while ((y < ty || (y === ty && m <= tm)) && out.length < 120) {
    out.push(`${y}-${String(m).padStart(2, "0")}`);
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
  return out;
}

/** O mês e o dia de agora em hora de Lisboa. */
export function lisbonParts(ms: number): { month: string; day: number; date: string } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Lisbon",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(ms);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const month = `${get("year")}-${get("month")}`;
  return { month, day: Number(get("day")), date: `${month}-${get("day")}` };
}
