// Registo dos Planos de Probation — server-only. Dados de RH sensíveis: só
// as rotas de /api/admin/probation (gate SuperAdmin) chegam aqui, e nada do
// conteúdo de um plano vai para os logs — os erros registam só a mensagem.
//
// DUAS CHAVES, como nas ausências:
//   `probation:<id>`  → o plano inteiro (dados, período em curso, histórico).
//                       Um registo por chave: gravar um plano nunca corre
//                       contra a criação de outro.
//   `probation:ids`   → lista de ids, mais recente à cabeça (LPUSH). É o
//                       índice de leitura da lista.

import "server-only";
import { kv } from "@vercel/kv";
import {
  nextPeriodFrom,
  sanitizePlan,
  stampDecisions,
  awaitingNewPeriod,
  type ProbationDraft,
  type ProbationPlan,
} from "./shared";

const RECORD_PREFIX = "probation:";
const IDS_KEY = "probation:ids";
/** Teto de segurança para o mget — uma equipa deste tamanho nunca lá chega. */
const MAX_READ = 300;

export const probationConfigured = Boolean(
  process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN,
);

const newId = () => crypto.randomUUID();

function recordKey(id: string): string {
  return `${RECORD_PREFIX}${id}`;
}

/** Só a mensagem — um erro do KV pode trazer o pedido agarrado, e o pedido
 *  é o plano. */
function logError(what: string, err: unknown) {
  console.error(`Probation: ${what}:`, err instanceof Error ? err.message : "erro desconhecido");
}

function assertConfigured() {
  if (!probationConfigured) {
    throw new Error("KV storage not configured on this deployment.");
  }
}

export async function createPlan(
  draft: ProbationDraft,
  author: string,
): Promise<ProbationPlan> {
  assertConfigured();
  const now = Date.now();
  const plan: ProbationPlan = {
    ...draft,
    period: stampDecisions(draft.period, null, now),
    id: newId(),
    rev: 1,
    history: [],
    createdAt: now,
    createdBy: author,
    updatedAt: now,
    updatedBy: author,
  };
  await kv.set(recordKey(plan.id), plan);
  await kv.lpush(IDS_KEY, plan.id);
  return plan;
}

export async function getPlan(id: string): Promise<ProbationPlan | null> {
  if (!probationConfigured || !id) return null;
  try {
    return sanitizePlan(await kv.get<unknown>(recordKey(id)), newId);
  } catch (err) {
    logError("leitura falhou", err);
    return null;
  }
}

/** Todos os planos, mais recentes primeiro. Uma LRANGE + um MGET. */
export async function listPlans(): Promise<ProbationPlan[]> {
  if (!probationConfigured) return [];
  try {
    const ids = await kv.lrange<string>(IDS_KEY, 0, MAX_READ - 1);
    if (!ids || ids.length === 0) return [];
    const rows = await kv.mget<unknown[]>(...ids.map(recordKey));
    const out: ProbationPlan[] = [];
    for (const row of rows ?? []) {
      const plan = sanitizePlan(row, newId);
      if (plan) out.push(plan);
    }
    out.sort((a, b) => b.createdAt - a.createdAt);
    return out;
  } catch (err) {
    logError("lista falhou", err);
    return [];
  }
}

export type SaveResult =
  | { ok: true; plan: ProbationPlan }
  | { ok: false; reason: "not-found" }
  | { ok: false; reason: "conflict"; plan: ProbationPlan };

/** Grava o que o editor mandou por cima do plano. `rev` é a versão que o
 *  editor leu: se entretanto o plano mudou (outra janela, outro
 *  superadmin), a gravação é recusada em vez de apagar o trabalho do outro. */
export async function savePlan(
  id: string,
  draft: ProbationDraft,
  rev: number,
  author: string,
): Promise<SaveResult> {
  assertConfigured();
  const current = await getPlan(id);
  if (!current) return { ok: false, reason: "not-found" };
  if (current.rev !== rev) return { ok: false, reason: "conflict", plan: current };
  const now = Date.now();
  const plan: ProbationPlan = {
    ...current,
    ...draft,
    period: stampDecisions(draft.period, current.period, now),
    rev: current.rev + 1,
    updatedAt: now,
    updatedBy: author,
  };
  await kv.set(recordKey(id), plan);
  return { ok: true, plan };
}

export type NewPeriodResult =
  | { ok: true; plan: ProbationPlan }
  | { ok: false; reason: "not-found" | "not-extended" }
  | { ok: false; reason: "conflict"; plan: ProbationPlan };

/** Extensão aos 30 dias: o período avaliado passa para o histórico e abre-se
 *  um novo, a começar no dia da avaliação. Só quando as duas avaliações do
 *  período decidiram «extensão». */
export async function openNextPeriod(
  id: string,
  rev: number,
  author: string,
): Promise<NewPeriodResult> {
  assertConfigured();
  const current = await getPlan(id);
  if (!current) return { ok: false, reason: "not-found" };
  if (current.rev !== rev) return { ok: false, reason: "conflict", plan: current };
  if (!awaitingNewPeriod(current.period)) return { ok: false, reason: "not-extended" };
  const now = Date.now();
  const plan: ProbationPlan = {
    ...current,
    history: [...current.history, current.period],
    period: nextPeriodFrom(current.period, newId),
    rev: current.rev + 1,
    updatedAt: now,
    updatedBy: author,
  };
  await kv.set(recordKey(id), plan);
  return { ok: true, plan };
}

export async function deletePlan(id: string): Promise<boolean> {
  assertConfigured();
  const existed = await kv.del(recordKey(id));
  await kv.lrem(IDS_KEY, 0, id);
  return existed > 0;
}
