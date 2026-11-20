// Recrutamento (v80.13) — tipos e leitura defensiva dos registos (KV devolve
// objetos crus; campos novos chegam undefined em registos antigos).

import { emptyAnswer, emptyClosing, type Answer, type Closing } from "./scoring";
import { DEFAULT_TEMPLATE_ID } from "./templates";
import { hydratePractical, type Practical } from "./practical";

export type CandidateStatus = "pipeline" | "aceite" | "recusado";

export type Interview = {
  id: string;
  templateId: string;
  templateVersion: number;
  /** Dia marcado (ISO yyyy-mm-dd) — informativo. */
  date: string | null;
  interviewer: string | null;
  startedAt: number | null;
  finishedAt: number | null;
  /** O ecrã onde ficou (0 = abertura; depois uma pergunta por ecrã; o fecho). */
  step: number;
  answers: Record<string, Answer>;
  closing: Closing;
  createdAt: number;
};

export type CandidateDecision = {
  kind: "aceite" | "recusado";
  at: number;
  by: string;
  note: string;
  /** Aceite: a conta criada na app. */
  username?: string;
  startDate?: string | null;
};

export type Candidate = {
  id: string;
  name: string;
  email: string;
  phone: string;
  linkedin: string;
  /** Onde veio (LinkedIn, Indeed, indicação, …). */
  source: string;
  /** A vaga. */
  role: string;
  /** Anotações livres do entrevistador. */
  notes: string;
  /** Zona onde vive (cidade, bairro). */
  location: string;
  /** Focos e gostos pessoais. */
  interests: string;
  /** Formações — uma por linha. */
  education: string;
  /** Experiências passadas — uma por linha. */
  experience: string;
  /** Valor mensal pretendido, em euros (null = não disse). */
  salaryMonthly: number | null;
  /** Como disse o valor (bruto/líquido, negociável, intervalo…). */
  salaryNote: string;
  status: CandidateStatus;
  decision: CandidateDecision | null;
  interviews: Interview[];
  /** Fase 2 · Parte 2 (v80.16): as provas práticas, cada uma com o seu link
   *  para o candidato. As respostas vivem à parte (hr:practical-sub:<id>). */
  practicals: Practical[];
  createdAt: number;
  createdBy: string;
  updatedAt: number;
};

export const CANDIDATE_KEY = (id: string) => `hr:candidate:${id}`;
/** Link público da prática → { candidateId, practicalId }. */
export const PRACTICAL_TOKEN_KEY = (token: string) => `hr:practical-token:${token}`;
/** O que o candidato escreve na prática (separado da ficha: o candidato grava
 *  ao mesmo tempo que o André avalia, e um nunca pisa o outro). */
export const PRACTICAL_SUB_KEY = (practicalId: string) => `hr:practical-sub:${practicalId}`;
export const CANDIDATES_INDEX_KEY = "hr:candidates";

const str = (v: unknown, max = 4000) => (typeof v === "string" ? v.slice(0, max) : "");
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);

function parse(raw: unknown): Record<string, unknown> | null {
  let v: unknown = raw;
  if (typeof v === "string") {
    try {
      v = JSON.parse(v);
    } catch {
      return null;
    }
  }
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

export function hydrateAnswer(raw: unknown): Answer {
  const o = parse(raw);
  if (!o) return emptyAnswer();
  const ids = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string").slice(0, 40) : []);
  const ov = num(o.override);
  return {
    checked: ids(o.checked),
    flags: ids(o.flags),
    notes: str(o.notes, 8000),
    override: ov === null ? null : Math.min(10, Math.max(0, ov)),
    timeMs: num(o.timeMs) ?? 0,
  };
}

export function hydrateClosing(raw: unknown): Closing {
  const o = parse(raw);
  const base = emptyClosing();
  if (!o) return base;
  const four = (v: unknown) => {
    const list = Array.isArray(v) ? v.map((x) => str(x, 400)) : [];
    while (list.length < 4) list.push("");
    return list.slice(0, 8);
  };
  const mine = (v: unknown) => {
    const n = num(v);
    return n === null ? null : Math.min(10, Math.max(0, Math.round(n)));
  };
  return {
    strengths: four(o.strengths),
    weaknesses: four(o.weaknesses),
    remember: str(o.remember, 2000),
    quote: str(o.quote, 1000),
    doubts: str(o.doubts, 2000),
    fitMine: mine(o.fitMine),
    techMine: mine(o.techMine),
    nextStep: str(o.nextStep, 1000),
  };
}

export function hydrateInterview(raw: unknown): Interview | null {
  const o = parse(raw);
  if (!o || typeof o.id !== "string") return null;
  const answersRaw = parse(o.answers) ?? {};
  const answers: Record<string, Answer> = {};
  for (const [k, v] of Object.entries(answersRaw)) answers[k] = hydrateAnswer(v);
  return {
    id: o.id,
    templateId: str(o.templateId, 100) || DEFAULT_TEMPLATE_ID,
    templateVersion: num(o.templateVersion) ?? 1,
    date: str(o.date, 10) || null,
    interviewer: str(o.interviewer, 100) || null,
    startedAt: num(o.startedAt),
    finishedAt: num(o.finishedAt),
    step: Math.max(0, Math.floor(num(o.step) ?? 0)),
    answers,
    closing: hydrateClosing(o.closing),
    createdAt: num(o.createdAt) ?? 0,
  };
}

export function hydrateCandidate(raw: unknown): Candidate | null {
  const o = parse(raw);
  if (!o || typeof o.id !== "string" || typeof o.name !== "string") return null;
  const status: CandidateStatus = o.status === "aceite" || o.status === "recusado" ? o.status : "pipeline";
  const d = parse(o.decision);
  const decision: CandidateDecision | null =
    d && (d.kind === "aceite" || d.kind === "recusado")
      ? {
          kind: d.kind,
          at: num(d.at) ?? 0,
          by: str(d.by, 100),
          note: str(d.note, 2000),
          username: str(d.username, 60) || undefined,
          startDate: str(d.startDate, 10) || null,
        }
      : null;
  return {
    id: o.id,
    name: str(o.name, 120),
    email: str(o.email, 200),
    phone: str(o.phone, 60),
    linkedin: str(o.linkedin, 400),
    source: str(o.source, 120),
    role: str(o.role, 120) || "Consultor de SEO",
    notes: str(o.notes, 8000),
    location: str(o.location, 200),
    interests: str(o.interests, 4000),
    education: str(o.education, 6000),
    experience: str(o.experience, 8000),
    salaryMonthly: (() => {
      const n = num(o.salaryMonthly);
      return n === null || n < 0 ? null : Math.round(n);
    })(),
    salaryNote: str(o.salaryNote, 200),
    status,
    decision,
    interviews: (Array.isArray(o.interviews) ? o.interviews : [])
      .map(hydrateInterview)
      .filter((i): i is Interview => Boolean(i)),
    practicals: (Array.isArray(o.practicals) ? o.practicals : [])
      .map(hydratePractical)
      .filter((p): p is Practical => Boolean(p)),
    createdAt: num(o.createdAt) ?? 0,
    createdBy: str(o.createdBy, 100),
    updatedAt: num(o.updatedAt) ?? 0,
  };
}

/** O estado que se mostra: o guardado, ou derivado das entrevistas. */
export type CandidateStage = "por-entrevistar" | "em-entrevista" | "entrevistado" | "aceite" | "recusado";

export function stageOf(c: Candidate): CandidateStage {
  if (c.status === "aceite") return "aceite";
  if (c.status === "recusado") return "recusado";
  if (c.interviews.some((i) => i.startedAt && !i.finishedAt)) return "em-entrevista";
  if (c.interviews.some((i) => i.finishedAt)) return "entrevistado";
  return "por-entrevistar";
}

export const STAGE_LABEL: Record<CandidateStage, string> = {
  "por-entrevistar": "Por entrevistar",
  "em-entrevista": "Em entrevista",
  entrevistado: "Entrevistado",
  aceite: "Aceite",
  recusado: "Recusado",
};

/** A entrevista que dá a cara da ficha: a última terminada, senão a última. */
export function headlineInterview(c: Candidate): Interview | null {
  const done = c.interviews.filter((i) => i.finishedAt).sort((a, b) => (b.finishedAt ?? 0) - (a.finishedAt ?? 0));
  if (done[0]) return done[0];
  return [...c.interviews].sort((a, b) => b.createdAt - a.createdAt)[0] ?? null;
}

/** A frase de confirmação que o André escreve para aceitar. */
export const ACCEPT_PHRASE = "confirmar e aceitar";

export function normalizePhrase(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** Username a partir do nome: «Rita Santos» → «rita-s» (o padrão da casa). */
export function suggestUsername(name: string): string {
  const parts = name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z\s-]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
  if (!parts.length) return "";
  const first = parts[0];
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return last ? `${first}-${last}` : first;
}

/** Nome curto para a app («Rita Maria Santos» → «Rita Santos»). */
export function shortName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 2) return parts.join(" ");
  return `${parts[0]} ${parts[parts.length - 1]}`;
}

export const USERNAME_RE = /^[a-z][a-z0-9-]{1,30}$/;

/** Os campos do perfil que se editam (criar e «profile»). */
export const PROFILE_FIELDS = [
  "name",
  "email",
  "phone",
  "linkedin",
  "source",
  "role",
  "notes",
  "location",
  "interests",
  "education",
  "experience",
  "salaryNote",
] as const;
export type ProfileField = (typeof PROFILE_FIELDS)[number];

export const PROFILE_MAX: Record<ProfileField, number> = {
  name: 120,
  email: 200,
  phone: 60,
  linkedin: 400,
  source: 120,
  role: 120,
  notes: 8000,
  location: 200,
  interests: 4000,
  education: 6000,
  experience: 8000,
  salaryNote: 200,
};

/** «1.300 €» — o valor mensal pretendido. */
export function fmtEuros(n: number | null): string {
  if (n === null) return "—";
  return `${String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ".")} €`;
}

/** Lê um valor escrito à mão («1.300», «1300€», «1 300,50») → 1300. */
export function parseEuros(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) && v >= 0 ? Math.round(v) : null;
  if (typeof v !== "string") return null;
  const t = v.replace(/[^0-9,.\s]/g, "").trim();
  if (!t) return null;
  // Separador decimal = vírgula no fim com 1–2 casas; o resto são milhares.
  const m = t.match(/^(.*?)[,.](\d{1,2})$/);
  const int = (m ? m[1] : t).replace(/[.\s]/g, "");
  const n = Number(int);
  return Number.isFinite(n) && n >= 0 ? Math.round(n) : null;
}
