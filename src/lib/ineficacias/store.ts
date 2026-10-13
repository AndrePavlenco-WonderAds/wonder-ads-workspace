// Registo das Ineficácias — server-only. Dados de RH: só as rotas com gate
// chegam aqui, e nada do conteúdo vai para os logs.
//
// CHAVES:
//   `ineficacias:report:<id>`           → um relatório semanal assinado. O
//                                         conteúdo do consultor nunca muda
//                                         depois da assinatura; a direção só
//                                         acrescenta pontuações e a revisão.
//   `ineficacias:user:<username>`       → ids dos relatórios da pessoa (LPUSH,
//                                         mais recente à cabeça).
//   `ineficacias:ids`                   → ids de todos os relatórios (o índice
//                                         da direção).
//   `ineficacias:week:<username>:<W>`   → o id do relatório dessa semana. É
//                                         escrito com NX ANTES do relatório —
//                                         dois cliques em «Assinar» não dão
//                                         dois relatórios da mesma semana.
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
  isWeekKey,
  occurrencesOf,
  weekRange,
  NOTICED_OPTIONS,
  REASONS,
  MAX_POINTS,
  LIMITS,
  type DirectOccurrence,
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
const WEEK_PREFIX = "ineficacias:week:";
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
const weekKey = (u: string, w: string) => `${WEEK_PREFIX}${u}:${w}`;
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
    score: sanitizeScore(it.score),
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
  if (!isWeekKey(r.weekKey)) return null;
  const sig = (r.signature && typeof r.signature === "object" ? r.signature : {}) as Record<string, unknown>;
  const signature: IneficaciaSignature = {
    fullName: str(sig.fullName, 160),
    signedAt: str(sig.signedAt, 40),
    userId: str(sig.userId, 64),
    ip: str(sig.ip, 120),
    userAgent: str(sig.userAgent, 400),
    hash: str(sig.hash, 64),
  };
  const range = weekRange(r.weekKey)!;
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
    weekKey: r.weekKey,
    weekStart: isISODate(r.weekStart) ? r.weekStart : range.start,
    weekEnd: isISODate(r.weekEnd) ? r.weekEnd : range.end,
    items,
    noErrors: r.noErrors === true,
    signature,
    createdAt: num(r.createdAt),
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
    occurredOn: d.occurredOn,
    noticed: NOTICED_IDS.has(str(d.noticed)) ? (d.noticed as IneficaciaNoticed) : "equipa",
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
  weekKey: string;
  noErrors: boolean;
  items: IneficaciaItem[];
  signature: Omit<IneficaciaSignature, "hash">;
};

export type SubmitResult =
  | { ok: true; report: IneficaciaReport }
  | { ok: false; reason: "duplicate" };

/** Grava um relatório assinado. O hash é calculado AQUI, sobre o conteúdo
 *  canónico, e fica dentro da assinatura. */
export async function submitReport(input: SubmitInput): Promise<SubmitResult> {
  assertConfigured();
  const range = weekRange(input.weekKey);
  if (!range) throw new Error("Semana inválida.");
  const id = newId();
  // Uma semana, um relatório: o lock entra primeiro e só uma escrita ganha.
  const locked = await kv.set(weekKey(input.username, input.weekKey), id, { nx: true });
  if (locked !== "OK") return { ok: false, reason: "duplicate" };

  const hash = sha256(
    canonicalContent({
      username: input.username,
      weekKey: input.weekKey,
      noErrors: input.noErrors,
      items: input.items,
      fullName: input.signature.fullName,
    }),
  );
  const n = await kv.incr(COUNTER_KEY);
  const year = input.signature.signedAt.slice(0, 4) || String(new Date().getUTCFullYear());
  const report: IneficaciaReport = {
    id,
    ref: `INE-${year}-${String(n).padStart(3, "0")}`,
    rev: 1,
    username: input.username,
    name: input.name,
    role: input.role,
    dept: input.dept,
    weekKey: input.weekKey,
    weekStart: range.start,
    weekEnd: range.end,
    items: input.items,
    noErrors: input.noErrors,
    signature: { ...input.signature, hash },
    createdAt: Date.now(),
    review: null,
  };
  try {
    await kv.set(reportKey(id), report);
    await kv.lpush(userKey(input.username), id);
    await kv.lpush(IDS_KEY, id);
  } catch (err) {
    // O lock entrou antes da escrita: se a escrita falhou, solta-se o lock
    // (e o registo meio-gravado) para a pessoa poder tentar outra vez — senão
    // a semana ficava «já submetida» para sempre.
    await kv.del(weekKey(input.username, input.weekKey), reportKey(id)).catch(() => {});
    throw err;
  }
  return { ok: true, report };
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
  out.sort((a, b) => b.weekKey.localeCompare(a.weekKey) || b.createdAt - a.createdAt);
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
  | { ok: false; reason: "not-found" | "no-item" | "unscored" };

/** A direção pontua uma ocorrência de um relatório. Quando todas ficam
 *  pontuadas, a revisão fecha-se sozinha. */
export async function scoreItem(
  reportId: string,
  itemId: string,
  score: Omit<IneficaciaScore, "at">,
): Promise<ScoreResult> {
  assertConfigured();
  const report = await getReport(reportId);
  if (!report) return { ok: false, reason: "not-found" };
  const item = report.items.find((it) => it.id === itemId);
  if (!item) return { ok: false, reason: "no-item" };
  const at = Date.now();
  item.score = { ...score, at };
  report.rev += 1;
  if (!report.review && report.items.every((it) => it.score)) {
    report.review = { by: score.by, byName: score.byName, at, note: "" };
  }
  await kv.set(reportKey(report.id), report);
  return { ok: true, report };
}

/** Marca um relatório como visto/revisto (para os «sem erros», ou para
 *  fechar com uma nota). */
export async function markReviewed(
  reportId: string,
  by: { username: string; name: string },
  note: string,
): Promise<ScoreResult> {
  assertConfigured();
  const report = await getReport(reportId);
  if (!report) return { ok: false, reason: "not-found" };
  // Fechar a revisão com ocorrências por pontuar tirava-as da fila sem nunca
  // entrarem no PA/NO — primeiro pontuam-se todas.
  if (report.items.some((it) => !it.score)) return { ok: false, reason: "unscored" };
  report.review = { by: by.username, byName: by.name, at: Date.now(), note: note.slice(0, LIMITS.note.max) };
  report.rev += 1;
  await kv.set(reportKey(report.id), report);
  return { ok: true, report };
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
  const ledger = await getLedger(username);
  const full = { ...event, id: newId(), createdAt: Date.now() } as LedgerEvent;
  ledger.events.push(full);
  await saveLedger(ledger);
  return ledger;
}

export async function addDirectOccurrence(
  username: string,
  occ: Omit<DirectOccurrence, "id" | "createdAt">,
): Promise<IneficaciaLedger> {
  assertConfigured();
  const ledger = await getLedger(username);
  ledger.direct.push({ ...occ, id: newId(), createdAt: Date.now() });
  await saveLedger(ledger);
  return ledger;
}

/** Repontua uma ocorrência registada pela direção. */
export async function rescoreDirect(
  username: string,
  occurrenceId: string,
  score: Omit<IneficaciaScore, "at">,
): Promise<IneficaciaLedger | null> {
  assertConfigured();
  const ledger = await getLedger(username);
  const d = ledger.direct.find((x) => x.id === occurrenceId);
  if (!d) return null;
  d.score = { ...score, at: Date.now() };
  await saveLedger(ledger);
  return ledger;
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
      weekKey: report.weekKey,
      noErrors: report.noErrors,
      items: report.items,
      fullName: report.signature.fullName,
    }),
  );
  return expected === report.signature.hash;
}
