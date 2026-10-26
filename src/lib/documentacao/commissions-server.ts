// O tracking das comissões lê o COMMERCIAL DPT: cada proposta aceite é um
// fecho, com o valor, o tipo e o consultor que lá estão. Mudar o valor ou o
// tipo num cartão do Comercial muda a conta aqui — não há segunda cópia.

import "server-only";
import { listAllProposals } from "@/lib/proposals/store";
import { resolveProposalConsultant } from "@/lib/proposals/consultant";
import {
  COMMISSIONS_START,
  computeConsultantCommissions,
  type ConsultantCommissions,
  type DealInput,
} from "./commissions";

function lisbonISO(ms: number): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Lisbon" }).format(ms);
}

/** Uma linha por consultor com fechos desde o arranque, ordenada pelo
 *  acumulado. */
export async function buildCommissionsBoard(): Promise<ConsultantCommissions[]> {
  const proposals = await listAllProposals();
  const groups = new Map<string, { who: { username: string | null; name: string }; deals: DealInput[] }>();

  for (const p of proposals) {
    if (p.status !== "aceite") continue;
    const closedOn = p.decision?.at ? lisbonISO(p.decision.at) : p.date;
    if (closedOn < COMMISSIONS_START) continue;
    const c = resolveProposalConsultant({
      clientSlug: p.clientSlug,
      consultant: p.consultant,
      consultantUsername: p.consultantUsername,
    });
    const key = c.username ?? `name:${c.name.trim().toLowerCase()}`;
    const group = groups.get(key) ?? { who: { username: c.username, name: c.name }, deals: [] };
    group.deals.push({
      slug: p.slug,
      clientName: p.clientName,
      title: p.title,
      kind: p.kind,
      value: p.valueEur,
      estimated: p.valueEstimated,
      closedOn,
    });
    groups.set(key, group);
  }

  return Array.from(groups.values())
    .map((g) => computeConsultantCommissions(g.who, g.deals))
    .sort((a, b) => b.accumulated - a.accumulated || a.name.localeCompare(b.name, "pt"));
}
