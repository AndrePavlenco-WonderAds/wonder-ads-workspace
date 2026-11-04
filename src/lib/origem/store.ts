// Origem de Pacientes — os registos em KV.
//
// Uma lista por cliente e por mês (`origem:<slug>:votes:<AAAA-MM>`), um
// registo por linha (rpush). Dois tablets a registar ao mesmo tempo nunca se
// pisam: cada toque é uma linha nova, sem ler-somar-gravar. Anular apaga a
// própria linha. O mês e o dia são marcados aqui, em hora de Lisboa — nunca
// pelo relógio do aparelho.
//
// Sem KV (desenvolvimento local com as variáveis apagadas), guarda em
// memória para se poder testar a página sem tocar na KV de produção.

import "server-only";
import { kv } from "@vercel/kv";
import type { OrigemClient } from "./config";
import { lisbonParts, monthStats, monthsBetween, type MonthStats, type OrigemVote, type TodayVote } from "./stats";

const kvConfigured = Boolean(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);
const memoryMode = !kvConfigured && process.env.NODE_ENV !== "production";
export const origemStoreReady = kvConfigured || memoryMode;

const votesKey = (slug: string, month: string) => `origem:${slug}:votes:${month}`;
/** Até quando se pode anular um registo (o ecrã mostra 20 s). */
export const UNDO_WINDOW_MS = 2 * 60 * 1000;
/** Quantos meses o relatório mostra para trás. */
export const HISTORY_MONTHS = 12;

const memory = ((globalThis as { __origemMemory?: Map<string, string[]> }).__origemMemory ??= new Map());

async function rpush(key: string, value: string) {
  if (memoryMode) {
    memory.set(key, [...(memory.get(key) ?? []), value]);
    return;
  }
  await kv.rpush(key, value);
}

async function lrange(key: string, start: number, end: number): Promise<unknown[]> {
  if (memoryMode) {
    const list = memory.get(key) ?? [];
    const s = start < 0 ? Math.max(0, list.length + start) : start;
    const e = end < 0 ? list.length + end : end;
    return list.slice(s, e + 1);
  }
  return kv.lrange<unknown>(key, start, end);
}

async function lrem(key: string, value: string): Promise<number> {
  if (memoryMode) {
    const list = memory.get(key) ?? [];
    const i = list.indexOf(value);
    if (i < 0) return 0;
    list.splice(i, 1);
    return 1;
  }
  return kv.lrem(key, 1, value);
}

function parse(raw: unknown): OrigemVote | null {
  let v = raw;
  if (typeof v === "string") {
    try {
      v = JSON.parse(v);
    } catch {
      return null;
    }
  }
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  if (typeof o.id !== "string" || typeof o.site !== "string" || typeof o.source !== "string") return null;
  if (typeof o.at !== "number" || typeof o.month !== "string" || typeof o.day !== "number") return null;
  return {
    id: o.id,
    site: o.site,
    source: o.source,
    channel: typeof o.channel === "string" ? o.channel : null,
    at: o.at,
    month: o.month,
    day: o.day,
    device: typeof o.device === "string" ? o.device : "",
    by: typeof o.by === "string" ? o.by : "client",
  };
}

/** O valor exato guardado — o Upstash devolve objetos já lidos, e o lrem
 *  precisa do texto igual ao que se guardou. */
const serialize = (v: OrigemVote) =>
  JSON.stringify({
    id: v.id,
    site: v.site,
    source: v.source,
    channel: v.channel,
    at: v.at,
    month: v.month,
    day: v.day,
    device: v.device,
    by: v.by,
  });

export async function addVote(
  slug: string,
  input: { site: string; source: string; channel: string | null; device: string; by: string },
): Promise<OrigemVote> {
  const now = Date.now();
  const { month, day } = lisbonParts(now);
  const vote: OrigemVote = {
    id: `o-${now.toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    ...input,
    at: now,
    month,
    day,
  };
  await rpush(votesKey(slug, month), serialize(vote));
  return vote;
}

/** Anula um registo recente do mesmo aparelho. Devolve false se já não der. */
export async function undoVote(slug: string, id: string, device: string): Promise<boolean> {
  const now = Date.now();
  // O registo pode ter caído no mês anterior se foi feito à meia-noite do dia 1.
  const months = [...new Set([lisbonParts(now).month, lisbonParts(now - UNDO_WINDOW_MS).month])];
  for (const month of months) {
    const key = votesKey(slug, month);
    const tail = (await lrange(key, -50, -1)).map(parse);
    const vote = tail.find((v) => v?.id === id);
    if (!vote) continue;
    if (vote.device !== device || now - vote.at > UNDO_WINDOW_MS) return false;
    return (await lrem(key, serialize(vote))) > 0;
  }
  return false;
}

export async function listMonthVotes(slug: string, month: string): Promise<OrigemVote[]> {
  if (!origemStoreReady) return [];
  const rows = await lrange(votesKey(slug, month), 0, -1);
  return rows.map(parse).filter((v): v is OrigemVote => v !== null);
}

export async function getMonthStats(cfg: OrigemClient, month: string): Promise<MonthStats> {
  return monthStats(cfg, month, await listMonthVotes(cfg.slug, month));
}

/** Quantos registos de hoje o ecrã recebe (todas as clínicas). */
const TODAY_LIMIT = 120;

/** O mês em curso numa só leitura: as contagens e os registos de hoje (do
 *  mais recente para o mais antigo, sem o id do aparelho). */
export async function getLiveSnapshot(cfg: OrigemClient, now = Date.now()): Promise<{ stats: MonthStats; today: TodayVote[] }> {
  const { month, day } = lisbonParts(now);
  const votes = await listMonthVotes(cfg.slug, month);
  const today = votes
    .filter((v) => v.day === day)
    .sort((a, b) => b.at - a.at)
    .slice(0, TODAY_LIMIT)
    .map((v) => ({ id: v.id, site: v.site, source: v.source, channel: v.channel, at: v.at }));
  return { stats: monthStats(cfg, month, votes), today };
}

/** Os meses que o relatório mostra: do arranque (ou 12 meses para trás) até hoje. */
export function reportMonths(cfg: OrigemClient, now = Date.now()): string[] {
  const current = lisbonParts(now).month;
  const all = monthsBetween(cfg.startDay.slice(0, 7), current);
  return all.length ? all.slice(-HISTORY_MONTHS) : [current];
}

export async function getHistory(cfg: OrigemClient, now = Date.now()): Promise<MonthStats[]> {
  const months = reportMonths(cfg, now);
  return Promise.all(months.map((m) => getMonthStats(cfg, m)));
}
