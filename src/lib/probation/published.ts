// O que o CONSULTOR vê do seu plano de probation — e só isso.
//
// O plano (`probation:<id>`) é o rascunho de trabalho da direção: muda a cada
// tecla, tem notas internas, KPIs a meio de escrever. Nada disso chega ao
// consultor. O que lhe chega são FOTOGRAFIAS, tiradas no «Enviar» depois de a
// direção ver a pré-visualização: o documento do plano, cada check-in semanal
// e cada avaliação. Ficam em `probation:pub:<id>` e a página /probation lê só
// dali.
//
// Cada fotografia leva uma assinatura (`sig`, um hash do que foi enviado):
// o editor volta a calcular a do rascunho e, se não bater, mostra «alterado
// desde o envio» — sabe-se sempre se o consultor está a ver a versão atual.
//
// Puro (sem KV): o editor usa estas mesmas funções para a pré-visualização,
// e o servidor para gravar — o que se pré-visualiza é o que se envia.

import {
  DECISIONS,
  KPI_MET_OPTIONS,
  PULSE_OPTIONS,
  extensionDate,
  isISODate,
  leadName,
  metCount,
  kpiFilled,
  periodDates,
  previousActions,
  weekDate,
  weekKpiSet,
  weekTrack,
  type KpiMet,
  type ProbationDecision,
  type ProbationDraft,
  type ProbationPeriod,
  type WeekPulse,
} from "./shared";
import { S05, buildDocModel, type DocModel } from "./document";

/* -------------------------------- tipos -------------------------------- */

export type SendItem = "plan" | "eval:15" | "eval:30" | `week:${number}`;

export type WeekView = {
  n: number;
  date: string;
  /** Que KPIs este check-in acompanha. */
  track: 15 | 30;
  conductedBy: string;
  pulse: WeekPulse | null;
  kpis: { name: string; target: string; value: string; pulse: WeekPulse | null }[];
  /** As ações combinadas na semana anterior e se ficaram feitas. */
  prevActions: { text: string; done: boolean }[];
  wins: string;
  blockers: string;
  support: string;
  /** Próximos passos combinados nesta semana. */
  actions: string[];
  consultantComment: string;
};

export type EvalView = {
  which: 15 | 30;
  date: string;
  kpis: { name: string; target: string; result: string; met: KpiMet | null }[];
  metN: number;
  metTotal: number;
  wentWell: string;
  fellShort: string;
  consultantComment: string;
  decision: ProbationDecision;
  decisionLabel: string;
  /** «O que acontece» da secção 05, para a decisão tomada. */
  outcome: string;
  /** Extensão: a data da avaliação seguinte (YYYY-MM-DD). */
  nextDate: string;
  decidedBy: string;
};

export type PubAck = { at: number; comment: string };

type PubBase = {
  sentAt: number;
  sentBy: string;
  sig: string;
  /** null até o consultor confirmar que leu. Um reenvio volta a pô-la a null. */
  ack: PubAck | null;
};

export type PubDoc = PubBase & { model: DocModel };
export type PubWeek = PubBase & { view: WeekView };
export type PubEval = PubBase & { view: EvalView };

export type PubPeriod = {
  /** 0 = primeiro período. */
  index: number;
  startDate: string;
  doc: PubDoc | null;
  weeks: PubWeek[];
  evals: PubEval[];
};

export type PublishedPlan = {
  id: string;
  consultantUsername: string;
  consultantName: string;
  roleTeam: string;
  /** Quem faz os check-ins (chefia, ou direção sem chefia intermédia). */
  lead: string;
  checkinDay: string;
  periods: PubPeriod[];
  updatedAt: number;
};

/* ---------------------------- fotografias ---------------------------- */

type PlanLike = Pick<
  ProbationDraft,
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
>;

export function weekView(plan: PlanLike, period: ProbationPeriod, n: number): WeekView | null {
  const week = period.weeks.find((w) => w.n === n);
  if (!week) return null;
  const kpis = weekKpiSet(period, week, plan.checkinDay).map((k) => {
    const row = week.kpis.find((x) => x.kpiId === k.id);
    return {
      name: k.kpi.trim(),
      target: k.target.trim(),
      value: row?.value.trim() ?? "",
      pulse: row?.pulse ?? null,
    };
  });
  return {
    n,
    date: weekDate(week, period.startDate, plan.checkinDay),
    track: weekTrack(period, week, plan.checkinDay),
    conductedBy: week.conductedBy.trim() || leadName(plan),
    pulse: week.pulse,
    kpis,
    prevActions: previousActions(period, n).map((a) => ({ text: a.text.trim(), done: a.done })),
    wins: week.wins.trim(),
    blockers: week.blockers.trim(),
    support: week.support.trim(),
    actions: week.actions.map((a) => a.text.trim()).filter(Boolean),
    consultantComment: week.consultantComment.trim(),
  };
}

export function evalView(plan: PlanLike, period: ProbationPeriod, which: 15 | 30): EvalView | null {
  const ev = which === 15 ? period.eval15 : period.eval30;
  if (!ev.decision) return null;
  const kpis = (which === 15 ? period.kpis15 : period.kpis30).filter(kpiFilled);
  const count = metCount(kpis);
  const { d15, d30 } = periodDates(period);
  const decision = ev.decision;
  return {
    which,
    date: which === 15 ? d15 : d30,
    kpis: kpis.map((k) => ({
      name: k.kpi.trim(),
      target: k.target.trim(),
      result: k.result.trim(),
      met: k.met,
    })),
    metN: count.met,
    metTotal: count.total,
    wentWell: ev.wentWell.trim(),
    fellShort: ev.fellShort.trim(),
    consultantComment: ev.consultantComment.trim(),
    decision,
    decisionLabel: DECISIONS.find((d) => d.id === decision)?.label ?? "",
    outcome: S05.outcomes.find((o) => o.id === decision)?.what ?? "",
    nextDate: decision === "extensao" ? extensionDate(period, which) : "",
    decidedBy: ev.decidedBy.trim(),
  };
}

export type Snapshot =
  | { kind: "plan"; model: DocModel; sig: string }
  | { kind: "week"; n: number; view: WeekView; sig: string }
  | { kind: "eval"; which: 15 | 30; view: EvalView; sig: string };

/** A fotografia de um item — null quando ainda não há nada para enviar
 *  (avaliação sem decisão, semana inexistente). */
export function snapshotFor(
  plan: PlanLike,
  period: ProbationPeriod,
  periodIndex: number,
  item: SendItem,
): Snapshot | null {
  if (item === "plan") {
    const model = buildDocModel(plan, period, periodIndex);
    return { kind: "plan", model, sig: hashOf(model) };
  }
  if (item === "eval:15" || item === "eval:30") {
    const which = item === "eval:15" ? 15 : 30;
    const view = evalView(plan, period, which);
    return view ? { kind: "eval", which, view, sig: hashOf(view) } : null;
  }
  const n = Number(item.slice(5));
  const view = weekView(plan, period, n);
  return view ? { kind: "week", n, view, sig: hashOf(view) } : null;
}

export function parseSendItem(v: unknown): SendItem | null {
  if (v === "plan" || v === "eval:15" || v === "eval:30") return v;
  if (typeof v === "string" && /^week:[1-4]$/.test(v)) return v as SendItem;
  return null;
}

export function sendItemLabel(item: SendItem): string {
  if (item === "plan") return "Plano de probation";
  if (item === "eval:15") return "Avaliação dos 15 dias";
  if (item === "eval:30") return "Avaliação dos 30 dias";
  return `Check-in semanal · semana ${item.slice(5)}`;
}

/** FNV-1a de 32 bits sobre o JSON — curto, igual no browser e no servidor. */
export function hashOf(v: unknown): string {
  const s = JSON.stringify(v);
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

/* ------------------------- leitura do publicado ------------------------- */

export function pubPeriod(pub: PublishedPlan | null, index: number): PubPeriod | null {
  return pub?.periods.find((p) => p.index === index) ?? null;
}

export function pubEntry(
  pub: PublishedPlan | null,
  index: number,
  item: SendItem,
): PubDoc | PubWeek | PubEval | null {
  const p = pubPeriod(pub, index);
  if (!p) return null;
  if (item === "plan") return p.doc;
  if (item === "eval:15" || item === "eval:30") {
    const which = item === "eval:15" ? 15 : 30;
    return p.evals.find((e) => e.view.which === which) ?? null;
  }
  const n = Number(item.slice(5));
  return p.weeks.find((w) => w.view.n === n) ?? null;
}

export type SendState =
  | { kind: "never" }
  | { kind: "sent"; at: number; ack: PubAck | null }
  | { kind: "changed"; at: number; ack: PubAck | null };

/** O estado de envio de um item, comparando o enviado com o rascunho. */
export function sendState(entry: PubBase | null, currentSig: string | null): SendState {
  if (!entry) return { kind: "never" };
  if (currentSig && currentSig !== entry.sig) return { kind: "changed", at: entry.sentAt, ack: entry.ack };
  return { kind: "sent", at: entry.sentAt, ack: entry.ack };
}

/** Tudo o que o consultor recebeu e ainda não confirmou, do mais antigo
 *  para o mais recente. */
export function pendingAcks(
  pub: PublishedPlan,
): { periodIndex: number; item: SendItem; label: string; sentAt: number }[] {
  const out: { periodIndex: number; item: SendItem; label: string; sentAt: number }[] = [];
  for (const p of pub.periods) {
    if (p.doc && !p.doc.ack) out.push({ periodIndex: p.index, item: "plan", label: sendItemLabel("plan"), sentAt: p.doc.sentAt });
    for (const w of p.weeks) {
      if (w.ack) continue;
      const item = `week:${w.view.n}` as SendItem;
      out.push({ periodIndex: p.index, item, label: sendItemLabel(item), sentAt: w.sentAt });
    }
    for (const e of p.evals) {
      if (e.ack) continue;
      const item = `eval:${e.view.which}` as SendItem;
      out.push({ periodIndex: p.index, item, label: sendItemLabel(item), sentAt: e.sentAt });
    }
  }
  return out.sort((a, b) => a.sentAt - b.sentAt);
}

/** «Lido na app · 06/10/2026 21:40» — hora de Lisboa, igual no servidor e
 *  no browser. */
export function ackStamp(at: number): string {
  const d = new Date(at).toLocaleString("en-GB", {
    timeZone: "Europe/Lisbon",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  return `Lido na app · ${d.replace(",", "")}`;
}

/** O documento tal como foi enviado. (Até à v77.77 levava a confirmação por
 *  baixo da assinatura do consultor; desde a v77.78 não há assinaturas — a
 *  leitura vive só na app.) */
export function docForDisplay(doc: PubDoc): DocModel {
  return doc.model;
}

/* ------------------------------ escrita ------------------------------ */

/** O publicado depois de um envio. Puro: o store grava o resultado. Um
 *  plano que passou para outro consultor começa do zero — o anterior não
 *  pode continuar a ver o que já não é dele. */
export function applySend(
  prev: PublishedPlan | null,
  plan: PlanLike & { id: string; consultantUsername: string },
  periodIndex: number,
  startDate: string,
  snap: Snapshot,
  actor: string,
  now: number,
): PublishedPlan {
  const base: PublishedPlan =
    prev && prev.consultantUsername === plan.consultantUsername
      ? prev
      : {
          id: plan.id,
          consultantUsername: plan.consultantUsername,
          consultantName: "",
          roleTeam: "",
          lead: "",
          checkinDay: "",
          periods: [],
          updatedAt: now,
        };
  const periods = [...base.periods];
  let i = periods.findIndex((p) => p.index === periodIndex);
  if (i < 0) {
    periods.push({ index: periodIndex, startDate, doc: null, weeks: [], evals: [] });
    periods.sort((a, b) => a.index - b.index);
    i = periods.findIndex((p) => p.index === periodIndex);
  }
  const period: PubPeriod = { ...periods[i], startDate };
  const stampBase = (old: PubBase | null): PubBase => ({
    sentAt: now,
    sentBy: actor,
    sig: snap.sig,
    // Reenviar o mesmo conteúdo mantém a confirmação; conteúdo novo pede uma
    // confirmação nova.
    ack: old && old.sig === snap.sig ? old.ack : null,
  });
  if (snap.kind === "plan") {
    period.doc = { ...stampBase(period.doc), model: snap.model };
  } else if (snap.kind === "week") {
    const old = period.weeks.find((w) => w.view.n === snap.n) ?? null;
    period.weeks = [
      ...period.weeks.filter((w) => w.view.n !== snap.n),
      { ...stampBase(old), view: snap.view },
    ].sort((a, b) => a.view.n - b.view.n);
  } else {
    const old = period.evals.find((e) => e.view.which === snap.which) ?? null;
    period.evals = [
      ...period.evals.filter((e) => e.view.which !== snap.which),
      { ...stampBase(old), view: snap.view },
    ].sort((a, b) => a.view.which - b.view.which);
  }
  periods[i] = period;
  return {
    ...base,
    consultantName: plan.consultantName.trim(),
    roleTeam: plan.roleTeam.trim(),
    lead: leadName(plan),
    checkinDay: plan.checkinDay.trim(),
    periods,
    updatedAt: now,
  };
}

/** A confirmação do consultor. null quando o item não existe. Confirmar
 *  duas vezes não muda a primeira data. */
export function applyAck(
  pub: PublishedPlan,
  periodIndex: number,
  item: SendItem,
  comment: string,
  now: number,
): PublishedPlan | null {
  const i = pub.periods.findIndex((p) => p.index === periodIndex);
  if (i < 0) return null;
  const p = { ...pub.periods[i] };
  const ack = (old: PubAck | null): PubAck => old ?? { at: now, comment: comment.trim().slice(0, 2000) };
  if (item === "plan") {
    if (!p.doc) return null;
    p.doc = { ...p.doc, ack: ack(p.doc.ack) };
  } else if (item === "eval:15" || item === "eval:30") {
    const which = item === "eval:15" ? 15 : 30;
    const j = p.evals.findIndex((e) => e.view.which === which);
    if (j < 0) return null;
    p.evals = p.evals.map((e, k) => (k === j ? { ...e, ack: ack(e.ack) } : e));
  } else {
    const n = Number(item.slice(5));
    const j = p.weeks.findIndex((w) => w.view.n === n);
    if (j < 0) return null;
    p.weeks = p.weeks.map((w, k) => (k === j ? { ...w, ack: ack(w.ack) } : w));
  }
  const periods = [...pub.periods];
  periods[i] = p;
  return { ...pub, periods, updatedAt: now };
}

/** O publicado lido do KV. Só o servidor escreve lá, por isso a verificação
 *  é estrutural: o que não tiver a forma certa cai. */
export function sanitizePublished(raw: unknown): PublishedPlan | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.id !== "string" || typeof r.consultantUsername !== "string") return null;
  const s = (v: unknown) => (typeof v === "string" ? v : "");
  const n = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);
  const ack = (v: unknown): PubAck | null =>
    v && typeof v === "object" && typeof (v as PubAck).at === "number"
      ? { at: (v as PubAck).at, comment: s((v as PubAck).comment) }
      : null;
  const base = (v: Record<string, unknown>): PubBase => ({
    sentAt: n(v.sentAt),
    sentBy: s(v.sentBy),
    sig: s(v.sig),
    ack: ack(v.ack),
  });
  const obj = (v: unknown): v is Record<string, unknown> => Boolean(v) && typeof v === "object";
  const periods: PubPeriod[] = (Array.isArray(r.periods) ? r.periods : [])
    .filter(obj)
    .map((p) => ({
      index: n(p.index),
      startDate: isISODate(p.startDate) ? p.startDate : "",
      doc: obj(p.doc) && obj(p.doc.model) ? { ...base(p.doc), model: p.doc.model as unknown as DocModel } : null,
      weeks: (Array.isArray(p.weeks) ? p.weeks : [])
        .filter((w): w is Record<string, unknown> => obj(w) && obj(w.view))
        .map((w) => ({ ...base(w), view: w.view as unknown as WeekView })),
      evals: (Array.isArray(p.evals) ? p.evals : [])
        .filter((e): e is Record<string, unknown> => obj(e) && obj(e.view))
        .map((e) => ({ ...base(e), view: e.view as unknown as EvalView })),
    }));
  return {
    id: r.id,
    consultantUsername: r.consultantUsername,
    consultantName: s(r.consultantName),
    roleTeam: s(r.roleTeam),
    lead: s(r.lead),
    checkinDay: s(r.checkinDay),
    periods,
    updatedAt: n(r.updatedAt),
  };
}

/* ------------------------------ rótulos ------------------------------ */

export const PULSE_TONE: Record<WeekPulse, { dot: string; text: string; ring: string; bg: string }> = {
  "no-caminho": { dot: "#10b981", text: "#047857", ring: "rgba(16,185,129,0.35)", bg: "rgba(16,185,129,0.10)" },
  "em-risco": { dot: "#f59e0b", text: "#b45309", ring: "rgba(245,158,11,0.40)", bg: "rgba(245,158,11,0.12)" },
  fora: { dot: "#f43f5e", text: "#be123c", ring: "rgba(244,63,94,0.40)", bg: "rgba(244,63,94,0.10)" },
};

export const PULSE_TEXT: Record<WeekPulse, string> = Object.fromEntries(
  PULSE_OPTIONS.map((o) => [o.id, o.label]),
) as Record<WeekPulse, string>;

export const MET_TEXT: Record<KpiMet, string> = Object.fromEntries(
  KPI_MET_OPTIONS.map((o) => [o.id, o.label]),
) as Record<KpiMet, string>;
