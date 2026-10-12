// Submissões do consultor para revisão no probation (v77.84).
//
// O consultor vai submetendo o que fez — um documento, um link, uma nota —
// sem limite, num sítio fixo da página /probation. A direção vê-as no
// check-in da semana em que caíram, antes de escolher o semáforo de cada KPI.
//
// A SEMANA NÃO SE GRAVA. Cada submissão leva só a data (Lisboa) em que
// entrou; a semana deriva das datas dos check-ins em cada leitura — se a
// direção mudar a data de uma reunião, as submissões acompanham:
//   semana 1 = até ao dia do 1.º check-in (inclusive);
//   semana N = do dia seguinte ao check-in N−1 até ao check-in N;
//   semana 4 = tudo o que vier depois do 3.º check-in.
//
// O KPI liga-se pelo NOME, tal como o consultor o vê no documento enviado:
// o consultor nunca vê o plano de trabalho (ids, KPIs a meio de escrever).
//
// Puro (sem KV): o editor, a página do consultor e o servidor usam as
// mesmas regras.

import {
  WEEKS_PER_PERIOD,
  addDaysISO,
  formatISODate,
  isISODate,
  weekDate,
  type ProbationPlan,
  type ProbationPeriod,
} from "./shared";

export type SubmissionFile = { url: string; name: string };

export type ProbationSubmission = {
  id: string;
  /** 0 = primeiro período. Posto pelo servidor (o período em curso). */
  periodIndex: number;
  /** Quando entrou (ms). Posto pelo servidor. */
  at: number;
  /** YYYY-MM-DD em Lisboa, posto pelo servidor — é por ela que cai numa
   *  semana. */
  date: string;
  /** O que é. Obrigatório. */
  text: string;
  /** Nome do KPI a que se refere; "" = geral. */
  kpi: string;
  /** URL http(s); "" = sem link. */
  link: string;
  file: SubmissionFile | null;
};

/** O que o consultor manda — tudo o resto é do servidor. */
export type SubmissionInput = Pick<ProbationSubmission, "text" | "kpi" | "link" | "file">;

export const SUBMISSION_LIM = { text: 2000, kpi: 300, link: 1000, fileName: 200 };

/** Os ficheiros sobem para o Blob da app pela rota de upload; um «ficheiro»
 *  noutro sítio qualquer é um link, não um anexo. */
const BLOB_HOST_RE = /\.public\.blob\.vercel-storage\.com$/;

function str(v: unknown, max: number): string {
  return typeof v === "string" ? v.slice(0, max) : "";
}

function httpUrl(v: unknown, max: number): string {
  const s = str(v, max).trim();
  if (!s) return "";
  try {
    const u = new URL(s);
    return u.protocol === "http:" || u.protocol === "https:" ? u.toString() : "";
  } catch {
    return "";
  }
}

function blobFile(v: unknown): SubmissionFile | null {
  if (!v || typeof v !== "object") return null;
  const r = v as Record<string, unknown>;
  const url = httpUrl(r.url, SUBMISSION_LIM.link);
  if (!url) return null;
  const u = new URL(url);
  if (u.protocol !== "https:" || !BLOB_HOST_RE.test(u.hostname)) return null;
  const name = str(r.name, SUBMISSION_LIM.fileName).trim() || decodeURIComponent(u.pathname.split("/").pop() ?? "ficheiro");
  return { url, name };
}

/** O corpo do browser → input limpo, ou a mensagem do que falta. */
export function parseSubmissionInput(raw: unknown): SubmissionInput | string {
  const b = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const text = str(b.text, SUBMISSION_LIM.text).trim();
  const rawLink = str(b.link, SUBMISSION_LIM.link).trim();
  const link = httpUrl(rawLink, SUBMISSION_LIM.link);
  if (rawLink && !link) return "O link tem de começar por https://";
  const file = blobFile(b.file);
  if (!text) return "Escreve o que estás a submeter.";
  return { text, kpi: str(b.kpi, SUBMISSION_LIM.kpi).trim(), link, file };
}

/** Uma submissão lida do KV. null quando o registo não tem a forma certa. */
export function sanitizeSubmission(raw: unknown): ProbationSubmission | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.id !== "string" || !r.id) return null;
  const at = typeof r.at === "number" && Number.isFinite(r.at) ? r.at : 0;
  const periodIndex = Number.isInteger(r.periodIndex) && (r.periodIndex as number) >= 0 ? (r.periodIndex as number) : 0;
  return {
    id: r.id,
    periodIndex,
    at,
    date: isISODate(r.date) ? r.date : "",
    text: str(r.text, SUBMISSION_LIM.text),
    kpi: str(r.kpi, SUBMISSION_LIM.kpi),
    link: httpUrl(r.link, SUBMISSION_LIM.link),
    file: blobFile(r.file),
  };
}

/* ------------------------------- semanas ------------------------------- */

/** As datas dos quatro check-ins de um período. */
function checkinDates(period: ProbationPeriod, checkinDay: string): string[] {
  return Array.from({ length: WEEKS_PER_PERIOD }, (_, i) => {
    const w = period.weeks.find((x) => x.n === i + 1);
    return w ? weekDate(w, period.startDate, checkinDay) : "";
  });
}

/** Em que semana (1–4) cai uma data. Sem datas de check-in, semana 1. */
export function weekOfDate(period: ProbationPeriod, checkinDay: string, dateISO: string): number {
  const dates = checkinDates(period, checkinDay);
  for (let i = 0; i < WEEKS_PER_PERIOD - 1; i++) {
    if (dates[i] && dateISO <= dates[i]) return i + 1;
  }
  return WEEKS_PER_PERIOD;
}

/** «até 13/10», «de 14/10 a 20/10», «desde 28/10» — o intervalo de uma
 *  semana, para quem lê. */
export function weekRangeLabel(period: ProbationPeriod, checkinDay: string, n: number): string {
  const dates = checkinDates(period, checkinDay);
  const short = (iso: string) => formatISODate(iso).slice(0, 5);
  const to = dates[n - 1];
  const prev = n > 1 ? dates[n - 2] : "";
  if (n === 1) return to ? `até ${short(to)}` : "";
  const from = prev ? addDaysISO(prev, 1) : "";
  if (n === WEEKS_PER_PERIOD) return from ? `desde ${short(from)}` : "";
  if (from && to) return `de ${short(from)} a ${short(to)}`;
  return to ? `até ${short(to)}` : "";
}

/** As submissões de uma semana do período em curso, da mais antiga para a
 *  mais recente (a ordem em que foram chegando). */
export function submissionsForWeek(
  subs: ProbationSubmission[],
  period: ProbationPeriod,
  periodIndex: number,
  checkinDay: string,
  n: number,
): ProbationSubmission[] {
  return subs
    .filter((s) => s.periodIndex === periodIndex && weekOfDate(period, checkinDay, s.date) === n)
    .sort((a, b) => a.at - b.at);
}

/** Mesmo nome de KPI, sem contar maiúsculas nem espaços a mais. */
export function sameKpi(a: string, b: string): boolean {
  const norm = (s: string) => s.trim().replace(/\s+/g, " ").toLowerCase();
  return Boolean(a.trim()) && norm(a) === norm(b);
}

/* ------------------------ a vista do consultor ------------------------ */

export type SubmissionGroup = {
  periodIndex: number;
  week: number;
  /** «Semana 2» ou «1.º período · semana 4». */
  label: string;
  /** «de 14/10 a 20/10». */
  range: string;
  /** Já houve check-in desta semana: o que lá está já foi revisto e não se
   *  apaga. */
  locked: boolean;
  /** Mais recente primeiro. */
  items: ProbationSubmission[];
};

/** As submissões do consultor arrumadas por semana, a semana mais recente
 *  primeiro. Os períodos anteriores ficam todos trancados. */
export function groupSubmissions(
  plan: Pick<ProbationPlan, "period" | "history" | "checkinDay">,
  subs: ProbationSubmission[],
): SubmissionGroup[] {
  const current = plan.history.length;
  const multi = current > 0 || subs.some((s) => s.periodIndex !== current);
  const groups = new Map<string, SubmissionGroup>();
  for (const s of subs) {
    const period = s.periodIndex === current ? plan.period : plan.history[s.periodIndex];
    if (!period) continue;
    const week = weekOfDate(period, plan.checkinDay, s.date);
    const key = `${s.periodIndex}:${week}`;
    let g = groups.get(key);
    if (!g) {
      const w = period.weeks.find((x) => x.n === week);
      g = {
        periodIndex: s.periodIndex,
        week,
        label: multi ? `${s.periodIndex + 1}.º período · semana ${week}` : `Semana ${week}`,
        range: weekRangeLabel(period, plan.checkinDay, week),
        locked: s.periodIndex !== current || Boolean(w?.done),
        items: [],
      };
      groups.set(key, g);
    }
    g.items.push(s);
  }
  const out = [...groups.values()];
  for (const g of out) g.items.sort((a, b) => b.at - a.at);
  return out.sort((a, b) => b.periodIndex - a.periodIndex || b.week - a.week);
}

/** Pode o consultor ainda apagar esta submissão? Só enquanto o check-in da
 *  semana dela não estiver feito. */
export function submissionLocked(
  plan: Pick<ProbationPlan, "period" | "history" | "checkinDay">,
  sub: ProbationSubmission,
): boolean {
  if (sub.periodIndex !== plan.history.length) return true;
  const n = weekOfDate(plan.period, plan.checkinDay, sub.date);
  return Boolean(plan.period.weeks.find((w) => w.n === n)?.done);
}

/** «13/10 · 14:32», hora de Lisboa. */
export function submissionStamp(at: number): string {
  const d = new Date(at).toLocaleString("en-GB", {
    timeZone: "Europe/Lisbon",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  return d.replace(",", " ·");
}

/** «docs.google.com» — o que se mostra de um link. */
export function linkHost(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}
