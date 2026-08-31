// O FECHO DO MÊS DAS AUSÊNCIAS — o que aterra no #ausencias no ÚLTIMO dia.
//
// PARA QUE SERVE: o resumo do dia 1 (`absences-monthly.ts`) é para a RH
// fazer contas — dias úteis por pessoa, recortados ao mês. Este é outra
// coisa: é o BALANÇO DO MOVIMENTO dos pedidos de ausência (folha RH-01)
// durante o mês — o que entrou, o que foi aprovado, o que foi recusado e o
// que ficou por decidir — dirigido ao André e à Alice antes de o mês virar.
// Logo a seguir ao balanço segue uma SEGUNDA mensagem: o mapa por
// colaborador, com toda a gente do roster mesmo a zeros (ver o bloco «A
// SEGUNDA MENSAGEM» lá em baixo).
//
// A DIFERENÇA QUE IMPORTA: aqui conta-se ATIVIDADE, não calendário. Um
// pedido submetido a 28/07 e aprovado a 02/08 aparece nos «pedidos» de julho
// e nos «aprovados» de agosto — cada lista responde a "o que aconteceu neste
// mês", e cada linha traz as duas datas para ninguém ter de adivinhar. As
// faltas (RH-02) entram pela mesma régua: contam no mês em que o C-Level as
// REGISTOU (não se pedem nem se aprovam — registar é o ato). Os dias
// recortados ao calendário continuam no resumo de assiduidade do dia 1.
//
// O DIA: a Vercel não aceita «L» (último dia) na expressão do cron, por isso
// o job corre a 28, 29, 30 e 31 (ver vercel.json) e é a rota que pergunta
// «hoje é o último dia do mês, em Lisboa?» (`lisbonToday` +
// `isLastDayOfMonth`). Só num sim é que a mensagem sai.

import { getSlackUserId, listImpersonationTargets } from "./auth/credentials";
import { formatDate } from "./dates";
import {
  absencePeriodLine,
  formatBusinessDays,
  formatDayCount,
  monthBounds,
  monthLabelPT,
  type AbsenceRequest,
  type AbsenceStatus,
} from "./absences-shared";
import {
  buildMonthlyDigest,
  HR_NAME,
  HR_SLACK_USER_ID,
  type PersonMonthLine,
} from "./absences-monthly";
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
  /** Só nas faltas: a classificação. `null` num pedido. */
  justified: boolean | null;
  /** yyyy-mm-dd (Lisboa) em que a folha foi submetida (nas faltas, em que
   *  o C-Level a registou). */
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
  /** Faltas (RH-02) registadas pelo C-Level durante o mês. */
  faltas: MonthCloseLine[];
  /** O mapa por colaborador — TODA a gente do roster, mesmo quem está a
   *  zeros. Ao contrário das listas de atividade acima, aqui os dias são
   *  RECORTADOS AO MÊS (a régua do resumo do dia 1): é a resposta a "quanto
   *  esteve fora esta pessoa em agosto", não a "que papéis andaram". */
  team: TeamMemberMonthLine[];
  totals: {
    requested: number;
    approved: number;
    rejected: number;
    pending: number;
    /** Dias úteis dos pedidos aprovados no mês — a dimensão do «sim». */
    approvedBusinessDays: number;
    faltas: number;
    /** Quantas dessas faltas estão marcadas como injustificadas. */
    faltasUnjustified: number;
  };
};

/** Uma linha do mapa por colaborador: a `PersonMonthLine` do resumo do dia 1
 *  com a garantia extra de existir para toda a gente do roster. */
export type TeamMemberMonthLine = PersonMonthLine & {
  /** true quando não há nada a apontar no mês — a linha do «✅». */
  clean: boolean;
};

/** Junta o roster inteiro ao resumo por pessoa do mês — quem não tem nada
 *  fica com uma linha a zeros em vez de desaparecer do mapa. Quem já saiu do
 *  roster mas tem registos no mês continua a aparecer, no fim. */
export function buildTeamMonth(
  all: AbsenceRequest[],
  year: number,
  month: number,
): TeamMemberMonthLine[] {
  const digest = buildMonthlyDigest(all, year, month);
  const byUsername = new Map(digest.people.map((p) => [p.username, p]));

  const zero = (p: { username: string; name: string; role: string; dept: string }): PersonMonthLine => ({
    username: p.username,
    name: p.name,
    role: p.role,
    dept: p.dept,
    approvedBusinessDays: 0,
    approvedByReason: {},
    faltaJustifiedDays: 0,
    faltaUnjustifiedDays: 0,
    faltaByReason: {},
    refs: [],
  });

  const team: TeamMemberMonthLine[] = listImpersonationTargets().map((p) => {
    const line = byUsername.get(p.username) ?? zero(p);
    byUsername.delete(p.username);
    return {
      ...line,
      // Identidade do roster de hoje — o registo congela cargos antigos.
      name: p.name,
      role: p.role,
      dept: p.dept,
      clean:
        line.approvedBusinessDays === 0 &&
        line.faltaJustifiedDays === 0 &&
        line.faltaUnjustifiedDays === 0,
    };
  });
  for (const orphan of byUsername.values()) {
    team.push({ ...orphan, clean: false });
  }
  return team;
}

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
    justified: a.justified,
    requestedOn: lisbonISODate(a.createdAt),
    decidedOn: a.decidedAt ? lisbonISODate(a.decidedAt) : null,
    decidedByName: a.decidedByName,
    decisionNote: a.decisionNote,
    decidedVia: a.decidedVia,
  };
}

/** Constrói o balanço de um mês a partir de todos os registos — os pedidos
 *  (RH-01) pela atividade de submissão/decisão, as faltas (RH-02) pela data
 *  em que foram registadas. */
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
  const faltas: MonthCloseLine[] = [];

  for (const a of all) {
    if (a.kind === "falta") {
      const line = toLine(a);
      if (inMonth(line.requestedOn)) faltas.push(line);
      continue;
    }
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
  faltas.sort(byRequested);

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
    faltas,
    team: buildTeamMonth(all, year, month),
    totals: {
      requested: requested.length,
      approved: approved.length,
      rejected: rejected.length,
      pending: pending.length,
      approvedBusinessDays: approved.reduce((s, l) => s + l.businessDays, 0),
      faltas: faltas.length,
      faltasUnjustified: faltas.filter((l) => l.justified === false).length,
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

/** «FAL-2026-001 · João B. — Falta injustificada · 20/08/2026 · Meio dia —
 *  manhã (registada por André Pavlenco a 20/08/2026 · ⚠️ injustificada)». */
function faltaLine(l: MonthCloseLine): string {
  const cls =
    l.justified === true
      ? "📄 justificada"
      : l.justified === false
        ? "⚠️ injustificada"
        : "por classificar";
  const note = l.decisionNote ? `\n>_${l.decisionNote.replace(/\n/g, " ")}_` : "";
  return `${baseLine(l)} _(registada por ${l.decidedByName ?? "—"} a ${day(l.decidedOn)} · ${cls})_${note}`;
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
    o.totals.requested === 0 &&
    o.totals.approved === 0 &&
    o.totals.rejected === 0 &&
    o.totals.faltas === 0;

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
      `${mentions} — ${monthLower} está a fechar. Aqui fica o balanço das ausências e faltas ` +
        `da equipa: o que entrou, o que foi aprovado, o que foi recusado, o que ainda está por ` +
        `decidir e as faltas que o C-Level registou.`,
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
        {
          type: "mrkdwn",
          text:
            `*⚠️ Faltas registadas*\n${o.totals.faltas}` +
            (o.totals.faltasUnjustified > 0
              ? ` · ${o.totals.faltasUnjustified} injustificada${o.totals.faltasUnjustified === 1 ? "" : "s"}`
              : ""),
        },
      ],
    },
    { type: "divider" },
  ];

  if (noMovement) {
    blocks.push(
      section(
        `✅ *Mês sem movimento nas ausências e faltas.* Ninguém submeteu uma folha em ${monthLower}, nada foi aprovado ou recusado, e o C-Level não registou faltas.`,
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
    pushList(
      blocks,
      `*⚠️ Faltas registadas em ${monthLower}* — ${o.totals.faltas}` +
        (o.totals.faltasUnjustified > 0
          ? ` · ${o.totals.faltasUnjustified} injustificada${o.totals.faltasUnjustified === 1 ? "" : "s"}`
          : ""),
      o.faltas.map(faltaLine),
      "Nenhuma falta registada este mês.",
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
          `Balanço de atividade — um pedido conta no mês em que foi submetido, a decisão no mês em que foi tomada ` +
          `e uma falta (RH-02) no mês em que o C-Level a registou. ` +
          `Os dias recortados ao calendário seguem no resumo de assiduidade do dia 1. ` +
          `Decidir os pendentes em <${APP_URL}/admin/ausencias|Ausências> · faltas em <${APP_URL}/admin/faltas|Faltas>.`,
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
    ` · ${o.totals.rejected} recusados · ${o.totals.pending} por decidir · ` +
    `${o.totals.faltas} falta${o.totals.faltas === 1 ? "" : "s"} registada${o.totals.faltas === 1 ? "" : "s"}.`
  );
}

/* ---------------------------------------------------------------- *
 * A SEGUNDA MENSAGEM — o mapa por colaborador                        *
 *                                                                   *
 * Dispara logo a seguir ao balanço: uma linha por pessoa do roster,  *
 * MESMO a zeros. O balanço diz o que se passou; este mapa diz com    *
 * quem — e o «✅ sem ausências nem faltas» é informação, não ruído:  *
 * é o que permite à Alice varrer a lista de cima a baixo sem ter de  *
 * se perguntar se alguém ficou de fora.                              *
 * ---------------------------------------------------------------- */

/** "Férias 5 dias · Consulta meio dia" — o detalhe entre parêntesis. */
function reasonBreakdown(map: Record<string, number>): string {
  return Object.entries(map)
    .sort((a, b) => b[1] - a[1])
    .map(([label, days]) => `${label} ${formatDayCount(days)}`)
    .join(" · ");
}

function teamMemberLine(p: TeamMemberMonthLine): string {
  const dept = p.dept ? ` _(${p.dept})_` : "";
  if (p.clean) return `• *${p.name}*${dept} — ✅ sem ausências nem faltas`;
  const bits: string[] = [];
  if (p.approvedBusinessDays > 0) {
    bits.push(
      `🌴 ${formatBusinessDays(p.approvedBusinessDays)} de ausência aprovada _(${reasonBreakdown(p.approvedByReason)})_`,
    );
  }
  const faltaBits: string[] = [];
  if (p.faltaUnjustifiedDays > 0) {
    faltaBits.push(`⚠️ ${formatDayCount(p.faltaUnjustifiedDays)} de falta injustificada`);
  }
  if (p.faltaJustifiedDays > 0) {
    faltaBits.push(`📄 ${formatDayCount(p.faltaJustifiedDays)} de falta justificada`);
  }
  if (faltaBits.length > 0) {
    bits.push(`${faltaBits.join(" · ")} _(${reasonBreakdown(p.faltaByReason)})_`);
  }
  return `• *${p.name}*${dept} — ${bits.join(" · ")}`;
}

/** O mapa por colaborador em Block Kit — a mensagem que segue o balanço. */
export function teamMonthBlocks(o: MonthCloseOverview): unknown[] {
  const monthLower = o.label.toLowerCase();
  const clean = o.team.filter((p) => p.clean).length;

  const blocks: unknown[] = [
    {
      type: "header",
      text: {
        type: "plain_text",
        text: `👥 Por colaborador · ${o.label}`,
        emoji: true,
      },
    },
    section(
      `O mapa de ${monthLower}, pessoa a pessoa — ausências aprovadas e faltas com os dias ` +
        `recortados ao mês. Toda a gente do roster aparece, mesmo quem está a zeros.`,
    ),
  ];

  pushList(
    blocks,
    `*👥 Colaboradores* — ${o.team.length} · ${clean} sem registos`,
    o.team.map(teamMemberLine),
    "O roster está vazio.",
  );

  blocks.push({ type: "divider" });
  blocks.push({
    type: "context",
    elements: [
      {
        type: "mrkdwn",
        text:
          `Régua do calendário — os mesmos números do resumo de assiduidade do dia 1, por isso uma ` +
          `ausência a cavalo entre meses conta aqui só a parte que caiu em ${monthLower}. ` +
          `Folhas em <${APP_URL}/admin/ausencias|Ausências> e <${APP_URL}/admin/faltas|Faltas>.`,
      },
    ],
  });

  return blocks;
}

/** Texto de fallback do mapa por colaborador. */
export function teamMonthText(o: MonthCloseOverview): string {
  const clean = o.team.filter((p) => p.clean).length;
  const approved = o.team.reduce((s, p) => s + p.approvedBusinessDays, 0);
  const faltas = o.team.reduce(
    (s, p) => s + p.faltaJustifiedDays + p.faltaUnjustifiedDays,
    0,
  );
  return (
    `Por colaborador · ${o.label}: ${o.team.length} colaboradores · ${clean} sem registos · ` +
    `${formatBusinessDays(approved)} de ausência aprovada · ${formatDayCount(faltas)} de falta.`
  );
}

/** Lê o KV, constrói e publica o fecho do mês pedido — DUAS mensagens, por
 *  esta ordem: o balanço de atividade e, logo a seguir, o mapa por
 *  colaborador. Devolve o que foi enviado, para o chamador (cron ou botão
 *  do Control Suite) poder mostrar. */
export async function sendMonthClose(
  year: number,
  month: number,
): Promise<{
  overview: MonthCloseOverview;
  delivered: boolean;
  teamDelivered: boolean;
}> {
  const all = await listAbsences();
  const overview = buildMonthClose(all, year, month);
  const delivered = await postAusenciasToSlack({
    text: monthCloseText(overview),
    blocks: monthCloseBlocks(overview),
  });
  // A segunda só segue se a primeira saiu — um mapa sem balanço à frente
  // seria uma mensagem órfã, e o falhanço do webhook afeta as duas igual.
  const teamDelivered = delivered
    ? await postAusenciasToSlack({
        text: teamMonthText(overview),
        blocks: teamMonthBlocks(overview),
      })
    : false;
  return { overview, delivered, teamDelivered };
}

export { ANDRE_NAME, ANDRE_SLACK_USER_ID };
