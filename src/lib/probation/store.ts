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
//
// E DUAS PARA O CONSULTOR (v77.77), escritas só no «Enviar»:
//   `probation:pub:<id>`        → o que ele pode ver do plano (fotografias
//                                 enviadas + as confirmações dele). Ver
//                                 published.ts.
//   `probation:user:<username>` → os ids dos planos que lhe foram enviados.
//                                 É a única leitura que o sino e a página
//                                 /probation fazem para quem não tem plano.

import "server-only";
import { kv } from "@vercel/kv";
import {
  nextPeriodFrom,
  sanitizePlan,
  stampDecisions,
  awaitingNewPeriod,
  kpiFilled,
  validateDraft,
  type ProbationDraft,
  type ProbationPlan,
} from "./shared";
import {
  applyAck,
  applySend,
  sanitizePublished,
  snapshotFor,
  type PublishedPlan,
  type SendItem,
} from "./published";

const RECORD_PREFIX = "probation:";
const IDS_KEY = "probation:ids";
const PUB_PREFIX = "probation:pub:";
const USER_PREFIX = "probation:user:";
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
  const pub = await getPublished(id);
  const existed = await kv.del(recordKey(id));
  await kv.lrem(IDS_KEY, 0, id);
  // O consultor deixa de o ver no mesmo instante.
  if (pub) {
    await kv.del(pubKey(id));
    await kv.lrem(userKey(pub.consultantUsername), 0, id);
  }
  return existed > 0;
}

/* ----------------------------- o publicado ----------------------------- */

function pubKey(id: string): string {
  return `${PUB_PREFIX}${id}`;
}

function userKey(username: string): string {
  return `${USER_PREFIX}${username}`;
}

export async function getPublished(id: string): Promise<PublishedPlan | null> {
  if (!probationConfigured || !id) return null;
  try {
    return sanitizePublished(await kv.get<unknown>(pubKey(id)));
  } catch (err) {
    logError("leitura do publicado falhou", err);
    return null;
  }
}

/** O publicado de vários planos, numa leitura (lista do SuperAdmin, sino). */
export async function getPublishedMany(ids: string[]): Promise<Map<string, PublishedPlan>> {
  const out = new Map<string, PublishedPlan>();
  if (!probationConfigured || ids.length === 0) return out;
  try {
    const rows = await kv.mget<unknown[]>(...ids.map(pubKey));
    rows?.forEach((row) => {
      const pub = sanitizePublished(row);
      if (pub) out.set(pub.id, pub);
    });
  } catch (err) {
    logError("leitura do publicado (vários) falhou", err);
  }
  return out;
}

/** Os planos enviados a um consultor — do próprio, sempre filtrados pelo
 *  username que vem da sessão. Para quem não tem plano é uma leitura só. */
export async function listPublishedForUser(username: string): Promise<PublishedPlan[]> {
  if (!probationConfigured || !username) return [];
  try {
    const ids = await kv.lrange<string>(userKey(username), 0, 20);
    if (!ids || ids.length === 0) return [];
    const map = await getPublishedMany(ids);
    // Dupla tranca: o índice diz que é dele, o publicado tem de dizer o mesmo.
    return ids
      .map((id) => map.get(id))
      .filter((p): p is PublishedPlan => Boolean(p) && p!.consultantUsername === username);
  } catch (err) {
    logError("índice do consultor falhou", err);
    return [];
  }
}

export type SendResult =
  | { ok: true; plan: ProbationPlan; pub: PublishedPlan }
  | { ok: false; reason: "not-found" | "no-username" | "nothing" | "not-ready"; message: string }
  | { ok: false; reason: "conflict"; plan: ProbationPlan; message: string };

/** «Enviar ao consultor»: fotografa o item a partir do plano GRAVADO e com a
 *  `rev` que o editor pré-visualizou — se o plano mudou entretanto, recusa,
 *  para nunca se enviar uma coisa diferente da que se viu. */
export async function sendToConsultant(
  id: string,
  rev: number,
  item: SendItem,
  actor: string,
): Promise<SendResult> {
  assertConfigured();
  const plan = await getPlan(id);
  if (!plan) return { ok: false, reason: "not-found", message: "Plano não encontrado." };
  if (plan.rev !== rev) {
    return {
      ok: false,
      reason: "conflict",
      plan,
      message: "O plano mudou depois da pré-visualização — volta a abri-la antes de enviar.",
    };
  }
  const username = plan.consultantUsername;
  if (!username) {
    return {
      ok: false,
      reason: "no-username",
      message: "Escolhe o consultor da lista da equipa — um nome escrito à mão não tem conta na app.",
    };
  }
  const period = plan.period;
  if (item === "plan") {
    const issue = validateDraft(plan);
    if (issue) return { ok: false, reason: "not-ready", message: issue };
    if (!period.kpis15.some(kpiFilled) && !period.kpis30.some(kpiFilled)) {
      return { ok: false, reason: "not-ready", message: "Escreve pelo menos um KPI antes de enviar o plano." };
    }
  } else if (item.startsWith("week:")) {
    const w = period.weeks.find((x) => x.n === Number(item.slice(5)));
    if (!w?.done) {
      return { ok: false, reason: "not-ready", message: "Marca o check-in como feito antes de o enviar." };
    }
  }
  const snap = snapshotFor(plan, period, plan.history.length, item);
  if (!snap) {
    return { ok: false, reason: "nothing", message: "Ainda não há decisão nesta avaliação — nada para enviar." };
  }

  const prev = await getPublished(id);
  if (prev && prev.consultantUsername !== username) {
    // O plano passou para outra pessoa: a anterior deixa de o ver.
    await kv.lrem(userKey(prev.consultantUsername), 0, id);
  }
  const pub = applySend(
    prev,
    { ...plan, consultantUsername: username },
    plan.history.length,
    period.startDate,
    snap,
    actor,
    Date.now(),
  );
  await kv.set(pubKey(id), pub);
  // Índice do consultor sem duplicados, o mais recente à cabeça.
  await kv.lrem(userKey(username), 0, id);
  await kv.lpush(userKey(username), id);
  return { ok: true, plan, pub };
}

export type AckResult =
  | { ok: true; pub: PublishedPlan }
  | { ok: false; reason: "not-found" };

/** A confirmação do consultor. `username` vem SEMPRE da sessão: um plano que
 *  não é dele responde como se não existisse. */
export async function acknowledge(
  username: string,
  id: string,
  periodIndex: number,
  item: SendItem,
  comment: string,
): Promise<AckResult> {
  assertConfigured();
  const pub = await getPublished(id);
  if (!pub || pub.consultantUsername !== username) return { ok: false, reason: "not-found" };
  const next = applyAck(pub, periodIndex, item, comment, Date.now());
  if (!next) return { ok: false, reason: "not-found" };
  await kv.set(pubKey(id), next);
  return { ok: true, pub: next };
}
