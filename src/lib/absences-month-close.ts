// O FECHO DO MÊS DAS AUSÊNCIAS — o que aterra no #ausencias no ÚLTIMO dia.
//
// PARA QUE SERVE: o resumo do dia 1 (`absences-monthly.ts`) é para a RH
// fazer contas — dias úteis por pessoa, recortados ao mês. Este é outra
// coisa: é o BALANÇO DO MOVIMENTO dos pedidos de ausência (folha RH-01)
// durante o mês — o que entrou, o que foi aprovado, o que foi recusado e o
// que ficou por decidir — dirigido ao André e à Alice antes de o mês virar.
//
// A DIFERENÇA QUE IMPORTA: aqui conta-se ATIVIDADE, não calendário. Um
// pedido submetido a 28/07 e aprovado a 02/08 aparece nos «pedidos» de julho
// e nos «aprovados» de agosto — cada lista responde a "o que aconteceu neste
// mês", e cada linha traz as duas datas para ninguém ter de adivinhar. As
// faltas (RH-02) ficam de fora de propósito: não se pedem nem se aprovam, e
// já vão no resumo do dia 1.
//
// O DIA: a Vercel não aceita «L» (último dia) na expressão do cron, por isso
// o job corre a 28, 29, 30 e 31 (ver vercel.json) e é a rota que pergunta
// «hoje é o último dia do mês, em Lisboa?» (`lisbonToday` +
// `isLastDayOfMonth`). Só num sim é que a mensagem sai.

import { getSlackUserId } from "./auth/credentials";
import { formatDate } from "./dates";
import {
  absencePeriodLine,
  formatBusinessDays,
  monthBounds,
  monthLabelPT,
  type AbsenceRequest,
  type AbsenceStatus,
} from "./absences-shared";
import { HR_NAME, HR_SLACK_USER_ID } from "./absences-monthly";
import { listAbsences } from "./absences-store";
import { postAusenciasToSlack } from "./slack";

/** Os dois destinatários. O André vem do mapa central de member ids (é o
 *  mesmo id que o sino e as menções usam); a Alice do resumo do dia 1. Os
 *  fallbacks em texto são propositados — se um id mudar a mensagem sai na
 *  mesma, só sem o toque no telemóvel. */
const ANDRE_SLACK_USER_ID =
  process.env.SLACK_ANDRE_USER_ID || getSlackUserId("andre") || "U05QPJZHE56";
const ANDRE_NAME = "André Pavlenco";

const APP_URL = "https://wonder-ads-workspace.vercel.app";

/* ---------------------------------------------------------------- *
 * O CALENDÁRIO DE LISBOA                                            *
 *                                                                   *
 * As funções da Vercel correm em UTC. No verão Lisboa é UTC+1, e um  *
 * pedido submetido às 00:30 de dia 1 ainda é «ontem» em UTC. Todas   *
 * as datas de atividade passam por aqui para que o mês seja o mês    *
 * que a equipa vive, não o do servidor.                              *
 * ---------------------------------------------------------------- */

const LISBON = "Europe/Lisbon";
const lisbonDateFmt = new Intl.DateTimeFormat("en-CA", {
  timeZone: LISBON,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** yyyy-mm-dd de um instante, visto de Lisboa. */
export function lisbonISODate(at: Date | number): string {
  return lisbonDateFmt.format(typeof at === "number" ? new Date(at) : at);
}

/** «Hoje» em Lisboa, já partido em ano/mês/dia. */
export function lisbonToday(now: Date = new Date()): {
  iso: string;
  year: number;
  month: number;
  day: number;
} {
  const iso = lisbonISODate(now);
  const [year, month, day] = iso.split("-").map(Number);
  return { iso, year, month, day };
}

/** É o último dia do mês? (yyyy-mm-dd → 31/08 sim, 30/08 não.) */
export function isLastDayOfMonth(iso: string): boolean {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return false;
  return d === new Date(y, m, 0).getDate();
}

/** O mês anterior a um (ano, mês). Agosto → julho; janeiro → dezembro. */
export function monthBefore(year: number, month: number): { year: number; month: number } {
  return month === 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 };
}

/* ---------------------------------------------------------------- *
 * O BALANÇO                                                         *
 * ---------------------------------------------------------------- */

export type MonthCloseLine = {
  id: string;
  ref: string;
  username: string;
  name: string;
  reasonLabel: string;
  /** "17/08/2026 → 21/08/2026 · Vários dias" — a mesma linha de todo o lado. */
  period: string;
  calendarDays: number;
  businessDays: number;
  /** Estado ATUAL do pedido (o que a lista de «pedidos» mostra ao lado). */
  status: AbsenceStatus;
  /** yyyy-mm-dd (Lisboa) em que a folha foi submetida. */
  requestedOn: string;
  /** yyyy-mm-dd (Lisboa) da decisão, ou null enquanto pendente. */
  decidedOn: string | null;
  decidedByName: string | null;
  decisionNote: string | null;
  decidedVia: "app" | "slack" | null;
};

export type MonthCloseOverview = {
  year: number;
  month: number;
  label: string;
  from: string;
  to: string;
  /** Submetidos durante o mês, seja qual for o estado hoje. */
  requested: MonthCloseLine[];
  /** Aprovados durante o mês (pela data da decisão). */
  approved: MonthCloseLine[];
  /** Recusados durante o mês (pela data da decisão). */
  rejected: MonthCloseLine[];
  /** Submetidos até ao fim do mês e AINDA sem decisão. */
  pending: MonthCloseLine[];
  totals: {
    requested: number;
    approved: number;
    rejected: number;
    pending: number;
    /** Dias úteis dos pedidos aprovados no mês — a dimensão do «sim». */
    approvedBusinessDays: number;
  };
};

function toLine(a: AbsenceRequest): MonthCloseLine {
  return {
    id: a.id,
    ref: a.ref,
    username: a.username,
    name: a.name,
    reasonLabel: a.reasonLabel,
    period: absencePeriodLine(a),
    calendarDays: a.calendarDays,
    businessDays: a.businessDays,
    status: a.status,
    requestedOn: lisbonISODate(a.createdAt),
    decidedOn: a.decidedAt ? lisbonISODate(a.decidedAt) : null,
    decidedByName: a.decidedByName,
    decisionNote: a.decisionNote,
    decidedVia: a.decidedVia,
  };
}

/** Constrói o balanço de um mês a partir de todos os registos. Só olha
 *  para a folha RH-01 (`kind === "request"`). */
export function buildMonthClose(
  all: AbsenceRequest[],
  year: number,
  month: number,
): MonthCloseOverview {
  const { from, to } = monthBounds(year, month);
  const inMonth = (iso: string | null) => iso !== null && iso >= from && iso <= to;

  const requested: MonthCloseLine[] = [];
  const approved: MonthCloseLine[] = [];
  const rejected: MonthCloseLine[] = [];
  const pending: MonthCloseLine[] = [];

  for (const a of all) {
    if (a.kind !== "request") continue;
    const line = toLine(a);
    if (inMonth(line.requestedOn)) requested.push(line);
    if (a.status === "approved" && inMonth(line.decidedOn)) approved.push(line);
    if (a.status === "rejected" && inMonth(line.decidedOn)) rejected.push(line);
    // Um pendente conta para o fecho se já existia quando o mês acabou —
    // inclui os que vêm de meses anteriores e continuam à espera.
    if (a.status === "pending" && line.requestedOn <= to) pending.push(line);
  }

  const byRequested = (x: MonthCloseLine, y: MonthCloseLine) =>
    x.requestedOn.localeCompare(y.requestedOn) || x.ref.localeCompare(y.ref);
  const byDecided = (x: MonthCloseLine, y: MonthCloseLine) =>
    (x.decidedOn ?? "").localeCompare(y.decidedOn ?? "") || x.ref.localeCompare(y.ref);

  requested.sort(byRequested);
  approved.sort(byDecided);
  rejected.sort(byDecided);
  pending.sort(byRequested);

  return {
    year,
    month,
    label: monthLabelPT(year, month),
    from,
    to,
    requested,
    approved,
    rejected,
    pending,
    totals: {
      requested: requested.length,
      approved: approved.length,
      rejected: rejected.length,
      pending: pending.length,
      approvedBusinessDays: approved.reduce((s, l) => s + l.businessDays, 0),
    },
  };
}

/* ---------------------------------------------------------------- *
 * A MENSAGEM                                                        *
 * ---------------------------------------------------------------- */

/** "03/08/2026" a partir de yyyy-mm-dd. */
function day(iso: string | null): string {
  return iso ? formatDate(`${iso}T00:00:00`) : "—";
}

/** Dias inteiros entre duas datas ISO (para o «há N dias» dos pendentes). */
function daysBetween(fromISO: string, toISO: string): number {
  const a = new Date(`${fromISO}T00:00:00`).getTime();
  const b = new Date(`${toISO}T00:00:00`).getTime();
  return Math.max(0, Math.round((b - a) / 86_400_000));
}

function statusTag(status: AbsenceStatus): string {
  if (status === "approved") return "✅ aprovado";
  if (status === "rejected") return "❌ recusado";
  if (status === "pending") return "⏳ por decidir";
  return "registado";
}

/** «AUS-2026-007 · Maria Silva — Férias · 17/08 → 21/08 · 5 dias úteis». */
function baseLine(l: MonthCloseLine): string {
  const days = l.businessDays >= 1 ? ` · ${formatBusinessDays(l.businessDays)}` : "";
  return `• *${l.ref}* · ${l.name} — ${l.reasonLabel} · ${l.period}${days}`;
}

function requestedLine(l: MonthCloseLine): string {
  return `${baseLine(l)} _(pedido a ${day(l.requestedOn)} · ${statusTag(l.status)})_`;
}

function decidedLine(l: MonthCloseLine): string {
  const verb = l.status === "approved" ? "aprovado" : "recusado";
  const via = l.decidedVia === "slack" ? " no Slack" : "";
  const note = l.decisionNote ? `\n>_${l.decisionNote.replace(/\n/g, " ")}_` : "";
  return `${baseLine(l)} _(${verb} por ${l.decidedByName ?? "—"} a ${day(l.decidedOn)}${via} · pedido a ${day(l.requestedOn)})_${note}`;
}

function pendingLine(l: MonthCloseLine, todayISO: string): string {
  const age = daysBetween(l.requestedOn, todayISO);
  const ageText = age === 0 ? "hoje" : age === 1 ? "há 1 dia" : `há ${age} dias`;
  return `${baseLine(l)} _(pedido a ${day(l.requestedOn)} · ${ageText})_`;
}

/** Um bloco «section» de mrkdwn tem um teto de 3000 caracteres no Slack, e
 *  uma mensagem tem um teto de 50 blocos. A lista é partida em secções e,
 *  se mesmo assim for demasiado longa, cortada com um «e mais N» — o resto
 *  fica sempre na app. */
const SECTION_MAX_CHARS = 2800;
const LIST_MAX_LINES = 40;

function section(text: string): unknown {
  return { type: "section", text: { type: "mrkdwn", text } };
}

function pushList(blocks: unknown[], title: string, lines: string[], emptyText: string) {
  if (lines.length === 0) {
    blocks.push(section(`${title}\n_${emptyText}_`));
    return;
  }
  const shown = lines.slice(0, LIST_MAX_LINES);
  const dropped = lines.length - shown.length;
  if (dropped > 0) shown.push(`_… e mais ${dropped} — lista completa na app._`);

  let buf = title;
  for (const line of shown) {
    if (buf.length + 1 + line.length > SECTION_MAX_CHARS) {
      blocks.push(section(buf));
      buf = line;
    } else {
      buf += `\n${line}`;
    }
  }
  blocks.push(section(buf));
}

/** A mensagem em Block Kit. Separada do envio para poder ser
 *  pré-visualizada na app sem publicar nada. `todayISO` é só para o «há N
 *  dias» dos pendentes. */
export function monthCloseBlocks(
  o: MonthCloseOverview,
  todayISO: string = lisbonToday().iso,
): unknown[] {
  const mentions = `<@${ANDRE_SLACK_USER_ID}> <@${HR_SLACK_USER_ID}>`;
  const monthLower = o.label.toLowerCase();
  const noMovement =
    o.totals.requested === 0 && o.totals.approved === 0 && o.totals.rejected === 0;

  const blocks: unknown[] = [
    {
      type: "header",
      text: {
        type: "plain_text",
        text: `📆 Fecho do mês · Ausências · ${o.label}`,
        emoji: true,
      },
    },
    section(
      `${mentions} — ${monthLower} está a fechar. Aqui fica o balanço dos pedidos de ausência ` +
        `da equipa: o que entrou, o que foi aprovado, o que foi recusado e o que ainda está por decidir.`,
    ),
    {
      type: "section",
      fields: [
        { type: "mrkdwn", text: `*📥 Pedidos submetidos*\n${o.totals.requested}` },
        {
          type: "mrkdwn",
          text:
            `*✅ Aprovados*\n${o.totals.approved}` +
            (o.totals.approved > 0
              ? ` · ${formatBusinessDays(o.totals.approvedBusinessDays)}`
              : ""),
        },
        { type: "mrkdwn", text: `*❌ Recusados*\n${o.totals.rejected}` },
        {
          type: "mrkdwn",
          text: `*⏳ Por decidir*\n${o.totals.pending}${o.totals.pending > 0 ? " ⚠️" : ""}`,
        },
      ],
    },
    { type: "divider" },
  ];

  if (noMovement) {
    blocks.push(
      section(
        `✅ *Mês sem movimento nos pedidos de ausência.* Ninguém submeteu uma folha em ${monthLower}, e nada foi aprovado ou recusado.`,
      ),
    );
  } else {
    pushList(
      blocks,
      `*📥 Pedidos submetidos em ${monthLower}* — ${o.totals.requested}`,
      o.requested.map(requestedLine),
      "Nenhum pedido entrou este mês.",
    );
    pushList(
      blocks,
      `*✅ Aprovados em ${monthLower}* — ${o.totals.approved}` +
        (o.totals.approved > 0
          ? ` · ${formatBusinessDays(o.totals.approvedBusinessDays)}`
          : ""),
      o.approved.map(decidedLine),
      "Nenhuma aprovação este mês.",
    );
    pushList(
      blocks,
      `*❌ Recusados em ${monthLower}* — ${o.totals.rejected}`,
      o.rejected.map(decidedLine),
      "Nenhuma recusa este mês.",
    );
  }

  if (o.pending.length > 0) {
    pushList(
      blocks,
      `*⏳ Ainda por decidir* — ${o.totals.pending} · a fechar o mês com pedidos em aberto`,
      o.pending.map((l) => pendingLine(l, todayISO)),
      "",
    );
  }

  blocks.push({ type: "divider" });
  blocks.push({
    type: "context",
    elements: [
      {
        type: "mrkdwn",
        text:
          `Balanço de atividade — um pedido conta no mês em que foi submetido e a decisão no mês em que foi tomada. ` +
          `As faltas (RH-02) e os dias recortados ao mês seguem no resumo de assiduidade do dia 1. ` +
          `Decidir os pendentes em <${APP_URL}/admin/ausencias|Ausências>.`,
      },
    ],
  });

  return blocks;
}

/** Texto de fallback (notificações, clientes sem Block Kit). */
export function monthCloseText(o: MonthCloseOverview): string {
  return (
    `Fecho de ${o.label} — Ausências (${ANDRE_NAME}, ${HR_NAME}): ` +
    `${o.totals.requested} pedidos submetidos · ${o.totals.approved} aprovados` +
    (o.totals.approved > 0 ? ` (${formatBusinessDays(o.totals.approvedBusinessDays)})` : "") +
    ` · ${o.totals.rejected} recusados · ${o.totals.pending} por decidir.`
  );
}

/** Lê o KV, constrói e publica o balanço do mês pedido. Devolve o que foi
 *  enviado, para o chamador (cron ou botão do Control Suite) poder mostrar. */
export async function sendMonthClose(
  year: number,
  month: number,
): Promise<{ overview: MonthCloseOverview; delivered: boolean }> {
  const all = await listAbsences();
  const overview = buildMonthClose(all, year, month);
  const delivered = await postAusenciasToSlack({
    text: monthCloseText(overview),
    blocks: monthCloseBlocks(overview),
  });
  return { overview, delivered };
}

export { ANDRE_NAME, ANDRE_SLACK_USER_ID };
