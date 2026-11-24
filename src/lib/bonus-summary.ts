// O resumo de fim de mês dos bónus (v80.37) — tudo o que há a atribuir no mês
// que fechou, para o canal dos bónus no Slack.
//
// Junta as contas que a app já faz nas páginas da Documentação (as mesmas
// funções, nunca uma segunda versão das regras):
//   • Bónus NPS do mês — individual + equipa, por consultor (nps-bonus);
//   • Comissões dos fechos do mês — renovações e cross-sells/upsells aceites
//     no COMMERCIAL DPT nesse mês (commissions-server);
//   • Bónus semestral — só em junho e dezembro, os meses em que se avalia.
//
// Sai no dia 1 de cada mês (cron) sobre o mês anterior; um SuperAdmin pode
// pré-visualizar ou reenviar qualquer mês (/api/cron/bonus-summary).

import "server-only";
import { APP_URL } from "@/lib/app-url";
import { lisbonMonthKey, shiftMonthKey } from "@/lib/dates";
import { postBonusToSlack } from "@/lib/slack";
import { buildNpsBonusMonth } from "@/lib/documentacao/nps-bonus-server";
import { formatAvg, monthLabel, type NpsBonusMonth } from "@/lib/documentacao/nps-bonus";
import { buildCommissionsBoard } from "@/lib/documentacao/commissions-server";
import { formatEurCents, formatRate, type DealLine } from "@/lib/documentacao/commissions";
import { buildSemesterBoard, type SemesterBoard } from "@/lib/documentacao/semestral-bonus-server";

export type BonusPerson = {
  key: string;
  name: string;
  npsIndividual: number;
  npsTeam: number;
  commissions: number;
  semestral: number;
  total: number;
};

export type BonusSummary = {
  month: string;
  label: string;
  nps: NpsBonusMonth;
  deals: Array<{ name: string; lines: DealLine[]; total: number }>;
  semester: SemesterBoard | null;
  people: BonusPerson[];
  total: number;
};

/** O mês que fechou, na hora de Lisboa. */
export function previousMonthKey(now: Date = new Date()): string {
  return shiftMonthKey(lisbonMonthKey(now.getTime()), -1);
}

function lastDayISO(month: string): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return `${month}-${String(d).padStart(2, "0")}`;
}

export async function buildBonusSummary(month: string): Promise<BonusSummary> {
  const evaluatesSemester = month.endsWith("-06") || month.endsWith("-12");
  const [nps, board, semester] = await Promise.all([
    buildNpsBonusMonth(month),
    buildCommissionsBoard(),
    evaluatesSemester
      ? buildSemesterBoard({ username: "", all: true, todayISO: lastDayISO(month) })
      : Promise.resolve(null),
  ]);

  const people = new Map<string, BonusPerson>();
  const person = (username: string | null, name: string): BonusPerson => {
    const key = username ?? `name:${name.trim().toLowerCase()}`;
    const found = people.get(key);
    if (found) return found;
    const fresh: BonusPerson = { key, name, npsIndividual: 0, npsTeam: 0, commissions: 0, semestral: 0, total: 0 };
    people.set(key, fresh);
    return fresh;
  };

  for (const c of nps.consultants) {
    const p = person(c.username, c.name);
    p.npsIndividual = c.individual.eur;
    p.npsTeam = c.team.eur;
  }

  const deals: BonusSummary["deals"] = [];
  for (const row of board) {
    const lines = row.deals.filter((d) => d.closedOn.slice(0, 7) === month);
    if (lines.length === 0) continue;
    const total = lines.reduce((n, l) => n + l.commission, 0);
    deals.push({ name: row.name, lines: [...lines].reverse(), total });
    person(row.username, row.name).commissions = total;
  }

  if (semester) {
    for (const r of semester.rows) person(r.username, r.name).semestral = r.tier.eur;
  }

  const list = Array.from(people.values()).map((p) => ({
    ...p,
    total: p.npsIndividual + p.npsTeam + p.commissions + p.semestral,
  }));
  list.sort((a, b) => b.total - a.total || a.name.localeCompare(b.name, "pt"));

  return {
    month,
    label: monthLabel(month),
    nps,
    deals,
    semester,
    people: list,
    total: list.reduce((n, p) => n + p.total, 0),
  };
}

/* ------------------------------------------------------------------ */
/*  Slack                                                              */
/* ------------------------------------------------------------------ */

function eur(n: number): string {
  return Number.isInteger(n) ? `${n.toLocaleString("de-DE")} €` : formatEurCents(n);
}

function pct(n: number | null): string {
  return n === null ? "—" : `${Math.round(n * 100)}%`;
}

/** Secções de texto com ≤ 2900 caracteres cada (o Slack corta nas 3000). */
function sections(title: string, lines: string[]): unknown[] {
  const out: unknown[] = [];
  let buf = title;
  for (const line of lines) {
    if (buf.length + line.length + 1 > 2900) {
      out.push({ type: "section", text: { type: "mrkdwn", text: buf } });
      buf = line;
    } else {
      buf += `\n${line}`;
    }
  }
  out.push({ type: "section", text: { type: "mrkdwn", text: buf } });
  return out;
}

export function bonusSlackPayload(s: BonusSummary): { text: string; blocks: unknown[] } {
  const { nps } = s;
  const blocks: unknown[] = [
    { type: "header", text: { type: "plain_text", text: `💰 Bónus a atribuir — ${s.label}`, emoji: true } },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*Total do mês: ${eur(s.total)}*\nBónus NPS ${eur(nps.totalEur)} · Comissões dos fechos ${eur(
          s.deals.reduce((n, d) => n + d.total, 0),
        )}${s.semester ? ` · Bónus semestral ${eur(s.semester.rows.reduce((n, r) => n + r.tier.eur, 0))}` : ""}`,
      },
    },
    { type: "divider" },
  ];

  // Por pessoa.
  const paid = s.people.filter((p) => p.total > 0);
  const none = s.people.filter((p) => p.total === 0);
  blocks.push(
    ...sections(
      "*👥 Por pessoa*",
      paid.length === 0
        ? ["Ninguém tem bónus a receber este mês."]
        : paid.map((p) => {
            const parts = [
              p.npsIndividual ? `NPS individual ${eur(p.npsIndividual)}` : "",
              p.npsTeam ? `NPS equipa ${eur(p.npsTeam)}` : "",
              p.commissions ? `comissões ${eur(p.commissions)}` : "",
              p.semestral ? `semestral ${eur(p.semestral)}` : "",
            ].filter(Boolean);
            return `• *${p.name}* — *${eur(p.total)}*  (${parts.join(" + ")})`;
          }),
    ),
  );
  if (none.length > 0) {
    blocks.push({ type: "context", elements: [{ type: "mrkdwn", text: `Sem bónus este mês: ${none.map((p) => p.name).join(", ")}.` }] });
  }
  blocks.push({ type: "divider" });

  // Bónus NPS.
  const teamLine = nps.teamTier
    ? `Equipa: média ${formatAvg(nps.teamAverage)} · ${nps.teamResponses}/${nps.teamProjects} respostas (${pct(nps.teamFillRate)}) → *${eur(nps.teamTier.eur)}* de bónus de equipa a cada consultor elegível.`
    : `Equipa: média ${formatAvg(nps.teamAverage)} · ${nps.teamResponses}/${nps.teamProjects} respostas (${pct(nps.teamFillRate)}) → sem bónus de equipa${
        nps.teamFillOk ? " (média abaixo de 8,5)" : " (abaixo de 50% de respostas)"
      }.`;
  blocks.push(
    ...sections(
      `*⭐ Bónus NPS — ${s.label}*\n${teamLine}`,
      nps.consultants.map((c) => {
        const ind = c.individual.eur ? eur(c.individual.eur) : `0 €${c.individual.reason ? ` (${c.individual.reason})` : ""}`;
        const team = c.team.eur ? eur(c.team.eur) : `0 €${c.team.reason ? ` (${c.team.reason})` : ""}`;
        return `• *${c.name}* — média ${formatAvg(c.average)} · ${c.filled}/${c.projects.length} respostas (${pct(c.fillRate)}) → individual ${ind} · equipa ${team}`;
      }),
    ),
  );
  if (nps.newClients.length > 0) {
    blocks.push({
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text: `Fora da taxa de preenchimento (arrancaram este mês e não responderam): ${nps.newClients.map((n) => `${n.name} (${n.consultant})`).join(", ")}.`,
        },
      ],
    });
  }
  blocks.push({ type: "divider" });

  // Comissões.
  const dealLines: string[] = [];
  for (const d of s.deals) {
    dealLines.push(`• *${d.name}* — *${formatEurCents(d.total)}*`);
    for (const l of d.lines) {
      const kind = l.kind === "renovacao" ? "Renovação" : "Cross-sell / upsell";
      dealLines.push(
        l.value === null
          ? `      ↳ ${l.clientName} · ${kind} · ⚠️ sem valor no cartão do Comercial`
          : `      ↳ ${l.clientName} · ${kind} · ${formatEurCents(l.value)} × ${formatRate(l.rate)} = ${formatEurCents(l.commission)}${l.estimated ? " (valor estimado)" : ""}`,
      );
    }
  }
  blocks.push(...sections(`*💼 Comissões — fechos de ${s.label}*`, dealLines.length ? dealLines : ["Nenhum fecho aceite neste mês."]));
  blocks.push({
    type: "context",
    elements: [
      {
        type: "mrkdwn",
        text: "Pagam-se depois dos 30 dias de reembolso, ao ritmo a que o cliente paga: PIF de uma vez; mensal, a parte de cada mensalidade paga.",
      },
    ],
  });

  // Bónus semestral.
  if (s.semester) {
    blocks.push({ type: "divider" });
    blocks.push(
      ...sections(
        `*🎯 Bónus semestral — ${s.semester.semester.label}*`,
        s.semester.rows.map((r) => `• *${r.name}* — ${r.no} NO · ${r.pa} PA → *${eur(r.tier.eur)}*`),
      ),
    );
  }

  blocks.push({ type: "divider" });
  blocks.push({
    type: "actions",
    elements: [
      { type: "button", text: { type: "plain_text", text: "Bónus NPS" }, url: `${APP_URL}/documentacao/bonus-nps` },
      { type: "button", text: { type: "plain_text", text: "Comissões" }, url: `${APP_URL}/documentacao/comissoes` },
      ...(s.semester
        ? [{ type: "button", text: { type: "plain_text", text: "Bónus semestral" }, url: `${APP_URL}/documentacao/bonus-semestral` }]
        : []),
    ],
  });
  blocks.push({
    type: "context",
    elements: [{ type: "mrkdwn", text: "Calculado pela app com as regras da Documentação. Confirma antes de processar os pagamentos." }],
  });

  return { text: `💰 Bónus a atribuir — ${s.label}: ${eur(s.total)}`, blocks: blocks.slice(0, 50) };
}

export async function sendBonusSummary(month: string): Promise<{ summary: BonusSummary; delivered: boolean }> {
  const summary = await buildBonusSummary(month);
  const delivered = await postBonusToSlack(bonusSlackPayload(summary));
  return { summary, delivered };
}
