// Passagem de consultor (v80.39) — o KV.
//
// Chaves (cada uma com UM só escritor, para nunca se pisarem):
//   passagem:index              índice de todas (o menu e o sino: 1 leitura)
//   passagem:<id>               a passagem — só a direção escreve
//   passagem:<id>:ficha:<slug>  a ficha de um projeto — quem sai (ou a direção)
//   passagem:<id>:sign:<slug>   «Li e assumo» — quem entra
//   passagem:<id>:qids          lista dos ids das perguntas (LPUSH atómico)
//   passagem:<id>:q:<qid>       uma pergunta e a resposta
//
// Nada disto guarda passwords: os acessos são só o estado (garantido / em
// falta / não se aplica); as credenciais vivem no cofre de cada cliente.

import "server-only";
import { cache } from "react";
import { kv } from "@vercel/kv";
import { getSeoClients } from "@/lib/notion";
import { getConsultantResolver } from "@/lib/consultant-assignments";
import { getPausedSlugSet } from "@/lib/admin-paused-clients-store";
import { seoConsultants } from "@/lib/documentacao/people";
import {
  ANSWER_MAX,
  QUESTION_MAX,
  hydrateFicha,
  indexEntryOf,
  type Ficha,
  type Passagem,
  type PassagemIndexEntry,
  type Person,
  type Question,
  type Sign,
} from "./shared";

export const passagemConfigured = Boolean(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);

const INDEX_KEY = "passagem:index";
const metaKey = (id: string) => `passagem:${id}`;
const fichaKey = (id: string, slug: string) => `passagem:${id}:ficha:${slug}`;
const signKey = (id: string, slug: string) => `passagem:${id}:sign:${slug}`;
const qidsKey = (id: string) => `passagem:${id}:qids`;
const qKey = (id: string, qid: string) => `passagem:${id}:q:${qid}`;

function newId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/* ------------------------------------------------------------------ */
/*  Índice + passagens                                                 */
/* ------------------------------------------------------------------ */

export const getPassagemIndex = cache(async (): Promise<PassagemIndexEntry[]> => {
  if (!passagemConfigured) return [];
  try {
    const raw = await kv.get<PassagemIndexEntry[]>(INDEX_KEY);
    return Array.isArray(raw) ? raw : [];
  } catch (err) {
    console.error("passagem: índice falhou:", err instanceof Error ? err.message : err);
    return [];
  }
});

function hydratePassagem(raw: unknown): Passagem | null {
  if (!raw || typeof raw !== "object") return null;
  const p = raw as Passagem;
  if (typeof p.id !== "string" || !p.outgoing) return null;
  return {
    ...p,
    note: typeof p.note === "string" ? p.note : "",
    projects: Array.isArray(p.projects) ? p.projects : [],
    exit: p.exit && typeof p.exit === "object" ? p.exit : {},
    closedAt: p.closedAt ?? null,
    closedBy: p.closedBy ?? null,
  };
}

export async function getPassagem(id: string): Promise<Passagem | null> {
  if (!passagemConfigured || !/^[a-z0-9-]{4,40}$/.test(id)) return null;
  return hydratePassagem(await kv.get(metaKey(id)));
}

/** Todas, das mais recentes para as mais antigas. */
export async function listPassagens(): Promise<Passagem[]> {
  const index = await getPassagemIndex();
  if (index.length === 0) return [];
  const raws = await kv.mget<unknown[]>(...index.map((e) => metaKey(e.id)));
  return raws
    .map(hydratePassagem)
    .filter((p): p is Passagem => p !== null)
    .sort((a, b) => b.createdAt - a.createdAt);
}

/** Grava a passagem e a linha dela no índice. Só a direção chega aqui. */
export async function savePassagem(p: Passagem): Promise<Passagem> {
  const next = { ...p, updatedAt: Date.now() };
  await kv.set(metaKey(p.id), next);
  const raw = await kv.get<PassagemIndexEntry[]>(INDEX_KEY);
  const index = Array.isArray(raw) ? raw.filter((e) => e.id !== p.id) : [];
  await kv.set(INDEX_KEY, [indexEntryOf(next), ...index]);
  return next;
}

export async function createPassagem(input: Omit<Passagem, "id" | "createdAt" | "updatedAt" | "closedAt" | "closedBy" | "exit" | "status">): Promise<Passagem> {
  const now = Date.now();
  return savePassagem({
    ...input,
    id: newId(),
    status: "ativa",
    exit: {},
    createdAt: now,
    closedAt: null,
    closedBy: null,
    updatedAt: now,
  });
}

/** A passagem ATIVA de quem sai, se houver. */
export async function activePassagemOf(username: string): Promise<PassagemIndexEntry | null> {
  return (await getPassagemIndex()).find((e) => e.status === "ativa" && e.outgoing === username) ?? null;
}

/** As passagens ATIVAS em que esta pessoa recebe pelo menos um projeto. */
export async function incomingPassagensOf(username: string): Promise<PassagemIndexEntry[]> {
  return (await getPassagemIndex()).filter((e) => e.status === "ativa" && e.incoming.includes(username));
}

/* ------------------------------------------------------------------ */
/*  Fichas e assinaturas                                               */
/* ------------------------------------------------------------------ */

export async function getFichas(id: string, slugs: string[]): Promise<Record<string, Ficha>> {
  const out: Record<string, Ficha> = {};
  if (slugs.length === 0) return out;
  const raws = await kv.mget<unknown[]>(...slugs.map((s) => fichaKey(id, s)));
  slugs.forEach((s, i) => (out[s] = hydrateFicha(raws[i])));
  return out;
}

export async function getFicha(id: string, slug: string): Promise<Ficha> {
  return hydrateFicha(await kv.get(fichaKey(id, slug)));
}

export async function saveFicha(id: string, slug: string, ficha: Ficha): Promise<Ficha> {
  const next = { ...ficha, updatedAt: Date.now() };
  await kv.set(fichaKey(id, slug), next);
  return next;
}

export async function getSigns(id: string, slugs: string[]): Promise<Record<string, Sign | null>> {
  const out: Record<string, Sign | null> = {};
  if (slugs.length === 0) return out;
  const raws = await kv.mget<Array<Sign | null>>(...slugs.map((s) => signKey(id, s)));
  slugs.forEach((s, i) => (out[s] = raws[i] && typeof raws[i]?.at === "number" ? raws[i] : null));
  return out;
}

export async function setSign(id: string, slug: string, sign: Sign | null): Promise<void> {
  if (sign) await kv.set(signKey(id, slug), sign);
  else await kv.del(signKey(id, slug));
}

/* ------------------------------------------------------------------ */
/*  Perguntas                                                          */
/* ------------------------------------------------------------------ */

export async function listQuestions(id: string): Promise<Question[]> {
  const ids = await kv.lrange<string>(qidsKey(id), 0, 499);
  if (!ids || ids.length === 0) return [];
  const raws = await kv.mget<Array<Question | null>>(...ids.map((q) => qKey(id, q)));
  return raws.filter((q): q is Question => Boolean(q && typeof q.id === "string")).sort((a, b) => a.at - b.at);
}

export async function askQuestion(id: string, slug: string, q: string, by: Person): Promise<Question> {
  const question: Question = {
    id: newId(),
    slug,
    q: q.trim().slice(0, QUESTION_MAX),
    by,
    at: Date.now(),
    a: null,
    aBy: null,
    aAt: null,
  };
  await kv.set(qKey(id, question.id), question);
  await kv.lpush(qidsKey(id), question.id);
  return question;
}

export async function answerQuestion(id: string, qid: string, a: string, by: Person): Promise<Question | null> {
  if (!/^[a-z0-9-]{4,40}$/.test(qid)) return null;
  const current = await kv.get<Question>(qKey(id, qid));
  if (!current) return null;
  const next: Question = { ...current, a: a.trim().slice(0, ANSWER_MAX), aBy: by, aAt: Date.now() };
  await kv.set(qKey(id, qid), next);
  return next;
}

/* ------------------------------------------------------------------ */
/*  Carteiras                                                          */
/* ------------------------------------------------------------------ */

export type PortfolioClient = { slug: string; title: string; icon: string | null };

/** Os consultores SEO e a carteira ATIVA de cada um (sem pausados), numa
 *  só leitura. O projeto da própria WonderAds entra: também tem dono e
 *  também tem de passar. */
export async function seoPortfolios(): Promise<Array<Person & { clients: PortfolioClient[] }>> {
  const [all, resolver, paused] = await Promise.all([
    getSeoClients().catch(() => []),
    getConsultantResolver(),
    getPausedSlugSet().catch(() => new Set<string>()),
  ]);
  return seoConsultants().map((c) => ({
    username: c.username,
    name: c.name,
    clients: all
      .filter(
(cl) => !paused.has(cl.slug) && resolver.resolve(cl.slug, cl.consultant) === c.name)
      .map((cl) => ({ slug: cl.slug, title: cl.title, icon: cl.icon ?? null }))
      .sort((a, b) => a.title.localeCompare(b.title, "pt")),
  }));
}

/** Quem tem hoje cada projeto (para saber se já foi passado no SEO DPT). */
export async function currentOwners(slugs: string[]): Promise<Record<string, string>> {
  const [all, resolver] = await Promise.all([getSeoClients().catch(() => []), getConsultantResolver()]);
  const fallback = new Map(all.map((c) => [c.slug, c.consultant]));
  return Object.fromEntries(slugs.map((s) => [s, resolver.resolve(s, fallback.get(s))]));
}

/* ------------------------------------------------------------------ */
/*  Quem pode ver o quê                                                */
/* ------------------------------------------------------------------ */

export type PassagemRole = "admin" | "outgoing" | "incoming";

/** O papel de alguém numa passagem e os projetos que pode abrir. */
export function roleIn(
  p: Passagem,
  viewer: { username: string; isAdmin: boolean },
): { role: PassagemRole; slugs: string[] } | null {
  if (viewer.isAdmin) return { role: "admin", slugs: p.projects.map((x) => x.slug) };
  if (p.outgoing.username === viewer.username) return { role: "outgoing", slugs: p.projects.map((x) => x.slug) };
  const mine = p.projects.filter((x) => x.incoming?.username === viewer.username).map((x) => x.slug);
  return mine.length > 0 ? { role: "incoming", slugs: mine } : null;
}
