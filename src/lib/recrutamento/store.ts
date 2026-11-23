// Recrutamento (v80.13) — KV. Node only.
//
// hr:candidates          SET com os ids
// hr:candidate:<id>      o candidato inteiro (perfil + entrevistas + decisão)
// hr:accounts            HASH username → conta criada na app (ver
//                        lib/auth/hired-accounts.ts) — escrita ao aceitar
// hr:practical-token:<t> o link público de uma prática (v80.16) →
//                        { candidateId, practicalId }
// hr:practical-sub:<id>  o que o candidato escreve na prática (só a API
//                        pública /api/candidatura escreve aqui, mais o
//                        «deixar voltar a editar» da ficha)
//
// Todas as escritas leem o registo fresco e aplicam a operação por cima (como
// as fichas do prospect). Uma só pessoa pontua uma entrevista de cada vez, e
// o browser manda os pedidos em fila, por isso não há corridas a sério.

import "server-only";
import { randomBytes, randomUUID } from "node:crypto";
import { kv } from "@vercel/kv";
import { findEmployeeByUsername, runtimeCredentials } from "@/lib/auth/credentials";
import {
  ensureHiredAccounts,
  HIRED_ACCOUNTS_KEY,
  hydrateHiredAccount,
  rememberHiredAccount,
  type HiredAccount,
} from "@/lib/auth/hired-accounts";
import { createVaultPassword } from "@/lib/access/store";
import { accessCredKey } from "@/lib/access/shared";
import { addEmployeeWithId } from "@/lib/admin-employees-store";
import { CONSULTANT_ORDER } from "@/lib/client-overrides";
import { emptyClosing, type Answer, type Closing } from "./scoring";
import {
  ACCEPT_PHRASE,
  CANDIDATE_KEY,
  CANDIDATES_INDEX_KEY,
  PRACTICAL_SUB_KEY,
  PRACTICAL_TOKEN_KEY,
  hydrateAnswer,
  hydrateCandidate,
  hydrateClosing,
  normalizePhrase,
  parseEuros,
  PROFILE_FIELDS,
  PROFILE_MAX,
  USERNAME_RE,
  type ProfileField,
  type Candidate,
  type Interview,
} from "./shared";
import { closingScreens, DEFAULT_TEMPLATE_ID, getTemplate } from "./templates";
import {
  emptyReview,
  getPracticalTemplate,
  hydrateAnswers,
  hydrateReview,
  hydrateSubmission,
  PRACTICAL_TEMPLATE_ID,
  type Practical,
  type PracticalSubmission,
} from "./practical";

export const recruitmentConfigured = Boolean(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);

export class RecruitError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

function ensureConfigured() {
  if (!recruitmentConfigured) throw new RecruitError("O armazenamento (KV) não está configurado neste ambiente.", 503);
}

export async function listCandidates(): Promise<Candidate[]> {
  if (!recruitmentConfigured) return [];
  const ids = ((await kv.smembers(CANDIDATES_INDEX_KEY)) ?? []).filter((x): x is string => typeof x === "string");
  if (!ids.length) return [];
  const raws = await kv.mget<unknown[]>(...ids.map(CANDIDATE_KEY));
  return (raws ?? [])
    .map(hydrateCandidate)
    .filter((c): c is Candidate => Boolean(c))
    .sort((a, b) => b.createdAt - a.createdAt);
}

export async function getCandidate(id: string): Promise<Candidate | null> {
  if (!recruitmentConfigured || !id) return null;
  return hydrateCandidate(await kv.get<unknown>(CANDIDATE_KEY(id)));
}

async function save(c: Candidate): Promise<Candidate> {
  c.updatedAt = Date.now();
  await kv.set(CANDIDATE_KEY(c.id), c);
  return c;
}

function newInterview(templateId: string, date: string | null): Interview {
  const t = getTemplate(templateId) ?? getTemplate(DEFAULT_TEMPLATE_ID)!;
  return {
    id: randomUUID().slice(0, 8),
    templateId: t.id,
    templateVersion: t.version,
    date,
    interviewer: null,
    startedAt: null,
    finishedAt: null,
    step: 0,
    answers: {},
    closing: emptyClosing(),
    createdAt: Date.now(),
  };
}

const clean = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const isoDay = (v: unknown) => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);

export type CandidateInput = Partial<Record<ProfileField, string>> & {
  name: string;
  salaryMonthly?: number | string | null;
  templateId?: string;
  date?: string | null;
};

export async function createCandidate(input: CandidateInput, by: string): Promise<Candidate> {
  ensureConfigured();
  const name = clean(input.name, 120);
  if (!name) throw new RecruitError("Falta o nome do candidato.");
  const templateId = getTemplate(clean(input.templateId, 100)) ? clean(input.templateId, 100) : DEFAULT_TEMPLATE_ID;
  const now = Date.now();
  const c: Candidate = {
    id: randomUUID().replace(/-/g, "").slice(0, 12),
    name,
    email: clean(input.email, 200),
    phone: clean(input.phone, 60),
    linkedin: clean(input.linkedin, 400),
    source: clean(input.source, 120),
    role: clean(input.role, 120) || getTemplate(templateId)!.role,
    notes: clean(input.notes, 8000),
    location: clean(input.location, PROFILE_MAX.location),
    interests: clean(input.interests, PROFILE_MAX.interests),
    education: clean(input.education, PROFILE_MAX.education),
    experience: clean(input.experience, PROFILE_MAX.experience),
    salaryMonthly: parseEuros(input.salaryMonthly),
    salaryNote: clean(input.salaryNote, PROFILE_MAX.salaryNote),
    status: "pipeline",
    decision: null,
    interviews: [newInterview(templateId, isoDay(input.date))],
    practicals: [],
    createdAt: now,
    createdBy: by,
    updatedAt: now,
  };
  await kv.set(CANDIDATE_KEY(c.id), c);
  await kv.sadd(CANDIDATES_INDEX_KEY, c.id);
  return c;
}

export type CandidateOp =
  | { op: "profile"; patch: ProfilePatch }
  | { op: "new-interview"; templateId?: string; date?: string | null }
  | { op: "interview-date"; interviewId: string; date: string | null }
  | { op: "start"; interviewId: string }
  | {
      op: "save";
      interviewId: string;
      answers?: Record<string, unknown>;
      closing?: unknown;
      step?: number;
      /** Fase 1 (v80.22): os campos do perfil escritos no ecrã da pergunta.
       *  Vão na mesma fila da entrevista para os dois nunca se pisarem. */
      profile?: ProfilePatch;
    }
  | { op: "finish"; interviewId: string }
  | { op: "reopen"; interviewId: string }
  | { op: "delete-interview"; interviewId: string }
  | { op: "reject"; note?: string }
  | { op: "undo-reject" }
  // Prática — Fase 2 · Parte 2 (v80.16)
  | { op: "new-practical"; site: string; date?: string | null }
  | { op: "practical-meta"; practicalId: string; site?: string; date?: string | null }
  | { op: "practical-review"; practicalId: string; review: unknown }
  | { op: "practical-close"; practicalId: string }
  | { op: "practical-reopen"; practicalId: string }
  | { op: "practical-unlock"; practicalId: string }
  | { op: "practical-new-link"; practicalId: string }
  | { op: "delete-practical"; practicalId: string };

function practicalOf(c: Candidate, id: string): Practical {
  const p = c.practicals.find((x) => x.id === id);
  if (!p) throw new RecruitError("Esta prática já não existe.", 404);
  return p;
}

/** O segredo do link do candidato: 24 caracteres, impossível de adivinhar. */
function newPracticalToken(): string {
  return randomBytes(18).toString("base64url");
}

/** «site.pt» → «https://site.pt/». Vazio = erro (o guião pede o site). */
function cleanSite(v: unknown): string {
  const raw = clean(v, 400);
  if (!raw) throw new RecruitError("Falta o site que o candidato vai auditar.");
  const withProto = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  try {
    const u = new URL(withProto);
    if (!/^https?:$/.test(u.protocol) || !u.hostname.includes(".")) throw new Error("bad");
    return u.toString();
  } catch {
    throw new RecruitError("Esse site não parece um endereço válido.");
  }
}

type ProfilePatch = Partial<Record<ProfileField, string>> & { salaryMonthly?: number | string | null };

function applyProfilePatch(c: Candidate, patch: unknown) {
  const p = (patch && typeof patch === "object" ? patch : {}) as Record<string, unknown>;
  for (const field of PROFILE_FIELDS) {
    if (p[field] === undefined) continue;
    const v = clean(p[field], PROFILE_MAX[field]);
    if (field === "name") {
      if (!v) throw new RecruitError("O nome não pode ficar vazio.");
      c.name = v;
    } else if (field === "role") {
      c.role = v || c.role;
    } else {
      c[field] = v;
    }
  }
  if (p.salaryMonthly !== undefined) c.salaryMonthly = parseEuros(p.salaryMonthly);
}

function interviewOf(c: Candidate, id: string): Interview {
  const i = c.interviews.find((x) => x.id === id);
  if (!i) throw new RecruitError("Esta entrevista já não existe.", 404);
  return i;
}

export async function applyCandidateOp(id: string, op: CandidateOp, by: string): Promise<Candidate> {
  ensureConfigured();
  const c = await getCandidate(id);
  if (!c) throw new RecruitError("Candidato não encontrado.", 404);
  const now = Date.now();

  switch (op.op) {
    case "profile": {
      applyProfilePatch(c, op.patch);
      break;
    }
    case "new-interview": {
      if (c.status === "aceite") throw new RecruitError("Este candidato já foi aceite.", 409);
      const templateId = getTemplate(clean(op.templateId, 100)) ? clean(op.templateId, 100) : DEFAULT_TEMPLATE_ID;
      c.interviews.push(newInterview(templateId, isoDay(op.date)));
      break;
    }
    case "interview-date": {
      interviewOf(c, op.interviewId).date = isoDay(op.date);
      break;
    }
    case "start": {
      const i = interviewOf(c, op.interviewId);
      i.startedAt ??= now;
      i.interviewer ??= by;
      break;
    }
    case "save": {
      const i = interviewOf(c, op.interviewId);
      const t = getTemplate(i.templateId);
      if (!t) throw new RecruitError("O template desta entrevista já não existe.", 409);
      i.startedAt ??= now;
      i.interviewer ??= by;
      if (op.answers && typeof op.answers === "object") {
        const known = new Set(t.questions.map((q) => q.id));
        for (const [qid, raw] of Object.entries(op.answers)) {
          if (!known.has(qid)) continue;
          const q = t.questions.find((x) => x.id === qid)!;
          const a: Answer = hydrateAnswer(raw);
          // Só ids que existem na pergunta.
          a.checked = a.checked.filter((cid) => q.criteria.some((cr) => cr.id === cid));
          a.flags = a.flags.filter((fid) => q.penalties.some((p) => p.id === fid));
          i.answers[qid] = a;
        }
      }
      if (op.closing !== undefined) i.closing = hydrateClosing(op.closing) as Closing;
      if (typeof op.step === "number" && Number.isFinite(op.step)) {
        i.step = Math.max(0, Math.min(t.questions.length + closingScreens(t), Math.floor(op.step)));
      }
      if (op.profile !== undefined) {
        // Só os campos que as perguntas da entrevista preenchem.
        const allowed = new Set<string>(
          t.questions.flatMap((q) => (q.profile === "salary" ? ["salaryMonthly", "salaryNote"] : q.profile ? [q.profile] : [])),
        );
        const raw = (op.profile && typeof op.profile === "object" ? op.profile : {}) as Record<string, unknown>;
        applyProfilePatch(c, Object.fromEntries(Object.entries(raw).filter(([k]) => allowed.has(k))));
      }
      break;
    }
    case "finish": {
      const i = interviewOf(c, op.interviewId);
      i.startedAt ??= now;
      i.finishedAt = now;
      break;
    }
    case "reopen": {
      if (c.status === "aceite") throw new RecruitError("Este candidato já foi aceite.", 409);
      interviewOf(c, op.interviewId).finishedAt = null;
      break;
    }
    case "delete-interview": {
      if (c.interviews.length <= 1) throw new RecruitError("O candidato precisa de ter pelo menos uma entrevista.");
      c.interviews = c.interviews.filter((x) => x.id !== op.interviewId);
      break;
    }
    case "reject": {
      if (c.status === "aceite") throw new RecruitError("Este candidato já foi aceite — a conta já existe.", 409);
      c.status = "recusado";
      c.decision = { kind: "recusado", at: now, by, note: clean(op.note, 2000) };
      break;
    }
    case "undo-reject": {
      if (c.status !== "recusado") throw new RecruitError("Este candidato não está recusado.", 409);
      c.status = "pipeline";
      c.decision = null;
      break;
    }
    case "new-practical": {
      if (c.status === "aceite") throw new RecruitError("Este candidato já foi aceite.", 409);
      const t = getPracticalTemplate(PRACTICAL_TEMPLATE_ID)!;
      const p: Practical = {
        id: randomUUID().slice(0, 8),
        templateId: t.id,
        templateVersion: t.version,
        token: newPracticalToken(),
        site: cleanSite(op.site),
        date: isoDay(op.date),
        createdAt: now,
        createdBy: by,
        review: emptyReview(),
        reviewer: null,
        reviewedAt: null,
      };
      await kv.set(PRACTICAL_TOKEN_KEY(p.token), { candidateId: c.id, practicalId: p.id });
      c.practicals.push(p);
      break;
    }
    case "practical-meta": {
      const p = practicalOf(c, op.practicalId);
      if (op.site !== undefined) p.site = cleanSite(op.site);
      if (op.date !== undefined) p.date = isoDay(op.date);
      break;
    }
    case "practical-review": {
      const p = practicalOf(c, op.practicalId);
      p.review = hydrateReview(op.review);
      p.reviewer ??= by;
      break;
    }
    case "practical-close": {
      const p = practicalOf(c, op.practicalId);
      p.reviewedAt = now;
      p.reviewer ??= by;
      break;
    }
    case "practical-reopen": {
      if (c.status === "aceite") throw new RecruitError("Este candidato já foi aceite.", 409);
      practicalOf(c, op.practicalId).reviewedAt = null;
      break;
    }
    case "practical-unlock": {
      // O candidato volta a poder mexer na entrega (e a avaliação reabre).
      if (c.status === "aceite") throw new RecruitError("Este candidato já foi aceite.", 409);
      const p = practicalOf(c, op.practicalId);
      const sub = await getPracticalSubmission(p.id);
      sub.submittedAt = null;
      sub.updatedAt = now;
      await kv.set(PRACTICAL_SUB_KEY(p.id), sub);
      p.reviewedAt = null;
      break;
    }
    case "practical-new-link": {
      const p = practicalOf(c, op.practicalId);
      const old = p.token;
      p.token = newPracticalToken();
      await kv.set(PRACTICAL_TOKEN_KEY(p.token), { candidateId: c.id, practicalId: p.id });
      await kv.del(PRACTICAL_TOKEN_KEY(old));
      break;
    }
    case "delete-practical": {
      const p = practicalOf(c, op.practicalId);
      c.practicals = c.practicals.filter((x) => x.id !== p.id);
      await kv.del(PRACTICAL_TOKEN_KEY(p.token), PRACTICAL_SUB_KEY(p.id));
      break;
    }
    default:
      throw new RecruitError("Operação desconhecida.");
  }
  return save(c);
}

export async function deleteCandidate(id: string): Promise<void> {
  ensureConfigured();
  const c = await getCandidate(id);
  if (!c) return;
  if (c.status === "aceite") throw new RecruitError("Um candidato aceite já tem conta na app — não se apaga daqui.", 409);
  const practicalKeys = c.practicals.flatMap((p) => [PRACTICAL_TOKEN_KEY(p.token), PRACTICAL_SUB_KEY(p.id)]);
  await kv.del(CANDIDATE_KEY(id), ...practicalKeys);
  await kv.srem(CANDIDATES_INDEX_KEY, id);
}

// ---------------------------------------------------------------------------
// Prática — o lado do candidato (link público /candidatura/<token>)
// ---------------------------------------------------------------------------

export async function getPracticalSubmission(practicalId: string): Promise<PracticalSubmission> {
  return hydrateSubmission(await kv.get<unknown>(PRACTICAL_SUB_KEY(practicalId)));
}

export async function getPracticalSubmissions(ids: string[]): Promise<Record<string, PracticalSubmission>> {
  const out: Record<string, PracticalSubmission> = {};
  if (!recruitmentConfigured || !ids.length) return out;
  const raws = await kv.mget<unknown[]>(...ids.map(PRACTICAL_SUB_KEY));
  ids.forEach((id, i) => {
    out[id] = hydrateSubmission(raws?.[i]);
  });
  return out;
}

const TOKEN_RE = /^[A-Za-z0-9_-]{16,80}$/;

/** O candidato e a prática de um link. null = link inválido ou revogado. */
export async function resolvePracticalToken(
  token: string,
): Promise<{ candidate: Candidate; practical: Practical } | null> {
  if (!recruitmentConfigured || !TOKEN_RE.test(token)) return null;
  const ref = await kv.get<{ candidateId?: unknown; practicalId?: unknown }>(PRACTICAL_TOKEN_KEY(token));
  if (!ref || typeof ref.candidateId !== "string" || typeof ref.practicalId !== "string") return null;
  const candidate = await getCandidate(ref.candidateId);
  const practical = candidate?.practicals.find((p) => p.id === ref.practicalId && p.token === token);
  if (!candidate || !practical) return null;
  return { candidate, practical };
}

/** Um link que já não recebe nada: candidato recusado. */
export function practicalLinkClosed(c: Candidate): boolean {
  return c.status === "recusado";
}

export type CandidatePracticalAction =
  | { action: "open" }
  | { action: "start" }
  | { action: "save"; answers: unknown }
  | { action: "submit"; answers?: unknown };

export async function candidatePracticalAction(token: string, act: CandidatePracticalAction): Promise<PracticalSubmission> {
  ensureConfigured();
  const r = await resolvePracticalToken(token);
  if (!r || practicalLinkClosed(r.candidate)) throw new RecruitError("Este link já não está ativo.", 404);
  const key = PRACTICAL_SUB_KEY(r.practical.id);
  const sub = await getPracticalSubmission(r.practical.id);
  const now = Date.now();
  switch (act.action) {
    case "open": {
      if (sub.openedAt) return sub;
      sub.openedAt = now;
      break;
    }
    case "start": {
      if (sub.startedAt) return sub;
      sub.openedAt ??= now;
      sub.startedAt = now;
      break;
    }
    case "save": {
      if (sub.submittedAt) throw new RecruitError("A prova já foi entregue — já não dá para mudar.", 409);
      sub.openedAt ??= now;
      sub.startedAt ??= now;
      sub.answers = hydrateAnswers(act.answers);
      break;
    }
    case "submit": {
      if (sub.submittedAt) return sub;
      if (act.answers !== undefined) sub.answers = hydrateAnswers(act.answers);
      sub.openedAt ??= now;
      sub.startedAt ??= now;
      sub.submittedAt = now;
      break;
    }
    default:
      throw new RecruitError("Pedido inválido.");
  }
  sub.updatedAt = now;
  await kv.set(key, sub);
  return sub;
}

// ---------------------------------------------------------------------------
// Aceitar → conta na app + equipa + SEO DPT
// ---------------------------------------------------------------------------

export type AcceptInput = {
  phrase: string;
  username: string;
  name: string;
  role: string;
  startDate: string | null;
  note?: string;
};

export type AcceptResult = {
  candidate: Candidate;
  account: HiredAccount;
  /** A password gerada (só quando a conta nasceu agora). */
  password: string | null;
};

/** Os nomes que já são colunas no SEO DPT (código + contas criadas na app). */
function takenColumnNames(exceptUsername: string): Set<string> {
  const names = new Set<string>(CONSULTANT_ORDER as readonly string[]);
  for (const c of runtimeCredentials()) if (c.username !== exceptUsername) names.add(c.name);
  return names;
}

export async function acceptCandidate(id: string, input: AcceptInput, by: string): Promise<AcceptResult> {
  ensureConfigured();
  if (normalizePhrase(input.phrase) !== ACCEPT_PHRASE) {
    throw new RecruitError(`Para aceitar escreve «${ACCEPT_PHRASE}».`);
  }
  const c = await getCandidate(id);
  if (!c) throw new RecruitError("Candidato não encontrado.", 404);
  if (c.status === "aceite") throw new RecruitError("Este candidato já foi aceite.", 409);

  const username = clean(input.username, 40).toLowerCase();
  if (!USERNAME_RE.test(username)) {
    throw new RecruitError("O utilizador só pode ter letras minúsculas, números e hífens (ex.: rita-s).");
  }
  const name = clean(input.name, 60);
  if (!name) throw new RecruitError("Falta o nome com que a pessoa aparece na app.");
  const role = clean(input.role, 80) || c.role || "Consultor de SEO";
  const startDate = isoDay(input.startDate);

  await ensureHiredAccounts({ fresh: true });
  const existingRaw = await kv.hget<unknown>(HIRED_ACCOUNTS_KEY, username);
  const existing = hydrateHiredAccount(existingRaw);
  // Retoma uma aceitação que falhou a meio (mesmo candidato): não duplica.
  const resuming = Boolean(existing && existing.candidateId === c.id);
  if (!resuming && (existing || findEmployeeByUsername(username))) {
    throw new RecruitError("Esse utilizador já existe na app. Escolhe outro.", 409);
  }
  if (takenColumnNames(username).has(name)) {
    throw new RecruitError("Já há alguém no SEO DPT com esse nome. Acrescenta o apelido ou uma inicial.", 409);
  }

  const account: HiredAccount = {
    username,
    name,
    fullName: c.name,
    role,
    dept: "SEO",
    startedAt: startDate,
    candidateId: c.id,
    createdAt: existing?.createdAt ?? Date.now(),
    createdBy: existing?.createdBy ?? by,
  };
  await kv.hset(HIRED_ACCOUNTS_KEY, { [username]: account });
  rememberHiredAccount(account);

  let password: string | null = null;
  const vault = await kv.get<unknown>(accessCredKey(username));
  if (!vault) password = await createVaultPassword(username, by);

  const today = new Date().toISOString().slice(0, 10);
  await addEmployeeWithId({
    id: username,
    name: c.name,
    email: "",
    role,
    departments: ["SEO"],
    startingDate: startDate,
    status: startDate && startDate > today ? "onboarding" : "active",
    notes: `Contratado pelo Recrutamento (candidato ${c.id}).`,
  }).catch((err) => {
    // O roster é um extra: a conta e o SEO DPT já estão feitos.
    console.error("[recrutamento] roster falhou", err);
  });

  c.status = "aceite";
  c.decision = { kind: "aceite", at: Date.now(), by, note: clean(input.note, 2000), username, startDate };
  await save(c);
  return { candidate: c, account, password };
}

/** As pessoas aceites que entram no SEO DPT (para as colunas da board). */
export async function listSeoHires(): Promise<HiredAccount[]> {
  const list = await ensureHiredAccounts();
  return list.filter((a) => a.dept === "SEO").sort((a, b) => a.createdAt - b.createdAt);
}
