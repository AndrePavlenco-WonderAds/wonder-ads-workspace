// Folga de custos — leitura e escrita em KV (`seo-folga:<slug>`), v78.37.
// As regras e as contas vivem em `seo-folga.ts`; aqui só se guarda.
//
// Só se acrescenta: um extra novo, uma anulação (o extra fica, marcado) ou
// uma mudança da folga mensal (fica o histórico). Nada se apaga, para o
// registo do projeto contar sempre a história inteira.

import "server-only";
import { kv } from "@vercel/kv";
import {
  EMPTY_FOLGA,
  FOLGA_CATEGORIES,
  FOLGA_KINDS,
  type FolgaAllowance,
  type FolgaCategory,
  type FolgaEntry,
  type FolgaKind,
  type FolgaLink,
  type FolgaPerson,
  type FolgaRecord,
} from "@/lib/seo-folga";

const KEY_PREFIX = "seo-folga:";

export const folgaStorageConfigured = Boolean(
  process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN,
);

const key = (slug: string) => `${KEY_PREFIX}${slug}`;
const str = (v: unknown) => (typeof v === "string" ? v : "");
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);

function person(raw: unknown): FolgaPerson {
  const o = (raw ?? {}) as Record<string, unknown>;
  return { username: str(o.username), name: str(o.name) || str(o.username) };
}

function normalizeLink(raw: unknown): FolgaLink | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if ((o.kind !== "task" && o.kind !== "ticket") || !str(o.id)) return null;
  return { kind: o.kind, id: str(o.id), label: str(o.label) || str(o.id) };
}

function normalizeEntry(raw: unknown): FolgaEntry | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const date = str(o.date);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !str(o.id) || !(num(o.eur) > 0)) return null;
  const category = FOLGA_CATEGORIES.some((c) => c.id === o.category) ? (o.category as FolgaCategory) : "outro";
  const kind = (FOLGA_KINDS as readonly string[]).includes(str(o.kind)) ? (o.kind as FolgaKind) : "folga";
  const v = o.voided as Record<string, unknown> | null | undefined;
  return {
    id: str(o.id),
    date,
    eur: num(o.eur),
    title: str(o.title) || "Extra",
    category,
    kind,
    note: str(o.note) || null,
    link: normalizeLink(o.link),
    by: person(o.by),
    at: num(o.at),
    voided: v && typeof v === "object" ? { ...person(v), at: num(v.at), reason: str(v.reason) } : null,
  };
}

function normalizeAllowance(raw: unknown): FolgaAllowance | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (!/^\d{4}-\d{2}$/.test(str(o.from)) || !(num(o.eur) >= 0)) return null;
  return { from: str(o.from), eur: num(o.eur), by: person(o.by), at: num(o.at) };
}

function normalize(raw: unknown): FolgaRecord {
  if (!raw || typeof raw !== "object") return { ...EMPTY_FOLGA };
  const o = raw as Record<string, unknown>;
  return {
    allowances: (Array.isArray(o.allowances) ? o.allowances : [])
      .map(normalizeAllowance)
      .filter((x): x is FolgaAllowance => x !== null),
    entries: (Array.isArray(o.entries) ? o.entries : [])
      .map(normalizeEntry)
      .filter((x): x is FolgaEntry => x !== null),
  };
}

export async function getFolga(slug: string): Promise<FolgaRecord> {
  if (!folgaStorageConfigured) return { ...EMPTY_FOLGA };
  try {
    return normalize(await kv.get<unknown>(key(slug)));
  } catch (err) {
    console.error("folga: leitura falhou:", err);
    return { ...EMPTY_FOLGA };
  }
}

async function update(slug: string, change: (r: FolgaRecord) => FolgaRecord): Promise<FolgaRecord> {
  if (!folgaStorageConfigured) throw new Error("KV não configurado.");
  const next = change(normalize(await kv.get<unknown>(key(slug))));
  await kv.set(key(slug), next);
  return next;
}

export async function addFolgaEntry(
  slug: string,
  entry: Omit<FolgaEntry, "id" | "at" | "voided">,
): Promise<{ record: FolgaRecord; entry: FolgaEntry }> {
  const full: FolgaEntry = {
    ...entry,
    id: `f-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    at: Date.now(),
    voided: null,
  };
  const record = await update(slug, (r) => ({ ...r, entries: [...r.entries, full] }));
  return { record, entry: full };
}

/** Anula um extra. Devolve null quando o extra não existe ou já estava anulado. */
export async function voidFolgaEntry(
  slug: string,
  id: string,
  by: FolgaPerson,
  reason: string,
  allowed: (entry: FolgaEntry) => boolean,
): Promise<FolgaRecord | "missing" | "forbidden"> {
  const current = await getFolga(slug);
  const entry = current.entries.find((e) => e.id === id);
  if (!entry || entry.voided) return "missing";
  if (!allowed(entry)) return "forbidden";
  return update(slug, (r) => ({
    ...r,
    entries: r.entries.map((e) => (e.id === id && !e.voided ? { ...e, voided: { ...by, at: Date.now(), reason } } : e)),
  }));
}

export function setFolgaAllowance(slug: string, from: string, eur: number, by: FolgaPerson): Promise<FolgaRecord> {
  return update(slug, (r) => ({ ...r, allowances: [...r.allowances, { from, eur, by, at: Date.now() }] }));
}

// ---------------------------------------------------------------------------
// Avisos à direção (v78.40) — um por extra que deixa o saldo negativo.
//
// Ficam numa chave só (`seo-folga:alerts`) em vez de o sino recalcular a
// folga de todos os projetos a cada página: o sino lê uma chave, não trinta.
// ---------------------------------------------------------------------------

const ALERTS_KEY = "seo-folga:alerts";
const ALERTS_MAX = 100;

export type FolgaAlert = {
  entryId: string;
  slug: string;
  client: string;
  title: string;
  eur: number;
  /** Saldo do mês depois do extra (cêntimos, negativo). */
  remaining: number;
  /** true quando foi ESTE extra a passar a folga (antes ainda havia saldo). */
  crossed: boolean;
  by: FolgaPerson;
  at: number;
  voided: boolean;
};

export async function getFolgaAlerts(): Promise<FolgaAlert[]> {
  if (!folgaStorageConfigured) return [];
  try {
    const raw = await kv.get<unknown>(ALERTS_KEY);
    return Array.isArray(raw) ? (raw as FolgaAlert[]).filter((a) => a && typeof a.entryId === "string") : [];
  } catch (err) {
    console.error("folga: leitura dos avisos falhou:", err);
    return [];
  }
}

export async function pushFolgaAlert(alert: FolgaAlert): Promise<void> {
  if (!folgaStorageConfigured) return;
  const list = await getFolgaAlerts();
  await kv.set(ALERTS_KEY, [alert, ...list].slice(0, ALERTS_MAX));
}

/** Um extra anulado deixa de pedir atenção à direção. */
export async function markFolgaAlertVoided(entryId: string): Promise<void> {
  if (!folgaStorageConfigured) return;
  const list = await getFolgaAlerts();
  if (!list.some((a) => a.entryId === entryId && !a.voided)) return;
  await kv.set(
    ALERTS_KEY,
    list.map((a) => (a.entryId === entryId ? { ...a, voided: true } : a)),
  );
}
