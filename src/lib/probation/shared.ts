// Plano de Probation — tipos e regras partilhadas entre o browser e o
// servidor.
//
// Vive separado de `store.ts` pela razão de sempre neste repo (ver
// absences-shared): o editor é um componente "use client" e precisa das
// datas, do estado e da sanitização para dar feedback ao vivo, mas não pode
// puxar o import do KV para o bundle. A API passa tudo o que recebe por estas
// mesmas funções, para que o que o editor mostra e o que fica gravado nunca
// divirjam.
//
// UM PLANO, VÁRIOS PERÍODOS. Um período são 30 dias com duas avaliações (aos
// 15 e aos 30). Cada avaliação acaba numa de três decisões:
//   • aos 15 dias, «extensão» quer dizer seguir para a avaliação dos 30;
//     «recuperação» ou «saída» fecham o plano ali;
//   • aos 30 dias, «extensão» abre um período novo de 30 dias (novas datas,
//     novos KPIs) e o período avaliado passa para o histórico; «recuperação»
//     ou «saída» fecham o plano.
// O estado que a lista mostra (em curso, estendido, recuperado, saída)
// DERIVA destas decisões em cada leitura; não é gravado à parte, para nunca
// poder contradizer o que está no registo.

export type KpiMet = "sim" | "parcial" | "nao";
/** O semáforo do check-in semanal — da semana toda e de cada KPI. */
export type WeekPulse = "no-caminho" | "em-risco" | "fora";
export type ProbationDecision = "extensao" | "recuperacao" | "saida";
export type ProbationStatus = "em-curso" | "estendido" | "recuperado" | "saida";

export type ProbationKpi = {
  id: string;
  kpi: string;
  /** A meta («Meta dia 15» / «Meta dia 30»). */
  target: string;
  /** «Como medimos». */
  measure: string;
  /** Preenche-se na reunião de avaliação. */
  result: string;
  met: KpiMet | null;
};

export type ProbationEvaluation = {
  wentWell: string;
  fellShort: string;
  consultantComment: string;
  decidedBy: string;
  decision: ProbationDecision | null;
  /** Quando a decisão foi registada (ms). Posto pelo servidor sempre que a
   *  decisão muda; o browser nunca o escreve. */
  decidedAt: number | null;
};

/** Ponto de situação de um KPI num check-in semanal. */
export type ProbationWeekKpi = {
  kpiId: string;
  /** Onde está o número nesta semana («6 de 10», «2 reuniões»…). */
  value: string;
  pulse: WeekPulse | null;
};

/** Próximo passo combinado no check-in; a semana seguinte confirma se foi
 *  feito. */
export type ProbationAction = {
  id: string;
  text: string;
  done: boolean;
};

/** O check-in semanal com a chefia (ou com a direção, quando ainda não há
 *  chefia intermédia). Quatro por período. */
export type ProbationWeek = {
  /** 1–4. */
  n: number;
  /** YYYY-MM-DD; "" = a data calculada a partir do dia do check-in. */
  date: string;
  /** Quem fez o check-in; "" = a chefia do plano. */
  conductedBy: string;
  done: boolean;
  /** Quando foi marcado como feito (ms). Posto pelo servidor. */
  doneAt: number | null;
  pulse: WeekPulse | null;
  kpis: ProbationWeekKpi[];
  wins: string;
  blockers: string;
  /** O apoio que a WonderAds deu nesta semana. */
  support: string;
  actions: ProbationAction[];
  consultantComment: string;
  /** NUNCA sai para o consultor — nem na pré-visualização do envio. */
  internalNote: string;
};

export type ProbationPeriod = {
  /** Dia 0, YYYY-MM-DD. */
  startDate: string;
  kpis15: ProbationKpi[];
  kpis30: ProbationKpi[];
  eval15: ProbationEvaluation;
  eval30: ProbationEvaluation;
  /** Sempre quatro (ver `WEEKS_PER_PERIOD`). */
  weeks: ProbationWeek[];
};

export type ProbationPlan = {
  id: string;
  /** Sobe a cada gravação — o editor manda a que leu e a API recusa uma
   *  gravação feita sobre uma versão que entretanto mudou noutro sítio. */
  rev: number;
  /** Username do roster quando o consultor foi escolhido da lista; null
   *  quando o nome foi escrito à mão. */
  consultantUsername: string | null;
  consultantName: string;
  roleTeam: string;
  /** false = ainda não há chefia intermédia: a direção acompanha, decide e
   *  assina sozinha (o documento deixa de pedir um «responsável direto»). */
  hasManager: boolean;
  manager: string;
  direction: string;
  /** Campos de apoio do documento (secções 05 e 06). */
  checkinDay: string;
  resources: string;
  supportPerson: string;
  trackingTool: string;
  confirmationDeadline: string;
  /** O período em curso — ou o último, se o plano já fechou. */
  period: ProbationPeriod;
  /** Períodos anteriores, do mais antigo para o mais recente. Só cresce
   *  quando uma avaliação dos 30 dias decide «extensão». */
  history: ProbationPeriod[];
  createdAt: number;
  createdBy: string;
  updatedAt: number;
  updatedBy: string;
};

/** O que o editor manda à API (criar ou gravar). Tudo o resto — id, rev,
 *  histórico, autoria, datas de decisão — é do servidor. */
export type ProbationDraft = Pick<
  ProbationPlan,
  | "consultantUsername"
  | "consultantName"
  | "roleTeam"
  | "hasManager"
  | "manager"
  | "direction"
  | "checkinDay"
  | "resources"
  | "supportPerson"
  | "trackingTool"
  | "confirmationDeadline"
  | "period"
>;

/** Resumo para a lista — o que a página da lista precisa sem o plano todo. */
export type ProbationSummary = {
  id: string;
  consultantName: string;
  roleTeam: string;
  startDate: string;
  periodNumber: number;
  status: ProbationStatus;
  next: NextEvaluation | null;
  updatedAt: number;
};

export const MAX_KPIS = 15;
export const WEEKS_PER_PERIOD = 4;
export const MAX_ACTIONS = 12;

export const PULSE_OPTIONS: { id: WeekPulse; label: string; short: string }[] = [
  { id: "no-caminho", label: "No caminho", short: "No caminho" },
  { id: "em-risco", label: "Em risco", short: "Em risco" },
  { id: "fora", label: "Fora do caminho", short: "Fora" },
];

export const PULSE_LABEL: Record<WeekPulse, string> = {
  "no-caminho": "No caminho",
  "em-risco": "Em risco",
  fora: "Fora do caminho",
};

export const KPI_MET_OPTIONS: { id: KpiMet; label: string }[] = [
  { id: "sim", label: "Sim" },
  { id: "parcial", label: "Parcial" },
  { id: "nao", label: "Não" },
];

export const DECISIONS: { id: ProbationDecision; n: number; label: string }[] = [
  { id: "extensao", n: 1, label: "Extensão do probation" },
  { id: "recuperacao", n: 2, label: "Recuperação para a equipa" },
  { id: "saida", n: 3, label: "Saída da equipa" },
];

export const STATUS_LABEL: Record<ProbationStatus, string> = {
  "em-curso": "Em curso",
  estendido: "Estendido",
  recuperado: "Recuperado",
  saida: "Saída",
};

/* ----------------------------- datas ------------------------------ */
// Tudo em UTC e em texto YYYY-MM-DD: somar dias a uma data local partia-se
// na mudança da hora (o dia 29/03 às 00:00 de Lisboa é 28/03 às 23:00 UTC e
// a conta caía um dia ao lado). O protótipo já fazia assim e o resultado tem
// de ser o mesmo.

const ISO_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isISODate(v: unknown): v is string {
  if (typeof v !== "string") return false;
  const m = ISO_RE.exec(v);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const dt = new Date(Date.UTC(y, mo - 1, d));
  return (
    dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d
  );
}

/** Dias de calendário somados a uma data YYYY-MM-DD; "" se a data não for
 *  válida. */
export function addDaysISO(iso: string, days: number): string {
  if (!isISODate(iso)) return "";
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(dt.getUTCDate()).padStart(2, "0");
  return `${dt.getUTCFullYear()}-${mm}-${dd}`;
}

/** YYYY-MM-DD → dd/mm/aaaa, sem passar por Date (logo sem fuso). */
export function formatISODate(iso: string): string {
  if (!isISODate(iso)) return "";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

export function periodDates(p: Pick<ProbationPeriod, "startDate">): {
  d0: string;
  d15: string;
  d30: string;
} {
  return {
    d0: isISODate(p.startDate) ? p.startDate : "",
    d15: addDaysISO(p.startDate, 15),
    d30: addDaysISO(p.startDate, 30),
  };
}

/* --------------------------- chefia e semanas --------------------------- */

/** Quem acompanha o plano no dia a dia: a chefia intermédia ou, quando ainda
 *  não existe, a direção. É quem faz os check-ins semanais. */
export function leadName(plan: Pick<ProbationPlan, "hasManager" | "manager" | "direction">): string {
  return (plan.hasManager ? plan.manager : plan.direction).trim();
}

/** «Ana e Rui» quando há chefia e direção distintas; senão só um nome. É a
 *  sugestão de quem decide cada avaliação. */
export function decidersName(plan: Pick<ProbationPlan, "hasManager" | "manager" | "direction">): string {
  const a = plan.hasManager ? plan.manager.trim() : "";
  const b = plan.direction.trim();
  if (a && b && a !== b) return `${a} e ${b}`;
  return a || b;
}

const WEEKDAY_PREFIX: [RegExp, number][] = [
  [/^dom/, 0],
  [/^seg/, 1],
  [/^ter/, 2],
  [/^qua/, 3],
  [/^qui/, 4],
  [/^sex/, 5],
  [/^s[áa]b/, 6],
];

/** «sextas-feiras» → 5. null quando o texto não é um dia da semana. */
export function checkinWeekday(day: string): number | null {
  const t = day.trim().toLowerCase();
  for (const [re, n] of WEEKDAY_PREFIX) if (re.test(t)) return n;
  return null;
}

function weekdayOfISO(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/** As datas calculadas dos quatro check-ins: o dia da semana combinado (a
 *  primeira ocorrência depois do dia 0) e daí de 7 em 7; sem dia combinado,
 *  os dias 7, 14, 21 e 28. Ficam sempre dentro dos 30 dias. */
export function defaultWeekDates(startDate: string, checkinDay: string): string[] {
  if (!isISODate(startDate)) return Array.from({ length: WEEKS_PER_PERIOD }, () => "");
  const wd = checkinWeekday(checkinDay);
  let first = 7;
  if (wd !== null) {
    const diff = (wd - weekdayOfISO(startDate) + 7) % 7;
    first = diff === 0 ? 7 : diff;
  }
  return Array.from({ length: WEEKS_PER_PERIOD }, (_, i) => addDaysISO(startDate, first + 7 * i));
}

/** A data de um check-in: a escrita à mão, ou a calculada. */
export function weekDate(week: ProbationWeek, startDate: string, checkinDay: string): string {
  if (isISODate(week.date)) return week.date;
  return defaultWeekDates(startDate, checkinDay)[week.n - 1] ?? "";
}

/** Que KPIs um check-in acompanha: os dos 15 dias até à 1.ª avaliação
 *  (inclusive), os dos 30 depois dela. */
export function weekTrack(period: ProbationPeriod, week: ProbationWeek, checkinDay: string): 15 | 30 {
  const date = weekDate(week, period.startDate, checkinDay);
  const { d15 } = periodDates(period);
  return date && d15 && date > d15 ? 30 : 15;
}

export function weekKpiSet(period: ProbationPeriod, week: ProbationWeek, checkinDay: string): ProbationKpi[] {
  return (weekTrack(period, week, checkinDay) === 15 ? period.kpis15 : period.kpis30).filter(kpiFilled);
}

/** As ações combinadas na semana anterior — a semana N confirma-as. */
export function previousActions(period: ProbationPeriod, n: number): ProbationAction[] {
  if (n <= 1) return [];
  return (period.weeks.find((w) => w.n === n - 1)?.actions ?? []).filter((a) => a.text.trim());
}

/** Dia do período (0 = início, 30 = avaliação final), contado até `todayISO`.
 *  null sem data de início; pode passar de 30 ou ficar negativo. */
export function periodDay(period: Pick<ProbationPeriod, "startDate">, todayISO: string): number | null {
  if (!isISODate(period.startDate) || !isISODate(todayISO)) return null;
  const [a, b] = [period.startDate, todayISO].map((iso) => {
    const [y, m, d] = iso.split("-").map(Number);
    return Date.UTC(y, m - 1, d);
  });
  return Math.round((b - a) / 86_400_000);
}

/** O próximo check-in por fazer (data e número), ou null. */
export function nextCheckin(
  period: ProbationPeriod,
  checkinDay: string,
): { n: number; date: string } | null {
  for (const w of period.weeks) {
    if (w.done) continue;
    return { n: w.n, date: weekDate(w, period.startDate, checkinDay) };
  }
  return null;
}

/* ------------------------- estado e prazos ------------------------ */

/** A decisão que fecha o período: a dos 15 dias quando não foi extensão, a
 *  dos 30 quando a dos 15 mandou seguir. null = ainda em aberto. */
export function finalDecision(p: ProbationPeriod): ProbationDecision | null {
  const d15 = p.eval15.decision;
  if (!d15) return null;
  if (d15 !== "extensao") return d15;
  return p.eval30.decision;
}

/** A avaliação dos 30 só existe depois de os 15 dias decidirem seguir. */
export function eval30Open(p: ProbationPeriod): boolean {
  return p.eval15.decision === "extensao";
}

/** Os 30 dias decidiram extensão mas o período novo ainda não foi aberto. */
export function awaitingNewPeriod(p: ProbationPeriod): boolean {
  return finalDecision(p) === "extensao";
}

export function planStatus(plan: Pick<ProbationPlan, "period" | "history">): ProbationStatus {
  const final = finalDecision(plan.period);
  if (final === "recuperacao") return "recuperado";
  if (final === "saida") return "saida";
  const extended =
    plan.history.length > 0 ||
    plan.period.eval15.decision === "extensao" ||
    final === "extensao";
  return extended ? "estendido" : "em-curso";
}

export type NextEvaluation = {
  /** YYYY-MM-DD */
  date: string;
  label: string;
};

/** A próxima avaliação, ou null quando o plano já fechou. */
export function nextEvaluation(p: ProbationPeriod): NextEvaluation | null {
  const { d15, d30 } = periodDates(p);
  if (!p.eval15.decision) return { date: d15, label: "Avaliação dos 15 dias" };
  if (p.eval15.decision !== "extensao") return null;
  if (!p.eval30.decision) return { date: d30, label: "Avaliação dos 30 dias" };
  if (p.eval30.decision !== "extensao") return null;
  return {
    date: addDaysISO(d30, 15),
    label: "15 dias do novo período",
  };
}

/** «Se extensão: nova data de avaliação» de cada avaliação — aos 15 dias é a
 *  dos 30; aos 30 é a dos 15 dias do período que se abre a seguir. */
export function extensionDate(p: ProbationPeriod, which: 15 | 30): string {
  const { d30 } = periodDates(p);
  return which === 15 ? d30 : addDaysISO(d30, 15);
}

/** O período seguinte a uma extensão aos 30 dias: começa no dia da
 *  avaliação, com os KPIs anteriores copiados como rascunho (resultados em
 *  branco) e as avaliações por fazer. */
export function nextPeriodFrom(p: ProbationPeriod, newId: () => string): ProbationPeriod {
  const fresh = (k: ProbationKpi): ProbationKpi => ({
    ...k,
    id: newId(),
    result: "",
    met: null,
  });
  return {
    startDate: addDaysISO(p.startDate, 30),
    kpis15: p.kpis15.map(fresh),
    kpis30: p.kpis30.map(fresh),
    eval15: emptyEvaluation(),
    eval30: emptyEvaluation(),
    weeks: emptyWeeks(),
  };
}

/** Um KPI conta quando tem alguma coisa escrita — uma linha acabada de
 *  acrescentar e ainda vazia não entra nas contas nem no documento. */
export function kpiFilled(k: ProbationKpi): boolean {
  return Boolean(k.kpi.trim() || k.target.trim() || k.measure.trim());
}

export function metCount(kpis: ProbationKpi[]): { met: number; total: number; recorded: boolean } {
  const filled = kpis.filter(kpiFilled);
  return {
    met: filled.filter((k) => k.met === "sim").length,
    total: filled.length,
    recorded: filled.some((k) => k.met !== null),
  };
}

/* --------------------------- construtores ------------------------- */

export function emptyEvaluation(): ProbationEvaluation {
  return {
    wentWell: "",
    fellShort: "",
    consultantComment: "",
    decidedBy: "",
    decision: null,
    decidedAt: null,
  };
}

export function emptyKpi(id: string): ProbationKpi {
  return { id, kpi: "", target: "", measure: "", result: "", met: null };
}

export function emptyWeek(n: number): ProbationWeek {
  return {
    n,
    date: "",
    conductedBy: "",
    done: false,
    doneAt: null,
    pulse: null,
    kpis: [],
    wins: "",
    blockers: "",
    support: "",
    actions: [],
    consultantComment: "",
    internalNote: "",
  };
}

export function emptyWeeks(): ProbationWeek[] {
  return Array.from({ length: WEEKS_PER_PERIOD }, (_, i) => emptyWeek(i + 1));
}

export function emptyPeriod(startDate = ""): ProbationPeriod {
  return {
    startDate,
    kpis15: [],
    kpis30: [],
    eval15: emptyEvaluation(),
    eval30: emptyEvaluation(),
    weeks: emptyWeeks(),
  };
}

/** «Consultora de SEO · Equipa SEO» a partir do roster. Editável depois. */
export function roleTeamFor(role: string, dept: string): string {
  const team: Record<string, string> = {
    SEO: "Equipa SEO",
    ADS: "Equipa ADS",
    Web: "Equipa Web",
    Commercial: "Equipa Comercial",
  };
  const t = team[dept];
  return t ? `${role} · ${t}` : role;
}

/** O primeiro nome — o documento trata o consultor por tu. */
export function firstName(full: string): string {
  return full.trim().split(/\s+/)[0] ?? "";
}

/* --------------------------- sanitização -------------------------- */
// O KV devolve objetos crus e o browser manda o que quiser: tudo passa por
// aqui, com defaults e limites, antes de ser lido ou gravado (a lição dos
// WebTickets — um campo novo não pode rebentar planos antigos).

const LIM = { name: 120, line: 200, kpi: 300, text: 3000, id: 64 };

function str(v: unknown, max: number): string {
  return typeof v === "string" ? v.slice(0, max) : "";
}

function oneOf<T extends string>(v: unknown, allowed: readonly T[]): T | null {
  return allowed.includes(v as T) ? (v as T) : null;
}

const MET_IDS = KPI_MET_OPTIONS.map((o) => o.id);
const DECISION_IDS = DECISIONS.map((d) => d.id);
const PULSE_IDS = PULSE_OPTIONS.map((o) => o.id);

function msOrNull(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function sanitizeActions(raw: unknown, newId: () => string): ProbationAction[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: ProbationAction[] = [];
  for (const row of raw.slice(0, MAX_ACTIONS)) {
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    let id = str(r.id, LIM.id);
    if (!id || seen.has(id)) id = newId();
    seen.add(id);
    out.push({ id, text: str(r.text, LIM.kpi), done: r.done === true });
  }
  return out;
}

function sanitizeWeekKpis(raw: unknown): ProbationWeekKpi[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: ProbationWeekKpi[] = [];
  for (const row of raw.slice(0, MAX_KPIS * 2)) {
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    const kpiId = str(r.kpiId, LIM.id);
    if (!kpiId || seen.has(kpiId)) continue;
    seen.add(kpiId);
    out.push({ kpiId, value: str(r.value, LIM.line), pulse: oneOf(r.pulse, PULSE_IDS) });
  }
  return out;
}

function sanitizeWeek(r: Record<string, unknown>, n: number, newId: () => string): ProbationWeek {
  return {
    n,
    date: isISODate(r.date) ? r.date : "",
    conductedBy: str(r.conductedBy, LIM.name),
    done: r.done === true,
    doneAt: msOrNull(r.doneAt),
    pulse: oneOf(r.pulse, PULSE_IDS),
    kpis: sanitizeWeekKpis(r.kpis),
    wins: str(r.wins, LIM.text),
    blockers: str(r.blockers, LIM.text),
    support: str(r.support, LIM.text),
    actions: sanitizeActions(r.actions, newId),
    consultantComment: str(r.consultantComment, LIM.text),
    internalNote: str(r.internalNote, LIM.text),
  };
}

/** Sempre quatro semanas, pela ordem — planos gravados antes dos check-ins
 *  (v77.73) ganham-nas vazias na primeira leitura. */
function sanitizeWeeks(raw: unknown, newId: () => string): ProbationWeek[] {
  const byN = new Map<number, Record<string, unknown>>();
  for (const row of Array.isArray(raw) ? raw : []) {
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    const n = Number(r.n);
    if (Number.isInteger(n) && n >= 1 && n <= WEEKS_PER_PERIOD && !byN.has(n)) byN.set(n, r);
  }
  return Array.from({ length: WEEKS_PER_PERIOD }, (_, i) => {
    const r = byN.get(i + 1);
    return r ? sanitizeWeek(r, i + 1, newId) : emptyWeek(i + 1);
  });
}

function sanitizeKpis(raw: unknown, newId: () => string): ProbationKpi[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: ProbationKpi[] = [];
  for (const row of raw.slice(0, MAX_KPIS)) {
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    let id = str(r.id, LIM.id);
    if (!id || seen.has(id)) id = newId();
    seen.add(id);
    out.push({
      id,
      kpi: str(r.kpi, LIM.kpi),
      target: str(r.target, LIM.line),
      measure: str(r.measure, LIM.line),
      result: str(r.result, LIM.line),
      met: oneOf(r.met, MET_IDS),
    });
  }
  return out;
}

function sanitizeEvaluation(raw: unknown): ProbationEvaluation {
  const e = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  return {
    wentWell: str(e.wentWell, LIM.text),
    fellShort: str(e.fellShort, LIM.text),
    consultantComment: str(e.consultantComment, LIM.text),
    decidedBy: str(e.decidedBy, LIM.name),
    decision: oneOf(e.decision, DECISION_IDS),
    decidedAt:
      typeof e.decidedAt === "number" && Number.isFinite(e.decidedAt) ? e.decidedAt : null,
  };
}

export function sanitizePeriod(raw: unknown, newId: () => string): ProbationPeriod {
  const p = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  return {
    startDate: isISODate(p.startDate) ? p.startDate : "",
    kpis15: sanitizeKpis(p.kpis15, newId),
    kpis30: sanitizeKpis(p.kpis30, newId),
    eval15: sanitizeEvaluation(p.eval15),
    eval30: sanitizeEvaluation(p.eval30),
    weeks: sanitizeWeeks(p.weeks, newId),
  };
}

/** O corpo que o editor manda. O `decidedAt` que vier do browser é
 *  ignorado — quem o escreve é a API (ver `stampDecisions`). */
export function sanitizeDraft(raw: unknown, newId: () => string): ProbationDraft {
  const b = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const period = sanitizePeriod(b.period, newId);
  period.eval15.decidedAt = null;
  period.eval30.decidedAt = null;
  for (const w of period.weeks) w.doneAt = null;
  const username = str(b.consultantUsername, LIM.id).trim().toLowerCase();
  return {
    consultantUsername: username || null,
    consultantName: str(b.consultantName, LIM.name),
    roleTeam: str(b.roleTeam, LIM.line),
    // Planos anteriores ao interruptor (v77.73) tinham sempre chefia.
    hasManager: b.hasManager !== false,
    manager: str(b.manager, LIM.name),
    direction: str(b.direction, LIM.name),
    checkinDay: str(b.checkinDay, LIM.line),
    resources: str(b.resources, LIM.kpi),
    supportPerson: str(b.supportPerson, LIM.name),
    trackingTool: str(b.trackingTool, LIM.line),
    confirmationDeadline: str(b.confirmationDeadline, LIM.line),
    period,
  };
}

/** O que impede gravar um plano, em português para o editor; null = ok. */
export function validateDraft(d: ProbationDraft): string | null {
  if (!d.consultantName.trim()) return "Falta o nome do consultor.";
  if (!isISODate(d.period.startDate)) return "Falta a data de início.";
  return null;
}

/** Lê um plano do KV. null quando o registo não é um plano. */
export function sanitizePlan(raw: unknown, newId: () => string): ProbationPlan | null {
  if (!raw || typeof raw !== "object") return null;
  const p = raw as Record<string, unknown>;
  if (typeof p.id !== "string" || !p.id) return null;
  const draft = sanitizeDraft(p, newId);
  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);
  return {
    ...draft,
    // sanitizeDraft limpa as datas de decisão (vêm do browser); aqui vêm do
    // KV e são verdadeiras.
    period: sanitizePeriod(p.period, newId),
    id: p.id,
    rev: num(p.rev),
    history: Array.isArray(p.history) ? p.history.map((h) => sanitizePeriod(h, newId)) : [],
    createdAt: num(p.createdAt),
    createdBy: str(p.createdBy, LIM.name),
    updatedAt: num(p.updatedAt),
    updatedBy: str(p.updatedBy, LIM.name),
  };
}

/** Põe a hora da decisão onde ela mudou face ao que estava gravado. */
export function stampDecisions(
  next: ProbationPeriod,
  prev: ProbationPeriod | null,
  now: number,
): ProbationPeriod {
  const stamp = (e: ProbationEvaluation, old: ProbationEvaluation | null): ProbationEvaluation => {
    if (!e.decision) return { ...e, decidedAt: null };
    if (old && old.decision === e.decision) return { ...e, decidedAt: old.decidedAt ?? now };
    return { ...e, decidedAt: now };
  };
  return {
    ...next,
    eval15: stamp(next.eval15, prev?.eval15 ?? null),
    eval30: stamp(next.eval30, prev?.eval30 ?? null),
    weeks: next.weeks.map((w) => {
      if (!w.done) return { ...w, doneAt: null };
      const old = prev?.weeks.find((x) => x.n === w.n);
      return { ...w, doneAt: old?.done ? (old.doneAt ?? now) : now };
    }),
  };
}

export function summarize(plan: ProbationPlan): ProbationSummary {
  return {
    id: plan.id,
    consultantName: plan.consultantName,
    roleTeam: plan.roleTeam,
    startDate: plan.period.startDate,
    periodNumber: plan.history.length + 1,
    status: planStatus(plan),
    next: nextEvaluation(plan.period),
    updatedAt: plan.updatedAt,
  };
}
