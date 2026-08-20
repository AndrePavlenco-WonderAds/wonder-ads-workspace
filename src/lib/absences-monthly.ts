// O RESUMO MENSAL DE ASSIDUIDADE — o que aterra no #ausencias no dia 1.
//
// PARA QUE SERVE: a RH precisa de saber, de uma olhadela, quantos dias úteis
// cada pessoa esteve fora no mês que fechou e quais deles são para descontar.
// Essa informação existe espalhada por dezenas de folhas; esta mensagem é o
// mapa que as junta.
//
// DUAS DECISÕES QUE VALE A PENA CONHECER:
//
//  1. Os dias são RECORTADOS AO MÊS (ver `absencePortionInRange`). Umas
//     férias de 28/06 a 04/07 entram com 3 dias em junho e 4 em julho, não
//     com 7 no mês em que começaram. Sem isto, o processamento salarial de
//     um mês levava dias do outro.
//
//  2. A mensagem NÃO decide o que se desconta. Diz o que aconteceu e separa
//     o que é justificado do que não é — descontar é decisão da RH, e uma
//     app que a tomasse sozinha estaria a mexer no salário de alguém a
//     partir de um dropdown.

import {
  absencePortionInRange,
  formatDayCount,
  justifiedLabel,
  monthBounds,
  monthLabelPT,
  type AbsenceRequest,
} from "./absences-shared";
import { listAbsences } from "./absences-store";
import { postAusenciasToSlack } from "./slack";

/** Member id da Alice (RH) — é a ela que o resumo é dirigido. Fica aqui e
 *  não em SLACK_USER_IDS porque este é o destinatário do relatório, não uma
 *  menção gerada a partir de um username qualquer. O fallback em texto é
 *  propositado: se um dia o id mudar, a mensagem continua a sair. */
const HR_SLACK_USER_ID = process.env.SLACK_HR_USER_ID || "U05PZR0UWAX";
const HR_NAME = "Alice Santos";

export type PersonMonthLine = {
  username: string;
  name: string;
  role: string;
  dept: string;
  /** Dias úteis de ausência APROVADA dentro do mês. */
  approvedBusinessDays: number;
  /** Motivo → dias úteis, para a linha detalhada ("Férias 5 · Consulta 0,5"). */
  approvedByReason: Record<string, number>;
  /** Dias úteis de falta dentro do mês, separados pela classificação. */
  faltaJustifiedDays: number;
  faltaUnjustifiedDays: number;
  faltaByReason: Record<string, number>;
  /** Referências citáveis — o número que a RH usa para ir ver a folha. */
  refs: string[];
};

export type MonthlyDigest = {
  year: number;
  month: number;
  label: string;
  from: string;
  to: string;
  people: PersonMonthLine[];
  totals: {
    approvedBusinessDays: number;
    faltaJustifiedDays: number;
    faltaUnjustifiedDays: number;
  };
};

/** O mês que fechou, visto de uma data qualquer. A 01/09 devolve agosto. */
export function previousMonth(now: Date): { year: number; month: number } {
  const y = now.getFullYear();
  const m = now.getMonth() + 1; // 1–12
  return m === 1 ? { year: y - 1, month: 12 } : { year: y, month: m - 1 };
}

function bump(map: Record<string, number>, key: string, value: number) {
  if (value <= 0) return;
  map[key] = (map[key] ?? 0) + value;
}

/** Constrói o resumo de um mês a partir de todos os registos. */
export function buildMonthlyDigest(
  all: AbsenceRequest[],
  year: number,
  month: number,
): MonthlyDigest {
  const { from, to } = monthBounds(year, month);
  const byPerson = new Map<string, PersonMonthLine>();

  for (const a of all) {
    // Um pedido recusado, ou ainda por decidir, não é tempo fora — é papel.
    const counts =
      a.kind === "falta" ? true : a.status === "approved";
    if (!counts) continue;

    const portion = absencePortionInRange(a, from, to);
    if (portion.businessDays <= 0 && portion.calendarDays <= 0) continue;

    let line = byPerson.get(a.username);
    if (!line) {
      line = {
        username: a.username,
        name: a.name,
        role: a.role,
        dept: a.dept,
        approvedBusinessDays: 0,
        approvedByReason: {},
        faltaJustifiedDays: 0,
        faltaUnjustifiedDays: 0,
        faltaByReason: {},
        refs: [],
      };
      byPerson.set(a.username, line);
    }

    if (a.kind === "falta") {
      if (a.justified === true) line.faltaJustifiedDays += portion.businessDays;
      else line.faltaUnjustifiedDays += portion.businessDays;
      bump(line.faltaByReason, a.reasonLabel, portion.businessDays);
    } else {
      line.approvedBusinessDays += portion.businessDays;
      bump(line.approvedByReason, a.reasonLabel, portion.businessDays);
    }
    line.refs.push(a.ref);
  }

  const people = [...byPerson.values()].sort((x, y) => {
    // Quem tem faltas injustificadas primeiro — é o que a RH procura.
    if (y.faltaUnjustifiedDays !== x.faltaUnjustifiedDays) {
      return y.faltaUnjustifiedDays - x.faltaUnjustifiedDays;
    }
    return x.name.localeCompare(y.name, "pt");
  });

  return {
    year,
    month,
    label: monthLabelPT(year, month),
    from,
    to,
    people,
    totals: {
      approvedBusinessDays: people.reduce((s, p) => s + p.approvedBusinessDays, 0),
      faltaJustifiedDays: people.reduce((s, p) => s + p.faltaJustifiedDays, 0),
      faltaUnjustifiedDays: people.reduce((s, p) => s + p.faltaUnjustifiedDays, 0),
    },
  };
}

function reasonBreakdown(map: Record<string, number>): string {
  const parts = Object.entries(map)
    .sort((a, b) => b[1] - a[1])
    .map(([label, days]) => `${label} ${formatDayCount(days)}`);
  return parts.join(" · ");
}

/** A mensagem em Block Kit. Separada do envio para poder ser pré-visualizada
 *  na app sem publicar nada. */
export function monthlyDigestBlocks(d: MonthlyDigest): unknown[] {
  const mention = `<@${HR_SLACK_USER_ID}>`;
  const blocks: unknown[] = [
    {
      type: "header",
      text: {
        type: "plain_text",
        text: `📅 Assiduidade · ${d.label}`,
        emoji: true,
      },
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text:
          `${mention} — o mês fechou. Aqui vai o mapa de ausências e faltas da equipa ` +
          `para o processamento, já com os dias recortados ao mês (uma ausência a cavalo ` +
          `entre meses conta só a parte que caiu em ${d.label.toLowerCase()}).`,
      },
    },
  ];

  if (d.people.length === 0) {
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: "✅ *Mês sem ausências nem faltas registadas.* Nada a descontar.",
      },
    });
    return blocks;
  }

  const withAbsences = d.people.filter((p) => p.approvedBusinessDays > 0);
  const withFaltas = d.people.filter(
    (p) => p.faltaJustifiedDays > 0 || p.faltaUnjustifiedDays > 0,
  );

  blocks.push({ type: "divider" });

  blocks.push({
    type: "section",
    text: {
      type: "mrkdwn",
      text:
        `*🌴 Ausências aprovadas* — ${formatDayCount(d.totals.approvedBusinessDays)} úteis no total\n` +
        (withAbsences.length === 0
          ? "_Ninguém._"
          : withAbsences
              .map(
                (p) =>
                  `• *${p.name}* — ${formatDayCount(p.approvedBusinessDays)} úteis _(${reasonBreakdown(p.approvedByReason)})_`,
              )
              .join("\n")),
    },
  });

  blocks.push({
    type: "section",
    text: {
      type: "mrkdwn",
      text:
        `*⚠️ Faltas registadas* — ${formatDayCount(d.totals.faltaUnjustifiedDays)} úteis injustificados` +
        (d.totals.faltaJustifiedDays > 0
          ? ` · ${formatDayCount(d.totals.faltaJustifiedDays)} úteis justificados`
          : "") +
        "\n" +
        (withFaltas.length === 0
          ? "_Ninguém._"
          : withFaltas
              .map((p) => {
                const bits: string[] = [];
                if (p.faltaUnjustifiedDays > 0)
                  bits.push(`⚠️ ${formatDayCount(p.faltaUnjustifiedDays)} injustificados`);
                if (p.faltaJustifiedDays > 0)
                  bits.push(`📄 ${formatDayCount(p.faltaJustifiedDays)} justificados`);
                return `• *${p.name}* — ${bits.join(" · ")} _(${reasonBreakdown(p.faltaByReason)})_`;
              })
              .join("\n")),
    },
  });

  blocks.push({ type: "divider" });
  blocks.push({
    type: "context",
    elements: [
      {
        type: "mrkdwn",
        text:
          `A descontar fica ao critério da RH — o resumo separa justificadas de injustificadas, não decide por ninguém. ` +
          `Folhas completas em <https://wonder-ads-workspace.vercel.app/admin/ausencias|Ausências> e <https://wonder-ads-workspace.vercel.app/admin/faltas|Faltas>.`,
      },
    ],
  });

  return blocks;
}

/** Texto de fallback (notificações, clientes sem Block Kit). */
export function monthlyDigestText(d: MonthlyDigest): string {
  return (
    `Assiduidade ${d.label} (${HR_NAME}): ` +
    `${formatDayCount(d.totals.approvedBusinessDays)} úteis de ausência aprovada · ` +
    `${formatDayCount(d.totals.faltaUnjustifiedDays)} úteis de falta injustificada · ` +
    `${formatDayCount(d.totals.faltaJustifiedDays)} úteis de falta justificada.`
  );
}

/** Lê o KV, constrói e publica o resumo do mês pedido. Devolve o que foi
 *  enviado, para o chamador (cron ou botão do Control Suite) poder mostrar. */
export async function sendMonthlyDigest(
  year: number,
  month: number,
): Promise<{ digest: MonthlyDigest; delivered: boolean }> {
  const all = await listAbsences();
  const digest = buildMonthlyDigest(all, year, month);
  const delivered = await postAusenciasToSlack({
    text: monthlyDigestText(digest),
    blocks: monthlyDigestBlocks(digest),
  });
  return { digest, delivered };
}

export { HR_NAME, HR_SLACK_USER_ID, justifiedLabel };
