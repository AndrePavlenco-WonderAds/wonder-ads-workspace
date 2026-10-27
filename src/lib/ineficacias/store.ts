// Registo das Ineficácias — server-only. Dados de RH: só as rotas com gate
// chegam aqui, e nada do conteúdo vai para os logs.
//
// CHAVES:
//   `ineficacias:report:<id>`           → um relatório assinado. O
//                                         conteúdo do consultor nunca muda
//                                         depois da assinatura; a direção só
//                                         acrescenta pontuações e a revisão.
//   `ineficacias:user:<username>`       → ids dos relatórios da pessoa (LPUSH,
//                                         mais recente à cabeça).
//   `ineficacias:ids`                   → ids de todos os relatórios (o índice
//                                         da direção).
//   `ineficacias:nonce:<username>:<n>`  → a folha que já foi assinada (TTL 1
//                                         dia). O consultor assina quantos
//                                         relatórios quiser, quando quiser; isto
//                                         só impede que um duplo clique (ou um
//                                         reenvio da rede) dê dois relatórios.
//   `ineficacias:counter`               → INCR atómico da referência humana
//                                         (INE-2026-007).
//   `ineficacias:ledger:<username>`     → os eventos da direção (medidas e
//                                         níveis definidos à mão) e as
//                                         ocorrências registadas por ela.
//
// O estado (PA, NO, nível, medida por aplicar) NUNCA se grava: deriva-se em
// cada leitura com `deriveLedger` — ver shared.ts.

import "server-only";
import { createHash } from "node:crypto";
import { kv } from "@vercel/kv";
import {
  canonicalContent,
  deriveLedger,
  isISODate,
  isSelfScore,
  lisbonDateOf,
  occurrencesOf,
  redactForConsultant,
  suggestScore,
  ERROR_TYPES,
  IMPACTS,
  NOTICED_OPTIONS,
  REASONS,
  MAX_POINTS,
  LIMITS,
  type DirectOccurrence,
  type IneficaciaErrorType,
  type IneficaciaImpact,
  type IneficaciaItem,
  type IneficaciaLedger,
  type IneficaciaLevel,
  type IneficaciaNoticed,
  type IneficaciaReason,
  type IneficaciaReport,
  type IneficaciaReview,
  type IneficaciaScore,
  type IneficaciaSignature,
  type LedgerEvent,
  type LedgerState,
  type Occurrence,
} from "./shared";

const REPORT_PREFIX = "ineficacias:report:";
const USER_PREFIX = "ineficacias:user:";
const IDS_KEY = "ineficacias:ids";
const NONCE_PREFIX = "ineficacias:nonce:";
const COUNTER_KEY = "ineficacias:counter";
const LEDGER_PREFIX = "ineficacias:ledger:";
/** Teto de segurança para os mget. */
const MAX_READ = 400;

export const ineficaciasConfigured = Boolean(
  process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN,
);

const newId = () => crypto.randomUUID();

const reportKey = (id: string) => `${REPORT_PREFIX}${id}`;
const userKey = (u: string) => `${USER_PREFIX}${u}`;
const nonceKey = (u: string, n: string) => `${NONCE_PREFIX}${u}:${n}`;
const ledgerKey = (u: string) => `${LEDGER_PREFIX}${u}`;

function logError(what: string, err: unknown) {
  console.error(`Ineficácias: ${what}:`, err instanceof Error ? err.message : "erro desconhecido");
}

function assertConfigured() {
  if (!ineficaciasConfigured) throw new Error("KV storage not configured on this deployment.");
}

export function sha256(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

/* ------------------------------------------------------------------ */
/*  Sanitização das leituras (o KV devolve objetos crus)               */
/* ------------------------------------------------------------------ */

const REASON_IDS = new Set<string>(REASONS.map((r) => r.id));
const NOTICED_IDS = new Set<string>(NOTICED_OPTIONS.map((n) => n.id));
const ERROR_TYPE_IDS = new Set<string>(ERROR_TYPES.map((t) => t.id));
const IMPACT_IDS = new Set<string>(IMPACTS.map((i) => i.id));

function str(v: unknown, max = 4000): string {
  return typeof v === "string" ? v.slice(0, max) : "";
}
function num(v: unknown, fallback = 0): number {
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}

function sanitizeScore(raw: unknown): IneficaciaScore | null {
  if (!raw || typeof raw !== "object") return null;
  const s = raw as Record<string, unknown>;
  const points = Math.round(num(s.points, -1));
  if (points < 0 || points > MAX_POINTS) return null;
  return { points, by: str(s.by, 64), byName: str(s.byName, 120), at: num(s.at), note: str(s.note, LIMITS.note.max) };
}

function sanitizeItem(raw: unknown): IneficaciaItem | null {
  if (!raw || typeof raw !== "object") return null;
  const it = raw as Record<string, unknown>;
  if (typeof it.id !== "string" || !it.id) return null;
  const reason = REASON_IDS.has(str(it.reason)) ? (it.reason as IneficaciaReason) : "outro";
  const noticed = NOTICED_IDS.has(str(it.noticed)) ? (it.noticed as IneficaciaNoticed) : "proprio";
  return {
    id: it.id,
    what: str(it.what),
    client: str(it.client, 200),
    reason,
    reasonOther: str(it.reasonOther, 300),
    shouldHave: str(it.shouldHave),
    firstTime: it.firstTime !== false,
    lastTime: str(it.lastTime, 300),
    occurredOn: isISODate(it.occurredOn) ? it.occurredOn : "",
    noticed,
    // Relatórios anteriores à v78.23 não têm autoavaliação.
    selfScore: isSelfScore(it.selfScore) ? it.selfScore : null,
    score: sanitizeScore(it.score),
    ...sanitizeAssessment(it),
  };
}

/** A calculadora da direção (v77.93 nas diretas, v77.94 nos relatórios) —
 *  os registos antigos não a têm. */
function sanitizeAssessment(r: Record<string, unknown>): Pick<DirectOccurrence, "errorType" | "impacts" | "suggestedPoints"> {
  return {
    errorType: ERROR_TYPE_IDS.has(str(r.errorType)) ? (r.errorType as IneficaciaErrorType) : null,
    impacts: Array.isArray(r.impacts) ? [...new Set(r.impacts.filter((i): i is IneficaciaImpact => IMPACT_IDS.has(str(i))))] : [],
    suggestedPoints:
      typeof r.suggestedPoints === "number" && Number.isInteger(r.suggestedPoints) && r.suggestedPoints >= 0 && r.suggestedPoints <= MAX_POINTS
        ? r.suggestedPoints
        : null,
  };
}

function sanitizeReview(raw: unknown): IneficaciaReview | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.at !== "number") return null;
  return { by: str(r.by, 64), byName: str(r.byName, 120), at: r.at, note: str(r.note, LIMITS.note.max) };
}

export function sanitizeReport(raw: unknown): IneficaciaReport | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.id !== "string" || !r.id) return null;
  if (typeof r.username !== "string" || !r.username) return null;
  const sig = (r.signature && typeof r.signature === "object" ? r.signature : {}) as Record<string, unknown>;
  const signature: IneficaciaSignature = {
    fullName: str(sig.fullName, 160),
    signedAt: str(sig.signedAt, 40),
    userId: str(sig.userId, 64),
    ip: str(sig.ip, 120),
    userAgent: str(sig.userAgent, 400),
    hash: str(sig.hash, 64),
  };
  const createdAt = num(r.createdAt);
  const submittedOn = isISODate(r.submittedOn)
    ? r.submittedOn
    : signature.signedAt
      ? lisbonDateOf(signature.signedAt)
      : lisbonDateOf(createdAt || Date.now());
  const items = Array.isArray(r.items)
    ? r.items.map(sanitizeItem).filter((x): x is IneficaciaItem => x !== null)
    : [];
  return {
    id: r.id,
    ref: str(r.ref, 40),
    rev: Math.max(1, Math.round(num(r.rev, 1))),
    username: r.username,
    name: str(r.name, 120),
    role: str(r.role, 120),
    dept: str(r.dept, 60),
    submittedOn,
    items,
    signature,
    createdAt,
    review: sanitizeReview(r.review),
  };
}

function sanitizeEvent(raw: unknown): LedgerEvent | null {
  if (!raw || typeof raw !== "object") return null;
  const e = raw as Record<string, unknown>;
  if (typeof e.id !== "string" || !e.id || !isISODate(e.at)) return null;
  const level = Math.round(num(e.level, -1));
  const base = { id: e.id, at: e.at, by: str(e.by, 64), byName: str(e.byName, 120), note: str(e.note, LIMITS.note.max), createdAt: num(e.createdAt) };
  if (e.kind === "measure") {
    if (level < 1 || level > 3) return null;
    return {
      kind: "measure",
      ...base,
      level: level as 1 | 2 | 3,
      conductedBy: str(e.conductedBy, 120),
      actions: Array.isArray(e.actions) ? e.actions.map((a) => str(a, LIMITS.action.max)).filter(Boolean).slice(0, 6) : [],
    };
  }
  if (e.kind === "set-level") {
    if (level < 0 || level > 3) return null;
    return { kind: "set-level", ...base, level: level as IneficaciaLevel };
  }
  return null;
}

function sanitizeDirect(raw: unknown): DirectOccurrence | null {
  if (!raw || typeof raw !== "object") return null;
  const d = raw as Record<string, unknown>;
  if (typeof d.id !== "string" || !d.id || !isISODate(d.occurredOn)) return null;
  const score = sanitizeScore(d.score);
  if (!score) return null;
  return {
    id: d.id,
    what: str(d.what),
    client: str(d.client, 200),
    reason: REASON_IDS.has(str(d.reason)) ? (d.reason as IneficaciaReason) : "outro",
    reasonOther: str(d.reasonOther, 300),
    shouldHave: str(d.shouldHave),
    // Registos anteriores à v77.90 não têm a «primeira vez» → não indicado.
    firstTime: typeof d.firstTime === "boolean" ? d.firstTime : null,
    lastTime: str(d.lastTime, 300),
    occurredOn: d.occurredOn,
    noticed: NOTICED_IDS.has(str(d.noticed)) ? (d.noticed as IneficaciaNoticed) : "equipa",
    ...sanitizeAssessment(d),
    score,
    createdAt: num(d.createdAt),
  };
}

export function sanitizeLedger(raw: unknown, username: string): IneficaciaLedger {
  const empty: IneficaciaLedger = { username, events: [], direct: [], updatedAt: 0 };
  if (!raw || typeof raw !== "object") return empty;
  const l = raw as Record<string, unknown>;
  return {
    username,
    events: Array.isArray(l.events) ? l.events.map(sanitizeEvent).filter((x): x is LedgerEvent => x !== null) : [],
    direct: Array.isArray(l.direct) ? l.direct.map(sanitizeDirect).filter((x): x is DirectOccurrence => x !== null) : [],
    updatedAt: num(l.updatedAt),
  };
}

/* ------------------------------------------------------------------ */
/*  Relatórios                                                          */
/* ------------------------------------------------------------------ */

export type SubmitInput = {
  username: string;
  name: string;
  role: string;
  dept: string;
  /** Identificador da folha no browser — um por folha preenchida. */
  nonce: string;
  items: IneficaciaItem[];
  signature: Omit<IneficaciaSignature, "hash">;
};

export type SubmitResult =
  | { ok: true; report: IneficaciaReport }
  | { ok: false; reason: "duplicate" };

/** Grava um relatório assinado. O hash é calculado AQUI, sobre o conteúdo
 *  canónico, e fica dentro da assinatura. O consultor assina quantos
 *  relatórios quiser; o `nonce` da folha só trava o MESMO envio duas vezes
 *  (duplo clique, reenvio da rede). */
export async function submitReport(input: SubmitInput): Promise<SubmitResult> {
  assertConfigured();
  const id = newId();
  const nk = nonceKey(input.username, input.nonce);
  const fresh = await kv.set(nk, id, { nx: true, ex: 86_400 });
  if (fresh !== "OK") return { ok: false, reason: "duplicate" };

  try {
    const submittedOn = lisbonDateOf(input.signature.signedAt);
    const hash = sha256(
      canonicalContent({
        username: input.username,
        submittedOn,
        items: input.items,
        fullName: input.signature.fullName,
      }),
    );
    const n = await kv.incr(COUNTER_KEY);
    const year = submittedOn.slice(0, 4);
    const report: IneficaciaReport = {
      id,
      ref: `INE-${year}-${String(n).padStart(3, "0")}`,
      rev: 1,
      username: input.username,
      name: input.name,
      role: input.role,
      dept: input.dept,
      submittedOn,
      items: input.items,
      signature: { ...input.signature, hash },
      createdAt: Date.now(),
      review: null,
    };
    await kv.set(reportKey(id), report);
    await kv.lpush(userKey(input.username), id);
    await kv.lpush(IDS_KEY, id);
    return { ok: true, report };
  } catch (err) {
    // Falhou a meio: solta-se a folha (para poder tentar outra vez) e o
    // registo meio-gravado.
    await kv.del(nk, reportKey(id)).catch(() => {});
    throw err;
  }
}

/* ------------------------------------------------------------------ */
/*  Trinco curto por chave — as escritas da direção                    */
/* ------------------------------------------------------------------ */

const LOCK_PREFIX = "ineficacias:lock:";

/** Serializa um get→mutate→set numa chave: dois SuperAdmins a pontuar o
 *  mesmo relatório ao mesmo tempo deixavam de perder uma das pontuações.
 *  SET NX com TTL curto, algumas tentativas, e só se apaga o próprio token. */
async function withLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const lockKey = `${LOCK_PREFIX}${key}`;
  const token = newId();
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const got = await kv.set(lockKey, token, { nx: true, px: 5000 });
    if (got === "OK") {
      try {
        return await fn();
      } finally {
        try {
          if ((await kv.get<string>(lockKey)) === token) await kv.del(lockKey);
        } catch {
          /* o TTL trata do resto */
        }
      }
    }
    await new Promise((r) => setTimeout(r, 120 + attempt * 60));
  }
  throw new Error("Registo ocupado — tenta outra vez.");
}

export async function getReport(id: string): Promise<IneficaciaReport | null> {
  if (!ineficaciasConfigured || !id) return null;
  try {
    return sanitizeReport(await kv.get<unknown>(reportKey(id)));
  } catch (err) {
    logError("leitura do relatório falhou", err);
    return null;
  }
}

async function readMany(ids: string[]): Promise<IneficaciaReport[]> {
  if (ids.length === 0) return [];
  const rows = await kv.mget<unknown[]>(...ids.map(reportKey));
  const out: IneficaciaReport[] = [];
  for (const row of rows ?? []) {
    const r = sanitizeReport(row);
    if (r) out.push(r);
  }
  // Mais recentes primeiro — pela semana, e dentro da mesma pela assinatura.
  out.sort((a, b) => b.createdAt - a.createdAt);
  return out;
}

/** Os relatórios de UMA pessoa. É a única leitura que a página do consultor
 *  faz — nunca vê os dos colegas. */
export async function listReportsForUser(username: string): Promise<IneficaciaReport[]> {
  if (!ineficaciasConfigured || !username) return [];
  try {
    const ids = await kv.lrange<string>(userKey(username), 0, MAX_READ - 1);
    const reports = await readMany(ids ?? []);
    // Cinto e suspensórios: o índice é da pessoa, mas o registo também diz
    // de quem é.
    return reports.filter((r) => r.username === username);
  } catch (err) {
    logError("lista do consultor falhou", err);
    return [];
  }
}

/** Todos os relatórios — só a direção. */
export async function listAllReports(): Promise<IneficaciaReport[]> {
  if (!ineficaciasConfigured) return [];
  try {
    const ids = await kv.lrange<string>(IDS_KEY, 0, MAX_READ - 1);
    return await readMany(ids ?? []);
  } catch (err) {
    logError("lista geral falhou", err);
    return [];
  }
}

export type ScoreResult =
  | { ok: true; report: IneficaciaReport }
  | { ok: false; reason: "not-found" | "no-item" };

/** A direção pontua uma ocorrência de um relatório. Quando todas ficam
 *  pontuadas, a revisão fecha-se sozinha. */
/** A avaliação que a direção fez na calculadora ao pontuar. A sugestão é
 *  recalculada aqui com os dados gravados da ocorrência — nunca vem do
 *  browser. */
export type AssessmentInput = { errorType: IneficaciaErrorType; impacts: IneficaciaImpact[] };

function applyAssessment(
  target: Pick<DirectOccurrence, "reason" | "firstTime" | "noticed" | "errorType" | "impacts" | "suggestedPoints">,
  a: AssessmentInput,
) {
  target.errorType = a.errorType;
  target.impacts = a.impacts;
  target.suggestedPoints = suggestScore({
    impacts: a.impacts,
    reason: target.reason,
    firstTime: target.firstTime,
    errorType: a.errorType,
    noticed: target.noticed,
  }).points;
}

export async function scoreItem(
  reportId: string,
  itemId: string,
  score: Omit<IneficaciaScore, "at">,
  assessment: AssessmentInput | null = null,
): Promise<ScoreResult> {
  assertConfigured();
  return withLock(reportKey(reportId), async () => {
    const report = await getReport(reportId);
    if (!report) return { ok: false, reason: "not-found" } as const;
    const item = report.items.find((it) => it.id === itemId);
    if (!item) return { ok: false, reason: "no-item" } as const;
    const at = Date.now();
    item.score = { ...score, at };
    if (assessment) applyAssessment(item, assessment);
    report.rev += 1;
    if (!report.review && report.items.every((it) => it.score)) {
      report.review = { by: score.by, byName: score.byName, at, note: "" };
    }
    await kv.set(reportKey(report.id), report);
    return { ok: true, report } as const;
  });
}

/* ------------------------------------------------------------------ */
/*  Ledger (eventos da direção + ocorrências diretas)                  */
/* ------------------------------------------------------------------ */

export async function getLedger(username: string): Promise<IneficaciaLedger> {
  const empty: IneficaciaLedger = { username, events: [], direct: [], updatedAt: 0 };
  if (!ineficaciasConfigured || !username) return empty;
  try {
    return sanitizeLedger(await kv.get<unknown>(ledgerKey(username)), username);
  } catch (err) {
    logError("leitura do ledger falhou", err);
    return empty;
  }
}

async function saveLedger(ledger: IneficaciaLedger): Promise<void> {
  ledger.updatedAt = Date.now();
  await kv.set(ledgerKey(ledger.username), ledger);
}

export async function addLedgerEvent(
  username: string,
  event: Omit<Extract<LedgerEvent, { kind: "measure" }>, "id" | "createdAt"> | Omit<Extract<LedgerEvent, { kind: "set-level" }>, "id" | "createdAt">,
): Promise<IneficaciaLedger> {
  assertConfigured();
  return withLock(ledgerKey(username), async () => {
    const ledger = await getLedger(username);
    const full = { ...event, id: newId(), createdAt: Date.now() } as LedgerEvent;
    ledger.events.push(full);
    await saveLedger(ledger);
    return ledger;
  });
}

export async function addDirectOccurrence(
  username: string,
  occ: Omit<DirectOccurrence, "id" | "createdAt">,
): Promise<IneficaciaLedger> {
  assertConfigured();
  return withLock(ledgerKey(username), async () => {
    const ledger = await getLedger(username);
    ledger.direct.push({ ...occ, id: newId(), createdAt: Date.now() });
    await saveLedger(ledger);
    return ledger;
  });
}

/** Repontua uma ocorrência registada pela direção. */
export async function rescoreDirect(
  username: string,
  occurrenceId: string,
  score: Omit<IneficaciaScore, "at">,
  assessment: AssessmentInput | null = null,
): Promise<IneficaciaLedger | null> {
  assertConfigured();
  return withLock(ledgerKey(username), async () => {
    const ledger = await getLedger(username);
    const d = ledger.direct.find((x) => x.id === occurrenceId);
    if (!d) return null;
    d.score = { ...score, at: Date.now() };
    if (assessment) applyAssessment(d, assessment);
    await saveLedger(ledger);
    return ledger;
  });
}

/* ------------------------------------------------------------------ */
/*  Leituras compostas                                                  */
/* ------------------------------------------------------------------ */

export type ConsultantBundle = {
  username: string;
  reports: IneficaciaReport[];
  ledger: IneficaciaLedger;
  occurrences: Occurrence[];
  state: LedgerState;
};

/** Tudo o que é preciso para a página de um consultor (a dele, ou a da
 *  direção sobre ele): relatórios + ledger → ocorrências → estado. */
export async function loadConsultant(username: string, todayISO: string): Promise<ConsultantBundle> {
  const [reports, ledger] = await Promise.all([listReportsForUser(username), getLedger(username)]);
  const occurrences = occurrencesOf(reports, ledger);
  return { username, reports, ledger, occurrences, state: deriveLedger(occurrences, ledger.events, todayISO) };
}

/** O que o PRÓPRIO consultor pode ver — o mesmo bundle sem a avaliação da
 *  direção (tipo de erro, impactos, sugestão da calculadora). É o único
 *  carregador das páginas, da API e do sino do consultor. */
export async function loadConsultantForSelf(username: string, todayISO: string): Promise<ConsultantBundle> {
  const [rawReports, rawLedger] = await Promise.all([listReportsForUser(username), getLedger(username)]);
  const { reports, ledger } = redactForConsultant(rawReports, rawLedger);
  const occurrences = occurrencesOf(reports, ledger);
  return { username, reports, ledger, occurrences, state: deriveLedger(occurrences, ledger.events, todayISO) };
}

/** O mesmo para a equipa inteira (o painel da direção e o sino dos
 *  SuperAdmins). Lê-se POR PESSOA (o índice dela + o ledger), em paralelo —
 *  e não pelo índice geral, cujo teto de leitura faria o estado da direção
 *  divergir do do consultor ao fim de um ano de relatórios. */
export async function loadTeam(usernames: string[], todayISO: string): Promise<Map<string, ConsultantBundle>> {
  const out = new Map<string, ConsultantBundle>();
  const bundles = await Promise.all(usernames.map((u) => loadConsultant(u, todayISO)));
  bundles.forEach((b) => out.set(b.username, b));
  return out;
}

/** Verifica a integridade de um relatório: recalcula o hash do conteúdo
 *  canónico e compara com o que está na assinatura. */
export function verifyIntegrity(report: IneficaciaReport): boolean {
  const expected = sha256(
    canonicalContent({
      username: report.username,
      submittedOn: report.submittedOn,
      items: report.items,
      fullName: report.signature.fullName,
    }),
  );
  return expected === report.signature.hash;
}
