// Producer of the Month — o levantamento de um mês fechado (v78.58). Só a
// página da direção e a rota da eleição chamam isto.
//
// Fontes (todas as que já existem — não há segunda cópia de nada):
//   • NPS: buildNpsBonusMonth — a carteira de HOJE e as respostas do mês;
//   • roadmaps: as tarefas «implemented» dos clientes de cada um cujo
//     statusChangedAt cai no mês (lib/roadmap-done.ts);
//   • propostas: as aceites no mês (decisão, ou a data da proposta), com o
//     consultor como nas comissões;
//   • ineficácias: as ocorrências pontuadas (> 0) com data no mês.
//
// Custo: ~1 a 4 leituras por cliente SEO (roadmaps), mais as do NPS, das
// propostas e das ineficácias da equipa. É uma página de direção, sem cache.

import "server-only";
import { lisbonMonthKey } from "@/lib/dates";
import { buildNpsBonusMonth } from "@/lib/documentacao/nps-bonus-server";
import { seoConsultants } from "@/lib/documentacao/people";
import { counts } from "@/lib/ineficacias/shared";
import { loadTeam } from "@/lib/ineficacias/store";
import { todayLisbonISO } from "@/lib/probation/progress";
import { resolveProposalConsultant } from "@/lib/proposals/consultant";
import { listAllProposals } from "@/lib/proposals/store";
import { implementedTasksByOwner } from "@/lib/roadmap-done";
import { scoreRow, sortRows, type ProducerRow } from "./shared";

function lisbonISO(ms: number): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Lisbon" }).format(ms);
}

/** Tarefas do roadmap concluídas no mês, por username do dono do cliente. */
async function blocksByOwner(month: string, known: Set<string>): Promise<Map<string, number>> {
  const done = await implementedTasksByOwner(known);
  const out = new Map<string, number>();
  for (const [owner, times] of done) {
    const n = times.filter((t) => lisbonMonthKey(t) === month).length;
    if (n > 0) out.set(owner, n);
  }
  return out;
}

/** O levantamento de `month`, uma linha por consultor SEO, ordenado pela
 *  pontuação de referência. */
export async function buildProducerSurvey(month: string): Promise<ProducerRow[]> {
  const people = seoConsultants();
  const known = new Set(people.map((p) => p.username));
  const [nps, proposals, team, blocks] = await Promise.all([
    buildNpsBonusMonth(month),
    listAllProposals(),
    loadTeam(
      people.map((p) => p.username),
      todayLisbonISO(),
    ),
    blocksByOwner(month, known),
  ]);

  const deals = new Map<string, { cross: { count: number; eur: number }; renew: { count: number; eur: number } }>();
  for (const p of proposals) {
    if (p.status !== "aceite") continue;
    const closedOn = p.decision?.at ? lisbonISO(p.decision.at) : p.date;
    if (!closedOn.startsWith(month)) continue;
    const who = resolveProposalConsultant({
      clientSlug: p.clientSlug,
      consultant: p.consultant,
      consultantUsername: p.consultantUsername,
    }).username;
    if (!who || !known.has(who)) continue;
    const d = deals.get(who) ?? { cross: { count: 0, eur: 0 }, renew: { count: 0, eur: 0 } };
    const bucket = p.kind === "renovacao" ? d.renew : d.cross;
    bucket.count += 1;
    bucket.eur += p.valueEur ?? 0;
    deals.set(who, d);
  }

  const rows = people.map((person) => {
    const n = nps.consultants.find((c) => c.username === person.username);
    const occ = (team.get(person.username)?.occurrences ?? []).filter((o) => counts(o) && o.occurredOn.startsWith(month));
    const d = deals.get(person.username);
    return scoreRow({
      username: person.username,
      name: person.name,
      avatar: person.avatar,
      nps: { average: n?.average ?? null, answered: n?.filled ?? 0, projects: n?.projects.length ?? 0 },
      blocks: blocks.get(person.username) ?? 0,
      crossSells: d?.cross ?? { count: 0, eur: 0 },
      renewals: d?.renew ?? { count: 0, eur: 0 },
      ineficacias: { no: occ.length, pa: occ.reduce((s, o) => s + (o.score?.points ?? 0), 0) },
    });
  });
  return sortRows(rows);
}
