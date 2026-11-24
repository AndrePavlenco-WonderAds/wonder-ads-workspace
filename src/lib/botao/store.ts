// «Acionar o Botão» — os pedidos em KV (v80.34). Um registo por pedido
// (`botao:req:<id>`) e um índice (`botao:ids`, o mais recente à frente).
// Leituras devolvem objetos crus: `hydrate` põe os valores por omissão, para
// um campo novo nunca partir os registos antigos.

import "server-only";
import { kv } from "@vercel/kv";
import { getSeoClients } from "@/lib/notion";
import { getConsultantResolver } from "@/lib/consultant-assignments";
import { getPausedSlugSet } from "@/lib/admin-paused-clients-store";
import {
  BOTAO_MAX_SOLUTIONS,
  BOTAO_PROBLEM_MAX,
  BOTAO_REPLY_MAX,
  BOTAO_SOLUTION_MAX,
  oneLine,
  type BotaoClientOption,
  type BotaoRequest,
} from "./shared";

const RECORD_PREFIX = "botao:req:";
const IDS_KEY = "botao:ids";
/** Teto de segurança do mget, não uma expectativa. */
const MAX_READ = 300;

export const botaoConfigured = Boolean(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);

const recordKey = (id: string) => `${RECORD_PREFIX}${id}`;

function hydrate(raw: unknown): BotaoRequest | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.id !== "string" || typeof r.username !== "string") return null;
  const client =
    r.client && typeof r.client === "object" && typeof (r.client as { slug?: unknown }).slug === "string"
      ? { slug: String((r.client as { slug: string }).slug), title: String((r.client as { title?: unknown }).title ?? "") }
      : null;
  return {
    id: r.id,
    username: r.username,
    name: typeof r.name === "string" ? r.name : r.username,
    dept: typeof r.dept === "string" ? r.dept : "",
    client,
    problem: typeof r.problem === "string" ? r.problem : "",
    solutions: Array.isArray(r.solutions) ? r.solutions.filter((s): s is string => typeof s === "string") : [],
    meeting: r.meeting === true,
    createdAt: typeof r.createdAt === "number" ? r.createdAt : 0,
    status: r.status === "resolvido" ? "resolvido" : "novo",
    reply: typeof r.reply === "string" && r.reply ? r.reply : null,
    resolvedAt: typeof r.resolvedAt === "number" ? r.resolvedAt : null,
    resolvedByName: typeof r.resolvedByName === "string" ? r.resolvedByName : null,
  };
}

/** Os clientes SEO ativos de quem tem este nome (o consultor re-resolvido a
 *  partir do slug, como no board e no sino). Os projetos em pausa ou
 *  suspensos não entram (v80.35). Ordenados pelo nome. */
export async function botaoClientsOf(name: string): Promise<BotaoClientOption[]> {
  const [all, resolver, paused] = await Promise.all([getSeoClients(), getConsultantResolver(), getPausedSlugSet()]);
  return all
    .filter((c) => !paused.has(c.slug) && resolver.resolve(c.slug, c.consultant) === name)
    .map((c) => ({ slug: c.slug, title: c.title, icon: c.icon }))
    .sort((a, b) => a.title.localeCompare(b.title, "pt"));
}

export async function createBotaoRequest(input: {
  username: string;
  name: string;
  dept: string;
  client: { slug: string; title: string } | null;
  problem: string;
  solutions: string[];
  meeting: boolean;
}): Promise<BotaoRequest> {
  const now = Date.now();
  const record: BotaoRequest = {
    id: `${now.toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    username: input.username,
    name: input.name,
    dept: input.dept,
    client: input.client,
    problem: oneLine(input.problem, BOTAO_PROBLEM_MAX),
    solutions: input.solutions.map((s) => oneLine(s, BOTAO_SOLUTION_MAX)).filter(Boolean).slice(0, BOTAO_MAX_SOLUTIONS),
    meeting: input.meeting,
    createdAt: now,
    status: "novo",
    reply: null,
    resolvedAt: null,
    resolvedByName: null,
  };
  await kv.set(recordKey(record.id), record);
  await kv.lpush(IDS_KEY, record.id);
  return record;
}

export async function listBotaoRequests(): Promise<BotaoRequest[]> {
  const ids = await kv.lrange<string>(IDS_KEY, 0, MAX_READ - 1);
  if (!ids || ids.length === 0) return [];
  const rows = await kv.mget<unknown[]>(...ids.map(recordKey));
  return rows
    .map(hydrate)
    .filter((r): r is BotaoRequest => r !== null)
    .sort((a, b) => b.createdAt - a.createdAt);
}

export async function listBotaoRequestsFor(username: string): Promise<BotaoRequest[]> {
  return (await listBotaoRequests()).filter((r) => r.username === username);
}

/** A direção fecha o pedido, com uma resposta opcional para o consultor. */
export async function resolveBotaoRequest(
  id: string,
  by: { name: string },
  reply: string,
): Promise<BotaoRequest | null> {
  const current = hydrate(await kv.get(recordKey(id)));
  if (!current) return null;
  const next: BotaoRequest = {
    ...current,
    status: "resolvido",
    reply: reply.trim().slice(0, BOTAO_REPLY_MAX) || null,
    resolvedAt: Date.now(),
    resolvedByName: by.name,
  };
  await kv.set(recordKey(id), next);
  return next;
}
