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
//
// v80.4 — apagar e repor. A equipa apaga um registo ou dá reset a um
// período; antes de tirar uma linha da lista, a cópia exata fica no
// histórico (`origem:<slug>:actions`, um campo por ação). Um SuperAdmin
// repõe: as linhas voltam à lista do mês delas. Nada se perde.

import "server-only";
import { kv } from "@vercel/kv";
import type { OrigemClient } from "./config";
import { lisbonParts, monthStats, monthsBetween, type MonthStats, type OrigemVote, type TodayVote } from "./stats";
import type { OrigemActionView, OrigemPeriod } from "./manage";

const kvConfigured = Boolean(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);
const memoryMode = !kvConfigured && process.env.NODE_ENV !== "production";
export const origemStoreReady = kvConfigured || memoryMode;

const votesKey = (slug: string, month: string) => `origem:${slug}:votes:${month}`;
/** Até quando se pode anular um registo (o ecrã mostra 20 s). */
export const UNDO_WINDOW_MS = 2 * 60 * 1000;
/** Quantos meses o relatório mostra para trás. */
export const HISTORY_MONTHS = 12;

const memory = ((globalThis as { __origemMemory?: Map<string, string[]> }).__origemMemory ??= new Map());
const memoryHash = ((globalThis as { __origemMemoryHash?: Map<string, Map<string, string>> }).__origemMemoryHash ??= new Map());

async function rpush(key: string, ...values: string[]) {
  if (!values.length) return;
  if (memoryMode) {
    memory.set(key, [...(memory.get(key) ?? []), ...values]);
    return;
  }
  await kv.rpush(key, ...values);
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
  return { stats: monthStats(cfg, month, votes), today: todayOf(votes, day) };
}

function todayOf(votes: OrigemVote[], day: number): TodayVote[] {
  return votes
    .filter((v) => v.day === day)
    .sort((a, b) => b.at - a.at)
    .slice(0, TODAY_LIMIT)
    .map((v) => ({ id: v.id, site: v.site, source: v.source, channel: v.channel, at: v.at }));
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

/** Todos os meses do relatório e os registos de hoje, cada mês lido uma vez
 *  (depois de apagar ou repor, o ecrã recebe tudo de novo). */
export async function getFullSnapshot(cfg: OrigemClient, now = Date.now()): Promise<{ history: MonthStats[]; today: TodayVote[] }> {
  const { month, day } = lisbonParts(now);
  const months = reportMonths(cfg, now);
  const lists = await Promise.all(months.map((m) => listMonthVotes(cfg.slug, m)));
  return {
    history: months.map((m, i) => monthStats(cfg, m, lists[i])),
    today: todayOf(lists[months.indexOf(month)] ?? [], day),
  };
}

/* ───────────────────── Apagar e repor (v80.4) ───────────────────── */

const actionsKey = (slug: string) => `origem:${slug}:actions`;
/** A Origem nasceu em novembro de 2026 — não há registos antes. */
const FIRST_MONTH = "2026-11";
/** Quantas ações o histórico mostra. */
const ACTIONS_SHOWN = 60;

type Actor = { username: string; name: string };

type StoredAction = {
  id: string;
  kind: "delete" | "reset";
  at: number;
  by: string;
  byName: string;
  /** Só no reset: hoje, o mês ou desde o início. */
  period: OrigemPeriod | null;
  /** null = todos os locais. */
  site: string | null;
  /** O mês e o dia de quando se apagou (Lisboa). */
  month: string;
  day: number;
  /** As linhas exatas que saíram da lista. */
  rows: string[];
  revertedAt: number | null;
  revertedBy: string | null;
  revertedByName: string | null;
};

async function hsetJson(key: string, field: string, value: object) {
  const text = JSON.stringify(value);
  if (memoryMode) {
    const h = memoryHash.get(key) ?? new Map<string, string>();
    h.set(field, text);
    memoryHash.set(key, h);
    return;
  }
  await kv.hset(key, { [field]: text });
}

async function hgetRaw(key: string, field: string): Promise<unknown> {
  if (memoryMode) return memoryHash.get(key)?.get(field) ?? null;
  return kv.hget<unknown>(key, field);
}

async function hgetAllRaw(key: string): Promise<unknown[]> {
  if (memoryMode) return [...(memoryHash.get(key)?.values() ?? [])];
  return Object.values((await kv.hgetall<Record<string, unknown>>(key)) ?? {});
}

async function hdel(key: string, field: string) {
  if (memoryMode) {
    memoryHash.get(key)?.delete(field);
    return;
  }
  await kv.hdel(key, field);
}

const memoryLocks = ((globalThis as { __origemLocks?: Set<string> }).__origemLocks ??= new Set());

/** true = ficou com a chave (ninguém está a fazer o mesmo). */
async function takeLock(key: string): Promise<boolean> {
  if (memoryMode) {
    if (memoryLocks.has(key)) return false;
    memoryLocks.add(key);
    return true;
  }
  return (await kv.set(key, 1, { nx: true, ex: 120 })) === "OK";
}

function parseAction(raw: unknown): StoredAction | null {
  let v = raw;
  if (typeof v === "string") {
    try {
      v = JSON.parse(v);
    } catch {
      return null;
    }
  }
  if (!v || typeof v !== "object") return null;
  const o = v as Partial<StoredAction>;
  if (typeof o.id !== "string" || (o.kind !== "delete" && o.kind !== "reset") || typeof o.at !== "number") return null;
  return {
    id: o.id,
    kind: o.kind,
    at: o.at,
    by: typeof o.by === "string" ? o.by : "",
    byName: typeof o.byName === "string" ? o.byName : "",
    period: o.period === "today" || o.period === "month" || o.period === "all" ? o.period : null,
    site: typeof o.site === "string" ? o.site : null,
    month: typeof o.month === "string" ? o.month : "",
    day: typeof o.day === "number" ? o.day : 0,
    rows: Array.isArray(o.rows) ? o.rows.filter((r): r is string => typeof r === "string") : [],
    revertedAt: typeof o.revertedAt === "number" ? o.revertedAt : null,
    revertedBy: typeof o.revertedBy === "string" ? o.revertedBy : null,
    revertedByName: typeof o.revertedByName === "string" ? o.revertedByName : null,
  };
}

/** Tira cada linha da lista; devolve quais saíram mesmo (uma já anulada no
 *  tablet entretanto não sai duas vezes). */
async function removeRows(key: string, rows: string[]): Promise<boolean[]> {
  if (!rows.length) return [];
  if (memoryMode) {
    const out: boolean[] = [];
    for (const r of rows) out.push((await lrem(key, r)) > 0);
    return out;
  }
  const p = kv.pipeline();
  for (const r of rows) p.lrem(key, 1, r);
  const res = (await p.exec()) as unknown[];
  return res.map((n) => Number(n) > 0);
}

async function removeVotes(
  slug: string,
  votes: OrigemVote[],
  meta: Pick<StoredAction, "kind" | "period" | "site">,
  actor: Actor,
): Promise<number> {
  if (!votes.length) return 0;
  const now = Date.now();
  const { month, day } = lisbonParts(now);
  const action: StoredAction = {
    id: `a-${now.toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    ...meta,
    at: now,
    by: actor.username,
    byName: actor.name,
    month,
    day,
    rows: votes.map(serialize),
    revertedAt: null,
    revertedBy: null,
    revertedByName: null,
  };
  // Primeiro a cópia: se a seguir alguma coisa falhar, o histórico já a tem.
  await hsetJson(actionsKey(slug), action.id, action);

  const byMonth = new Map<string, OrigemVote[]>();
  for (const v of votes) byMonth.set(v.month, [...(byMonth.get(v.month) ?? []), v]);
  const removed: string[] = [];
  for (const [m, group] of byMonth) {
    const rows = group.map(serialize);
    const ok = await removeRows(votesKey(slug, m), rows);
    rows.forEach((r, i) => ok[i] && removed.push(r));
  }
  if (removed.length !== action.rows.length) {
    if (removed.length) await hsetJson(actionsKey(slug), action.id, { ...action, rows: removed });
    else await hdel(actionsKey(slug), action.id);
  }
  return removed.length;
}

/** Apaga um registo (pelo id). Devolve quantos saíram (0 ou 1). */
export async function deleteVote(slug: string, id: string, actor: Actor): Promise<number> {
  const at = Number.parseInt(id.split("-")[1] ?? "", 36);
  const now = Date.now();
  const months = [...new Set([Number.isFinite(at) && at > 0 ? lisbonParts(at).month : null, lisbonParts(now).month])].filter(
    (m): m is string => Boolean(m),
  );
  for (const month of months) {
    const vote = (await listMonthVotes(slug, month)).find((v) => v.id === id);
    if (vote) return removeVotes(slug, [vote], { kind: "delete", period: null, site: vote.site }, actor);
  }
  return 0;
}

/** Os meses que um reset varre. */
function periodMonths(cfg: OrigemClient, period: OrigemPeriod, now: number): string[] {
  const current = lisbonParts(now).month;
  if (period !== "all") return [current];
  const start = cfg.startDay.slice(0, 7);
  return monthsBetween(start < FIRST_MONTH ? start : FIRST_MONTH, current);
}

/** Reset: apaga os registos de hoje, do mês ou de sempre, num local ou em todos. */
export async function resetVotes(cfg: OrigemClient, period: OrigemPeriod, site: string | null, actor: Actor): Promise<number> {
  const now = Date.now();
  const { day } = lisbonParts(now);
  const lists = await Promise.all(periodMonths(cfg, period, now).map((m) => listMonthVotes(cfg.slug, m)));
  const votes = lists.flat().filter((v) => (!site || v.site === site) && (period !== "today" || v.day === day));
  return removeVotes(cfg.slug, votes, { kind: "reset", period, site }, actor);
}

/** O histórico, do mais recente para o mais antigo (sem as linhas). */
export async function listActions(slug: string): Promise<OrigemActionView[]> {
  if (!origemStoreReady) return [];
  const all = (await hgetAllRaw(actionsKey(slug))).map(parseAction).filter((a): a is StoredAction => a !== null);
  return all
    .sort((a, b) => b.at - a.at)
    .slice(0, ACTIONS_SHOWN)
    .map((a) => {
      const votes = a.rows.map(parse).filter((v): v is OrigemVote => v !== null);
      const sites: Record<string, number> = {};
      const sources: Record<string, number> = {};
      for (const v of votes) {
        sites[v.site] = (sites[v.site] ?? 0) + 1;
        sources[v.source] = (sources[v.source] ?? 0) + 1;
      }
      const one = a.kind === "delete" ? votes[0] ?? null : null;
      return {
        id: a.id,
        kind: a.kind,
        at: a.at,
        byName: a.byName || a.by,
        period: a.period,
        site: a.site,
        count: votes.length,
        sites,
        sources,
        vote: one ? { site: one.site, source: one.source, channel: one.channel, at: one.at } : null,
        revertedAt: a.revertedAt,
        revertedByName: a.revertedByName,
      };
    });
}

/** Repõe o que uma ação apagou. */
export async function revertAction(slug: string, id: string, actor: Actor): Promise<"ok" | "missing" | "already"> {
  const action = parseAction(await hgetRaw(actionsKey(slug), id));
  if (!action) return "missing";
  if (action.revertedAt) return "already";
  // Dois toques seguidos (ou dois SuperAdmins) não repõem duas vezes.
  if (!(await takeLock(`origem:${slug}:revert-lock:${id}`))) return "already";

  const byMonth = new Map<string, string[]>();
  for (const row of action.rows) {
    const v = parse(row);
    if (v) byMonth.set(v.month, [...(byMonth.get(v.month) ?? []), row]);
  }
  for (const [m, rows] of byMonth) await rpush(votesKey(slug, m), ...rows);
  await hsetJson(actionsKey(slug), id, {
    ...action,
    revertedAt: Date.now(),
    revertedBy: actor.username,
    revertedByName: actor.name,
  });
  return "ok";
}
