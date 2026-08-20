// Registo das ausências — server-only. Duas folhas, um só registo: o PEDIDO
// que o próprio assina (RH-01, `kind: "request"`) e a FALTA que o C-Level
// lança a alguém (RH-02, `kind: "falta"`). Partilham a chave, o índice e o
// sino de propósito — quem lê o histórico de uma pessoa quer as duas coisas.
//
// QUATRO CHAVES, DE PROPÓSITO:
//   `absence:<id>`     → o pedido em si. Um registo por chave para que a
//                        decisão (que reescreve o pedido) nunca esteja em
//                        corrida com a criação de outro pedido — no dia em
//                        que dois superadmins carregam em "Aprovar" ao mesmo
//                        tempo (um na app, outro no Slack), só esta chave
//                        está em jogo, e há um guard de "já foi decidido".
//   `absences:ids`     → lista de ids, mais recente à cabeça (LPUSH). É o
//                        índice de leitura; nunca é reescrita, só cresce.
//   `absences:counter` → INCR atómico que dá a referência humana sequencial
//                        (AUS-2026-007) sem read-modify-write.
//   `faltas:counter`   → o mesmo, para as faltas (FAL-2026-003). Contador
//                        próprio: as duas séries são numeradas à parte.
//
// As notificações do sino DERIVAM daqui em cada leitura, como tudo o resto
// no sino: um pedido pendente É a notificação dos superadmins, um pedido
// decidido e não-entendido É a notificação do consultor. Nada é "enviado",
// portanto nada se perde — e quando um superadmin decide, a notificação
// morre sozinha no sino dos outros dois, porque deixou de haver pendente.

import { kv } from "@vercel/kv";
import {
  faltaReasonById,
  reasonById,
  type AbsenceAttachment,
  type AbsenceKind,
  type AbsencePeriodKind,
  type AbsenceRequest,
  type AbsenceStatus,
} from "./absences-shared";

const RECORD_PREFIX = "absence:";
const IDS_KEY = "absences:ids";
const COUNTER_KEY = "absences:counter";
/** As faltas contam à parte — "FAL-2026-001" tem de começar no 1 mesmo que
 *  já existam vinte pedidos de ausência gravados. Mesmo INCR atómico, outra
 *  chave; o índice de leitura continua a ser um só. */
const FALTA_COUNTER_KEY = "faltas:counter";

/** Quantos pedidos o índice serve, no máximo, numa leitura. Uma casa de ~12
 *  pessoas leva anos a chegar perto disto; é um teto de segurança para o
 *  mget, não uma expectativa. */
const MAX_READ = 400;

export const absencesConfigured = Boolean(
  process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN,
);

function recordKey(id: string): string {
  return `${RECORD_PREFIX}${id}`;
}

function text(v: unknown, max: number): string {
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}

function numOrNull(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

const PERIOD_KINDS: AbsencePeriodKind[] = [
  "morning",
  "afternoon",
  "full-day",
  "multi-day",
];
const STATUSES: AbsenceStatus[] = ["pending", "approved", "rejected", "recorded"];
const KINDS: AbsenceKind[] = ["request", "falta"];

/** O KV devolve objetos crus — um registo gravado antes de um campo existir
 *  vem sem ele. Tudo o que a app lê passa por aqui, com defaults, para que
 *  nenhuma página rebente com um pedido antigo (a lição dos WebTickets). */
export function sanitizeAbsence(raw: unknown): AbsenceRequest | null {
  if (!raw || typeof raw !== "object") return null;
  const a = raw as Record<string, unknown>;
  if (typeof a.id !== "string" || !a.id) return null;
  if (typeof a.username !== "string" || !a.username) return null;

  const periodKind = PERIOD_KINDS.includes(a.periodKind as AbsencePeriodKind)
    ? (a.periodKind as AbsencePeriodKind)
    : "full-day";
  const status = STATUSES.includes(a.status as AbsenceStatus)
    ? (a.status as AbsenceStatus)
    : "pending";


  let attachment: AbsenceAttachment | null = null;
  if (a.attachment && typeof a.attachment === "object") {
    const at = a.attachment as Record<string, unknown>;
    if (typeof at.url === "string" && at.url) {
      attachment = {
        url: at.url,
        name: text(at.name, 200) || "comprovativo",
        size: numOrNull(at.size) ?? 0,
        contentType: text(at.contentType, 120),
      };
    }
  }

  // Tudo o que foi gravado antes das faltas existirem é um pedido — e
  // nenhum pedido tem classificação de justificada. Sem estes dois defaults,
  // cada registo antigo rebentava a página que os lê (a lição dos WebTickets).
  const kind = KINDS.includes(a.kind as AbsenceKind)
    ? (a.kind as AbsenceKind)
    : "request";

  // Cada folha tem o seu catálogo de motivos — e os dois têm um "outro" para
  // aterrar um id que já não exista.
  const reasonMeta =
    kind === "falta"
      ? faltaReasonById(a.reason as string)
      : reasonById(a.reason as string);
  const reason = reasonMeta?.id ?? "outro";

  return {
    id: a.id,
    ref: text(a.ref, 40) || a.id,
    kind,
    justified: typeof a.justified === "boolean" ? a.justified : null,
    username: a.username,
    name: text(a.name, 120) || a.username,
    role: text(a.role, 120),
    dept: text(a.dept, 60),
    periodKind,
    startDate: text(a.startDate, 10),
    endDate: text(a.endDate, 10) || text(a.startDate, 10),
    calendarDays: numOrNull(a.calendarDays) ?? 0,
    businessDays: numOrNull(a.businessDays) ?? 0,
    reason,
    reasonLabel: text(a.reasonLabel, 80) || reasonMeta?.label || "—",
    details: text(a.details, 2000),
    contact: text(a.contact, 200),
    handover: text(a.handover, 1000),
    attachment,
    signatureName: text(a.signatureName, 120),
    createdAt: numOrNull(a.createdAt) ?? 0,
    status,
    decidedBy: text(a.decidedBy, 120) || null,
    decidedByName: text(a.decidedByName, 120) || null,
    decidedAt: numOrNull(a.decidedAt),
    decisionNote: text(a.decisionNote, 500) || null,
    decidedVia:
      a.decidedVia === "app" || a.decidedVia === "slack" ? a.decidedVia : null,
    acknowledgedAt: numOrNull(a.acknowledgedAt),
  };
}

export type NewAbsenceInput = Omit<
  AbsenceRequest,
  | "id"
  | "ref"
  | "kind"
  | "justified"
  | "createdAt"
  | "status"
  | "decidedBy"
  | "decidedByName"
  | "decidedAt"
  | "decisionNote"
  | "decidedVia"
  | "acknowledgedAt"
>;

/** Grava um pedido novo e devolve-o já com id + referência humana. */
export async function createAbsence(
  input: NewAbsenceInput,
): Promise<AbsenceRequest> {
  if (!absencesConfigured) {
    throw new Error("KV storage not configured on this deployment.");
  }
  const seq = await kv.incr(COUNTER_KEY);
  const year = new Date().getFullYear();
  const record: AbsenceRequest = {
    ...input,
    id: crypto.randomUUID(),
    ref: `AUS-${year}-${String(seq).padStart(3, "0")}`,
    kind: "request",
    justified: null,
    createdAt: Date.now(),
    status: "pending",
    decidedBy: null,
    decidedByName: null,
    decidedAt: null,
    decisionNote: null,
    decidedVia: null,
    acknowledgedAt: null,
  };
  await kv.set(recordKey(record.id), record);
  await kv.lpush(IDS_KEY, record.id);
  return record;
}

export type NewFaltaInput = Omit<
  AbsenceRequest,
  | "id"
  | "ref"
  | "kind"
  | "createdAt"
  | "status"
  | "decidedBy"
  | "decidedByName"
  | "decidedAt"
  | "decisionNote"
  | "decidedVia"
  | "acknowledgedAt"
> & {
  /** Quem lançou a falta — é sempre um superadmin, verificado na API. */
  registeredBy: string;
  registeredByName: string;
};

/** Lança uma falta a alguém. Ao contrário do pedido, NASCE DECIDIDA: não há
 *  fila de aprovação, o C-Level é que está a afirmar o facto. Por isso os
 *  campos de decisão são preenchidos na criação — `decidedBy` é quem lançou
 *  e `decidedAt` é o momento do lançamento —, e o único ato que falta é a
 *  pessoa carregar em «Entendido» na notificação. */
export async function createFalta(
  input: NewFaltaInput,
): Promise<AbsenceRequest> {
  if (!absencesConfigured) {
    throw new Error("KV storage not configured on this deployment.");
  }
  const { registeredBy, registeredByName, ...rest } = input;
  const seq = await kv.incr(FALTA_COUNTER_KEY);
  const year = new Date().getFullYear();
  const now = Date.now();
  const record: AbsenceRequest = {
    ...rest,
    id: crypto.randomUUID(),
    ref: `FAL-${year}-${String(seq).padStart(3, "0")}`,
    kind: "falta",
    createdAt: now,
    status: "recorded",
    decidedBy: registeredBy,
    decidedByName: registeredByName,
    decidedAt: now,
    decisionNote: null,
    decidedVia: "app",
    acknowledgedAt: null,
  };
  await kv.set(recordKey(record.id), record);
  await kv.lpush(IDS_KEY, record.id);
  return record;
}

export async function getAbsence(id: string): Promise<AbsenceRequest | null> {
  if (!absencesConfigured) return null;
  try {
    return sanitizeAbsence(await kv.get<unknown>(recordKey(id)));
  } catch (err) {
    console.error("KV absence read failed:", err);
    return null;
  }
}

/** Todos os pedidos, mais recentes primeiro. Uma LRANGE + um MGET. */
export async function listAbsences(): Promise<AbsenceRequest[]> {
  if (!absencesConfigured) return [];
  try {
    const ids = await kv.lrange<string>(IDS_KEY, 0, MAX_READ - 1);
    if (!ids || ids.length === 0) return [];
    const rows = await kv.mget<unknown[]>(...ids.map(recordKey));
    const out: AbsenceRequest[] = [];
    for (const row of rows ?? []) {
      const rec = sanitizeAbsence(row);
      if (rec) out.push(rec);
    }
    out.sort((a, b) => b.createdAt - a.createdAt);
    return out;
  } catch (err) {
    console.error("KV absences list failed:", err);
    return [];
  }
}

export async function listAbsencesForUser(
  username: string,
): Promise<AbsenceRequest[]> {
  const all = await listAbsences();
  return all.filter((a) => a.username === username);
}

export async function listPendingAbsences(): Promise<AbsenceRequest[]> {
  const all = await listAbsences();
  return all.filter((a) => a.status === "pending");
}

/** Só os pedidos (folha RH-01) — o que o painel de decisão do C-Level trata. */
export async function listAbsenceRequests(): Promise<AbsenceRequest[]> {
  const all = await listAbsences();
  return all.filter((a) => a.kind === "request");
}

/** Só as faltas (folha RH-02) — o registo de /admin/faltas. */
export async function listFaltas(): Promise<AbsenceRequest[]> {
  const all = await listAbsences();
  return all.filter((a) => a.kind === "falta");
}

export type DecideResult =
  | { ok: true; record: AbsenceRequest }
  | { ok: false; reason: "not-found" }
  | { ok: false; reason: "already-decided"; record: AbsenceRequest };

/** Aprova ou recusa um pedido. Quem chega segundo — o outro superadmin, na
 *  app ou no Slack — recebe o registo já decidido em vez de o reescrever:
 *  a primeira decisão é a que conta, venha de onde vier. */
export async function decideAbsence(
  id: string,
  decision: {
    status: "approved" | "rejected";
    decidedBy: string;
    decidedByName: string;
    note: string | null;
    via: "app" | "slack";
  },
): Promise<DecideResult> {
  if (!absencesConfigured) {
    throw new Error("KV storage not configured on this deployment.");
  }
  const current = await getAbsence(id);
  if (!current) return { ok: false, reason: "not-found" };
  if (current.status !== "pending") {
    return { ok: false, reason: "already-decided", record: current };
  }
  const record: AbsenceRequest = {
    ...current,
    status: decision.status,
    decidedBy: decision.decidedBy,
    decidedByName: decision.decidedByName,
    decidedAt: Date.now(),
    decisionNote: decision.note,
    decidedVia: decision.via,
  };
  await kv.set(recordKey(id), record);
  return { ok: true, record };
}

/** O «Entendido» do consultor na notificação da resposta. Só o dono do
 *  pedido o pode dar, e só depois de haver decisão. */
export async function acknowledgeAbsence(
  id: string,
  username: string,
): Promise<boolean> {
  if (!absencesConfigured) return false;
  const current = await getAbsence(id);
  if (!current || current.username !== username) return false;
  if (current.status === "pending") return false;
  if (current.acknowledgedAt) return true;
  await kv.set(recordKey(id), { ...current, acknowledgedAt: Date.now() });
  return true;
}

/** Só para testes locais/manuais: apaga um pedido e tira-o do índice. */
export async function deleteAbsence(id: string): Promise<void> {
  if (!absencesConfigured) return;
  await kv.del(recordKey(id));
  await kv.lrem(IDS_KEY, 0, id);
}
