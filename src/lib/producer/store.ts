// Producer of the Month — as eleições da direção (v78.58).
//
// Uma chave só, `producer:elections` = { "2026-10": ProducerElection, … }:
// escreve-se uma vez por mês e lê-se de uma vez para o menu (o pódio do mês
// mais recente) e para as medalhas (quantas vezes cada um foi eleito).
//
// A leitura do menu corre em todas as páginas, por isso passa pela cache de
// dados (tag `producer-elections`), que a eleição invalida.

import "server-only";
import { kv } from "@vercel/kv";
import { unstable_cache } from "next/cache";
import { MAX_PRODUCER_NOTE, isMonthKey, type ProducerElection, type ProducerPlace, type ProducerRow } from "./shared";

const KEY = "producer:elections";
export const PRODUCER_CACHE_TAG = "producer-elections";

const configured = Boolean(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);

function str(v: unknown, max: number): string {
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}

function sanitizePlace(raw: unknown): ProducerPlace | null {
  const o = (raw ?? {}) as Record<string, unknown>;
  const username = str(o.username, 60);
  return username ? { username, name: str(o.name, 80) || username } : null;
}

function sanitize(month: string, raw: unknown): ProducerElection | null {
  const o = (raw ?? {}) as Record<string, unknown>;
  const podium = (Array.isArray(o.podium) ? o.podium : []).map(sanitizePlace).filter((p): p is ProducerPlace => p !== null);
  if (podium.length === 0) return null;
  return {
    month,
    podium: podium.slice(0, 3),
    note: str(o.note, MAX_PRODUCER_NOTE),
    electedBy: str(o.electedBy, 60),
    electedByName: str(o.electedByName, 80),
    electedAt: typeof o.electedAt === "number" ? o.electedAt : 0,
    snapshot: Array.isArray(o.snapshot) ? (o.snapshot as ProducerRow[]) : [],
  };
}

/** Todas as eleições, do mês mais recente para o mais antigo. */
export async function listElections(): Promise<ProducerElection[]> {
  if (!configured) return [];
  const raw = await kv.get<Record<string, unknown>>(KEY);
  if (!raw || typeof raw !== "object") return [];
  return Object.entries(raw)
    .filter(([m]) => isMonthKey(m))
    .map(([m, v]) => sanitize(m, v))
    .filter((e): e is ProducerElection => e !== null)
    .sort((a, b) => b.month.localeCompare(a.month));
}

export async function getElection(month: string): Promise<ProducerElection | null> {
  return (await listElections()).find((e) => e.month === month) ?? null;
}

export async function saveElection(e: ProducerElection): Promise<void> {
  if (!configured) throw new Error("KV não configurado.");
  const raw = ((await kv.get<Record<string, unknown>>(KEY)) ?? {}) as Record<string, unknown>;
  await kv.set(KEY, { ...raw, [e.month]: e });
}

export async function deleteElection(month: string): Promise<boolean> {
  if (!configured) return false;
  const raw = ((await kv.get<Record<string, unknown>>(KEY)) ?? {}) as Record<string, unknown>;
  if (!(month in raw)) return false;
  const next = { ...raw };
  delete next[month];
  await kv.set(KEY, next);
  return true;
}

/** O que o menu e as medalhas precisam: as eleições sem o levantamento. */
export type ElectionSummary = Omit<ProducerElection, "snapshot">;

const cachedSummaries = unstable_cache(
  async (): Promise<ElectionSummary[]> =>
    (await listElections()).map((e) => ({
      month: e.month,
      podium: e.podium,
      note: e.note,
      electedBy: e.electedBy,
      electedByName: e.electedByName,
      electedAt: e.electedAt,
    })),
  ["producer-elections-v1"],
  { tags: [PRODUCER_CACHE_TAG], revalidate: 3600 },
);

/** As eleições sem o levantamento, em cache (invalidada ao eleger). Nunca
 *  lança: o menu não pode travar uma página. Uma falha do KV não fica em
 *  cache — o erro sai da função guardada e é apanhado aqui. */
export async function getElectionSummaries(): Promise<ElectionSummary[]> {
  try {
    return await cachedSummaries();
  } catch (err) {
    console.error("producer: leitura das eleições falhou:", err instanceof Error ? err.message : err);
    return [];
  }
}
