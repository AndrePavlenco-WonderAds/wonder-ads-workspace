// Per-client SEO satisfaction survey store ("NPS quiz").
//
// One KV blob per client (slug-keyed) holding the full submission history
// plus the send metadata (when the last link was sent, when the next survey
// is due).
//
// NPS MENSAL (v78.7): cada cliente responde UMA VEZ POR MÊS DE CALENDÁRIO
// (fuso de Lisboa). Acabou a cadência de 30/60/90 dias: o bónus NPS dos
// consultores mede mês a mês, e um cliente perguntado de 60 em 60 dias
// nunca deixava ninguém passar dos 50% de preenchimento. Os registos antigos
// ainda trazem `cadenceDays` — é ignorado na leitura e desaparece na escrita
// seguinte.
//
// The public quiz form writes submissions via /api/nps/[slug]/submit (no
// auth — the slug is the share secret, same trust model as the Pending
// Review table). Consultants read the history on /seo/[slug]/nps and log a
// "send" via /api/nps/[slug]/send.

import { kv } from "@vercel/kv";
import { lisbonMonthKey, monthStartMs, shiftMonthKey } from "@/lib/dates";
import {
  computeNpsScores,
  type NpsCategory,
  type NpsScores,
} from "@/lib/nps-questions";

const KEY_PREFIX = "nps:";
const MAX_SUBMISSIONS = 100;
const MAX_SENDS = 100;
const COMMENT_MAX = 4000;
const IDENT_MAX = 160;

/** Bumped when the survey shape changes so old submissions (different
 *  questions/scale) don't mix with new ones. v2 = the 0–10 competitor-
 *  inspired survey. Submissions from earlier schemas are filtered out on
 *  read (clean slate) without touching KV. */
export const NPS_SCHEMA_VERSION = 2;

export const npsStorageConfigured = Boolean(
  process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN,
);

export type NpsSubmission = {
  id: string;
  /** Survey shape this submission was captured with. */
  schemaVersion: number;
  /** Epoch ms when the client submitted. */
  submittedAt: number;
  /** Raw 0–10 answers (scale questions), keyed by question name. */
  answers: Record<string, number>;
  /** Multi-select AND single-choice answers, keyed by question name →
   *  selected option values (single-choice stores a 1-element array). */
  choices?: Record<string, string[]>;
  /** Free-text answers, keyed by open-question name. */
  texts?: Record<string, string>;
  /** Legacy general comment (v1). Kept optional for back-compat. */
  comment?: string | null;
  /** Free-form "Name — Company" the client optionally left. */
  identification: string | null;
  /** Consultant on the account at submit time (snapshot). */
  consultant: string | null;
  /** Derived scores, stored so the list view doesn't recompute. */
  scores: NpsScores;
};

export type NpsSend = {
  at: number;
  /** Employee name who logged the send, when known. */
  by: string | null;
};

export type NpsMeta = {
  lastSentAt: number | null;
  /** Epoch ms a partir do qual o próximo NPS é devido: o dia 1 do mês
   *  seguinte quando o cliente já respondeu este mês; senão o dia 1 deste
   *  mês (está em dívida). Derivado na leitura — nunca confiar no gravado. */
  nextDueAt: number | null;
  sends: NpsSend[];
};

export type NpsRecord = {
  submissions: NpsSubmission[];
  meta: NpsMeta;
};

function key(slug: string): string {
  return `${KEY_PREFIX}${slug}`;
}

function emptyMeta(): NpsMeta {
  return {
    lastSentAt: null,
    nextDueAt: null,
    sends: [],
  };
}

function normalizeRecord(raw: Partial<NpsRecord> | null): NpsRecord {
  // Only keep submissions from the current survey schema — older ones use a
  // different question set/scale and would corrupt the aggregates. This is a
  // read-time filter; it never deletes anything from KV.
  const submissions = (
    Array.isArray(raw?.submissions) ? raw!.submissions : []
  ).filter((s) => s?.schemaVersion === NPS_SCHEMA_VERSION);
  const meta = (raw?.meta ?? emptyMeta()) as Partial<NpsMeta>;
  // Sem `cadenceDays` de propósito: os registos antigos perdem-no aqui.
  const normMeta: NpsMeta = {
    lastSentAt: meta.lastSentAt ?? null,
    nextDueAt: null,
    sends: Array.isArray(meta.sends) ? meta.sends : [],
  };
  normMeta.nextDueAt = deriveNextDue(submissions, Date.now());
  return { submissions, meta: normMeta };
}

/** Já respondeu este mês → dia 1 do mês seguinte. Senão → dia 1 deste mês
 *  (em dívida desde aí). */
function deriveNextDue(submissions: NpsSubmission[], nowMs: number): number {
  const month = lisbonMonthKey(nowMs);
  const answered = submissions.some((s) => lisbonMonthKey(s.submittedAt) === month);
  return monthStartMs(answered ? shiftMonthKey(month, 1) : month);
}

/** Onde está o NPS deste mês para um cliente. */
export type NpsMonthState = "respondido" | "enviado" | "por-enviar";

export type NpsMonthStatus = {
  /** "2026-10" — o mês corrente, em Lisboa. */
  month: string;
  state: NpsMonthState;
  /** A última resposta deste mês (é a que conta), ou null. */
  answer: NpsSubmission | null;
  /** O último envio deste mês, ou null. */
  sentAt: number | null;
  /** Dia 1 do mês seguinte — quando abre o próximo ciclo. */
  nextMonthStart: number;
};

export function npsMonthStatus(record: NpsRecord, nowMs: number): NpsMonthStatus {
  const month = lisbonMonthKey(nowMs);
  // Guardados do mais recente para o mais antigo — o primeiro do mês é o
  // último desse mês.
  const answer = record.submissions.find((s) => lisbonMonthKey(s.submittedAt) === month) ?? null;
  const sent = record.meta.sends.find((s) => lisbonMonthKey(s.at) === month) ?? null;
  return {
    month,
    state: answer ? "respondido" : sent ? "enviado" : "por-enviar",
    answer,
    sentAt: sent?.at ?? null,
    nextMonthStart: monthStartMs(shiftMonthKey(month, 1)),
  };
}

export async function getNpsRecord(slug: string): Promise<NpsRecord> {
  if (!npsStorageConfigured) return normalizeRecord(null);
  try {
    const stored = await kv.get<Partial<NpsRecord>>(key(slug));
    return normalizeRecord(stored);
  } catch (err) {
    console.error("nps read failed:", err);
    return normalizeRecord(null);
  }
}

/** Most recent submission (submissions are stored newest-first). */
export async function getLatestNps(
  slug: string,
): Promise<NpsSubmission | null> {
  const rec = await getNpsRecord(slug);
  return rec.submissions[0] ?? null;
}

/** True quando o consultor tem de agir JÁ: o cliente ainda não respondeu
 *  este mês e o formulário ainda não lhe foi enviado este mês. É o que põe
 *  a pastilha de NPS a pulsar a vermelho na ficha do cliente. */
export function npsSendDue(record: NpsRecord, nowMs: number): boolean {
  return npsMonthStatus(record, nowMs).state === "por-enviar";
}

export type NewSubmission = {
  answers: Record<string, number>;
  choices?: Record<string, string[]>;
  texts?: Record<string, string>;
  comment?: string | null;
  identification?: string | null;
  consultant?: string | null;
};

/** Append a client submission. Recomputes scores server-side (never trust
 *  the client's math). Fecha o mês: o próximo NPS é devido no dia 1 do mês
 *  seguinte. */
export async function addNpsSubmission(
  slug: string,
  input: NewSubmission,
  nowMs: number,
): Promise<NpsSubmission> {
  const rec = await getNpsRecord(slug);
  const scores = computeNpsScores({
    answers: input.answers,
    choices: input.choices,
  });
  const submission: NpsSubmission = {
    id: `nps_${nowMs}_${Math.floor((nowMs % 1000) + rec.submissions.length)}`,
    schemaVersion: NPS_SCHEMA_VERSION,
    submittedAt: nowMs,
    answers: input.answers,
    choices: input.choices,
    texts: input.texts,
    comment: input.comment ? input.comment.slice(0, COMMENT_MAX) : null,
    identification: input.identification
      ? input.identification.slice(0, IDENT_MAX)
      : null,
    consultant: input.consultant ?? null,
    scores,
  };
  const submissions = [submission, ...rec.submissions].slice(0, MAX_SUBMISSIONS);
  const meta: NpsMeta = {
    ...rec.meta,
    nextDueAt: deriveNextDue(submissions, nowMs),
  };
  if (npsStorageConfigured) {
    await kv.set(key(slug), { submissions, meta });
  }
  return submission;
}

/** Remove the most recent submission (the "last filled form"). Returns the
 *  removed submission, or null when there was nothing to remove. The
 *  next-due date is re-derived on the next read. SuperAdmin-only — the
 *  route enforces that; the store just does the mutation. */
export async function removeLatestNps(
  slug: string,
): Promise<NpsSubmission | null> {
  const rec = await getNpsRecord(slug);
  if (rec.submissions.length === 0) return null;
  const [removed, ...rest] = rec.submissions;
  if (npsStorageConfigured) {
    await kv.set(key(slug), { submissions: rest, meta: rec.meta });
  }
  return removed;
}

/** Log that the consultant sent the survey link. O mês só fecha com a
 *  resposta — um envio não muda o próximo prazo. */
export async function recordNpsSend(
  slug: string,
  by: string | null,
  nowMs: number,
): Promise<NpsMeta> {
  const rec = await getNpsRecord(slug);
  const sends = [{ at: nowMs, by }, ...rec.meta.sends].slice(0, MAX_SENDS);
  const meta: NpsMeta = {
    ...rec.meta,
    lastSentAt: nowMs,
    nextDueAt: deriveNextDue(rec.submissions, nowMs),
    sends,
  };
  if (npsStorageConfigured) {
    await kv.set(key(slug), { submissions: rec.submissions, meta });
  }
  return meta;
}

/** Latest submission summary for a client, as shown on the SEO department
 *  board next to the consultant name. */
export type NpsSummary = {
  /** Índice de satisfação global (0–10, 1 casa decimal). */
  overall: number;
  /** Resposta de continuidade (0–10). */
  nps: number;
  category: NpsCategory;
  submittedAt: number;
};

/** O histórico inteiro de muitos clientes numa SÓ operação KV (mget) — para
 *  o bónus NPS da Documentação, que precisa das respostas de cada mês e não só
 *  da última. Clientes sem registo vêm vazios. Nunca lança. */
export async function getNpsRecordsFor(
  slugs: string[],
): Promise<Record<string, NpsRecord>> {
  const out: Record<string, NpsRecord> = {};
  const unique = [...new Set(slugs)];
  if (!npsStorageConfigured || unique.length === 0) return out;
  try {
    const rows = await kv.mget<Array<Partial<NpsRecord> | null>>(
      ...unique.map(key),
    );
    unique.forEach((slug, i) => {
      out[slug] = normalizeRecord(rows?.[i] ?? null);
    });
  } catch (err) {
    console.error("KV nps records mget failed:", err);
  }
  return out;
}

/** Latest NPS summary for many clients in ONE KV operation (mget).
 *  Slugs without a record — or whose only submissions are from an older
 *  survey schema — are simply absent from the map. Never throws: the
 *  department board must render even with KV down. */
export async function getLatestNpsSummaries(
  slugs: string[],
): Promise<Record<string, NpsSummary>> {
  const out: Record<string, NpsSummary> = {};
  const unique = [...new Set(slugs)];
  if (!npsStorageConfigured || unique.length === 0) return out;
  try {
    const rows = await kv.mget<Array<Partial<NpsRecord> | null>>(
      ...unique.map(key),
    );
    unique.forEach((slug, i) => {
      const latest = normalizeRecord(rows?.[i] ?? null).submissions[0];
      if (!latest) return;
      out[slug] = {
        overall: latest.scores.overall,
        nps: latest.scores.nps,
        category: latest.scores.category,
        submittedAt: latest.submittedAt,
      };
    });
  } catch (err) {
    console.error("KV nps mget failed:", err);
  }
  return out;
}
