// O ponto de situação de um plano — o que o cockpit do editor, a lista do
// SuperAdmin e a página do consultor mostram por cima do documento: a linha
// dos 30 dias, os próximos passos e a saúde dos KPIs semana a semana.
// Puro (sem KV, sem relógio): o «hoje» entra sempre por parâmetro.

import { S05 } from "./document";
import {
  defaultWeekDates,
  eval30Open,
  finalDecision,
  kpiFilled,
  periodDates,
  weekDate,
  type ProbationDraft,
  type ProbationPeriod,
  type WeekPulse,
} from "./shared";
import { pubPeriod, sendState, snapshotFor, type PublishedPlan, type SendItem } from "./published";

/** «Hoje» em Lisboa, YYYY-MM-DD — igual no servidor (UTC) e no browser. */
export function todayLisbonISO(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Lisbon" }).format(now);
}

export type TimelineWeek = {
  n: number;
  date: string;
  state: "done" | "due" | "late" | "future";
  pulse: WeekPulse | null;
};

export type TimelineEval = {
  which: 15 | 30;
  date: string;
  state: "decided" | "due" | "late" | "future" | "na";
  color: string | null;
};

const OUTCOME_COLOR: Record<string, string> = Object.fromEntries(S05.outcomes.map((o) => [o.id, o.color]));

function byDate(date: string, today: string): "due" | "late" | "future" {
  if (!date) return "future";
  if (date < today) return "late";
  if (date === today) return "due";
  return "future";
}

/** A linha do tempo do lado da direção (o rascunho inteiro). */
export function timelineFromPlan(
  plan: Pick<ProbationDraft, "checkinDay">,
  period: ProbationPeriod,
  today: string,
): { weeks: TimelineWeek[]; evals: TimelineEval[] } {
  const { d15, d30 } = periodDates(period);
  const closedAt15 = Boolean(period.eval15.decision) && !eval30Open(period);
  return {
    weeks: period.weeks.map((w) => {
      const date = weekDate(w, period.startDate, plan.checkinDay);
      return { n: w.n, date, state: w.done ? "done" : byDate(date, today), pulse: w.pulse };
    }),
    evals: [
      {
        which: 15,
        date: d15,
        state: period.eval15.decision ? "decided" : byDate(d15, today),
        color: period.eval15.decision ? OUTCOME_COLOR[period.eval15.decision] : null,
      },
      {
        which: 30,
        date: d30,
        state: closedAt15 ? "na" : period.eval30.decision ? "decided" : byDate(d30, today),
        color: period.eval30.decision ? OUTCOME_COLOR[period.eval30.decision] : null,
      },
    ],
  };
}

/** A linha do tempo do lado do consultor — só com o que lhe foi enviado. */
export function timelineFromPub(pub: PublishedPlan, index: number) {
  const p = pubPeriod(pub, index);
  const startDate = p?.startDate ?? "";
  const dates = defaultWeekDates(startDate, pub.checkinDay);
  const { d15, d30 } = periodDates({ startDate });
  const ev15 = p?.evals.find((e) => e.view.which === 15) ?? null;
  const ev30 = p?.evals.find((e) => e.view.which === 30) ?? null;
  const closedAt15 = Boolean(ev15 && ev15.view.decision !== "extensao");
  const weeks: TimelineWeek[] = dates.map((d, i) => {
    const sent = p?.weeks.find((w) => w.view.n === i + 1);
    const date = sent?.view.date || d;
    // O que ainda não lhe foi enviado fica neutro: os check-ins e as
    // avaliações não são dele para fazer, nunca aparecem «atrasados».
    return { n: i + 1, date, state: sent ? "done" : "future", pulse: sent?.view.pulse ?? null };
  });
  const evals: TimelineEval[] = [
    {
      which: 15,
      date: d15,
      state: ev15 ? "decided" : "future",
      color: ev15 ? OUTCOME_COLOR[ev15.view.decision] : null,
    },
    {
      which: 30,
      date: d30,
      state: closedAt15 ? "na" : ev30 ? "decided" : "future",
      color: ev30 ? OUTCOME_COLOR[ev30.view.decision] : null,
    },
  ];
  return { startDate, weeks, evals };
}

/* ------------------------------ próximos passos ------------------------------ */

export type NextStep = {
  key: string;
  tone: "late" | "today" | "soon" | "info" | "done";
  title: string;
  detail: string;
  /** Para onde o botão leva no editor. */
  tab: "plano" | "semanas" | "avaliacoes" | "envios";
  item?: SendItem;
  week?: number;
};

function whenText(date: string, today: string): { tone: NextStep["tone"]; text: string } {
  if (!date) return { tone: "info", text: "sem data" };
  const [a, b] = [today, date].map((x) => {
    const [y, m, d] = x.split("-").map(Number);
    return Date.UTC(y, m - 1, d);
  });
  const days = Math.round((b - a) / 86_400_000);
  if (days < 0) return { tone: "late", text: `atrasado ${-days} d` };
  if (days === 0) return { tone: "today", text: "hoje" };
  if (days === 1) return { tone: "soon", text: "amanhã" };
  return { tone: days <= 3 ? "soon" : "info", text: `daqui a ${days} d` };
}

/** O que a direção tem de fazer a seguir neste plano, por urgência. Inclui
 *  o que está feito mas ainda não foi enviado ao consultor. */
export function nextSteps(
  plan: ProbationDraft,
  periodIndex: number,
  pub: PublishedPlan | null,
  today: string,
): NextStep[] {
  const out: NextStep[] = [];
  const period = plan.period;
  if (finalDecision(period) && finalDecision(period) !== "extensao") {
    return [{ key: "closed", tone: "done", title: "Plano fechado", detail: "A decisão final está registada.", tab: "avaliacoes" }];
  }
  const sentOf = (item: SendItem) => {
    const snap = snapshotFor(plan, period, periodIndex, item);
    const p = pubPeriod(pub, periodIndex);
    const entry =
      item === "plan"
        ? (p?.doc ?? null)
        : item.startsWith("week:")
          ? (p?.weeks.find((w) => w.view.n === Number(item.slice(5))) ?? null)
          : (p?.evals.find((e) => `eval:${e.view.which}` === item) ?? null);
    return sendState(entry, snap?.sig ?? null);
  };

  // 1. O plano em si tem de chegar ao consultor.
  const planSent = sentOf("plan");
  const hasKpis = period.kpis15.some(kpiFilled) || period.kpis30.some(kpiFilled);
  if (planSent.kind === "never") {
    out.push({
      key: "send-plan",
      tone: hasKpis ? "today" : "info",
      title: hasKpis ? "Enviar o plano ao consultor" : "Escrever os KPIs do plano",
      detail: hasKpis
        ? "Ainda não foi enviado — revê a pré-visualização e envia."
        : "Sem KPIs o plano ainda não pode ser enviado.",
      tab: hasKpis ? "envios" : "plano",
      item: "plan",
    });
  } else if (planSent.kind === "changed") {
    out.push({
      key: "resend-plan",
      tone: "soon",
      title: "Reenviar o plano",
      detail: "Mudou desde o último envio — o consultor está a ver a versão anterior.",
      tab: "envios",
      item: "plan",
    });
  }

  // 2. Check-ins: o próximo por fazer e os feitos por enviar.
  for (const w of period.weeks) {
    const date = weekDate(w, period.startDate, plan.checkinDay);
    if (!w.done) {
      const when = whenText(date, today);
      out.push({
        key: `week-${w.n}`,
        tone: when.tone,
        title: `Check-in da semana ${w.n}`,
        detail: `${when.text} · ${date.split("-").reverse().join("/")}`,
        tab: "semanas",
        week: w.n,
      });
      // Só o primeiro check-in por fazer interessa; os seguintes vêm depois.
      break;
    }
  }
  for (const w of period.weeks) {
    if (!w.done) continue;
    const item = `week:${w.n}` as SendItem;
    const st = sentOf(item);
    if (st.kind === "sent") continue;
    out.push({
      key: `send-week-${w.n}`,
      tone: "soon",
      title: st.kind === "never" ? `Enviar o check-in da semana ${w.n}` : `Reenviar o check-in da semana ${w.n}`,
      detail: st.kind === "never" ? "Feito, mas o consultor ainda não o recebeu." : "Mudou desde o envio.",
      tab: "semanas",
      week: w.n,
      item,
    });
  }

  // 3. Avaliações por decidir e decisões por enviar.
  const { d15, d30 } = periodDates(period);
  const evals: [15 | 30, string, boolean][] = [
    [15, d15, true],
    [30, d30, eval30Open(period)],
  ];
  for (const [which, date, open] of evals) {
    if (!open) continue;
    const ev = which === 15 ? period.eval15 : period.eval30;
    const item = `eval:${which}` as SendItem;
    if (!ev.decision) {
      const when = whenText(date, today);
      out.push({
        key: `eval-${which}`,
        tone: when.tone === "info" ? "info" : when.tone,
        title: `Avaliação dos ${which} dias`,
        detail: `${when.text} · ${date.split("-").reverse().join("/")}`,
        tab: "avaliacoes",
      });
      break;
    }
    const st = sentOf(item);
    if (st.kind !== "sent") {
      out.push({
        key: `send-eval-${which}`,
        tone: "today",
        title: `${st.kind === "never" ? "Enviar" : "Reenviar"} a avaliação dos ${which} dias`,
        detail: "A decisão está registada; o consultor tem de a receber por escrito.",
        tab: "avaliacoes",
        item,
      });
    }
  }

  const rank: Record<NextStep["tone"], number> = { late: 0, today: 1, soon: 2, info: 3, done: 4 };
  return out.sort((a, b) => rank[a.tone] - rank[b.tone]);
}

/* ------------------------------ saúde dos KPIs ------------------------------ */

export type KpiHealthRow = {
  name: string;
  target: string;
  /** Um ponto por check-in (1–4) — null quando a semana não o acompanhou. */
  pulses: (WeekPulse | null | undefined)[];
  latest: string;
};

/** Cada KPI (dos 15 e dos 30 dias) com o semáforo de cada semana. */
export function kpiHealth(period: ProbationPeriod): { which: 15 | 30; rows: KpiHealthRow[] }[] {
  const make = (which: 15 | 30) => {
    const kpis = (which === 15 ? period.kpis15 : period.kpis30).filter(kpiFilled);
    return {
      which,
      rows: kpis.map((k) => {
        let latest = "";
        const pulses = period.weeks.map((w) => {
          const row = w.kpis.find((x) => x.kpiId === k.id);
          if (!row) return undefined;
          if (row.value.trim()) latest = row.value.trim();
          return row.pulse;
        });
        return { name: k.kpi.trim(), target: k.target.trim(), pulses, latest };
      }),
    };
  };
  return [make(15), make(30)].filter((g) => g.rows.length > 0);
}
