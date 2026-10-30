// Os números das medalhas do SEO DPT (v78.59) — tudo o que não sai das
// propostas: NPS, comissões, ineficácias, blocos do roadmap e o Producer of
// the Month. Uma linha por consultor SEO.
//
// Fontes (as mesmas da Documentação, sem segunda cópia):
//   • NPS — o Bónus NPS de cada mês fechado desde set/2026: conta um mês
//     quando a pessoa cumpre as portas do bónus individual (3+ projetos, 50%
//     de respostas) e a média chega a 9 (ou a 10);
//   • comissões — o que já ganhou na escada de comissões;
//   • ineficácias — meses fechados, desde out/2026, sem nenhuma pontuada;
//   • roadmap — as tarefas feitas nos roadmaps dos clientes dela;
//   • Producer of the Month — as eleições da direção.
//
// É caro (o roadmap lê todos os clientes), por isso o header e a galeria
// leem a versão em cache (30 min, invalidada ao eleger o Producer). A
// sincronização das medalhas lê a versão fresca.

import "server-only";
import { unstable_cache } from "next/cache";
import { lisbonMonthKey, shiftMonthKey } from "@/lib/dates";
import { buildCommissionsBoard } from "@/lib/documentacao/commissions-server";
import { NPS_BONUS_FIRST_MONTH } from "@/lib/documentacao/nps-bonus";
import { buildNpsBonusMonths } from "@/lib/documentacao/nps-bonus-server";
import { seoConsultants } from "@/lib/documentacao/people";
import { counts } from "@/lib/ineficacias/shared";
import { loadTeam } from "@/lib/ineficacias/store";
import { todayLisbonISO } from "@/lib/probation/progress";
import { PRODUCER_CACHE_TAG, listElections } from "@/lib/producer/store";
import { implementedTasksByOwner } from "@/lib/roadmap-done";
import type { MedalFacts } from "./catalog";

/** A partir de quando os meses sem ineficácias contam (o módulo abriu à
 *  equipa em outubro de 2026). */
export const RIGOR_FIRST_MONTH = "2026-10";

export type MedalFactsBook = {
  byUser: Record<string, MedalFacts>;
  /** O nome do Producer of the Month mais recente (para a galeria). */
  producerName: string | null;
};

/** Os meses fechados de `first` até ao mês passado. */
function closedMonths(first: string, currentMonth: string): string[] {
  const out: string[] = [];
  for (let m = first; m < currentMonth; m = shiftMonthKey(m, 1)) out.push(m);
  return out;
}

/** Calcula tudo, sem cache. Lança se uma fonte falhar — quem chama decide. */
export async function computeMedalFacts(): Promise<MedalFactsBook> {
  const people = seoConsultants();
  const usernames = people.map((p) => p.username);
  const known = new Set(usernames);
  const current = lisbonMonthKey(Date.now());
  const npsMonths = closedMonths(NPS_BONUS_FIRST_MONTH, current);
  const rigorMonths = closedMonths(RIGOR_FIRST_MONTH, current);

  const [nps, commissions, team, done, elections] = await Promise.all([
    npsMonths.length ? buildNpsBonusMonths(npsMonths) : Promise.resolve([]),
    buildCommissionsBoard(),
    loadTeam(usernames, todayLisbonISO()),
    implementedTasksByOwner(known),
    listElections(),
  ]);

  const byUser: Record<string, MedalFacts> = {};
  for (const u of usernames) {
    const months = nps.map((m) => m.consultants.find((c) => c.username === u)).filter((c) => c?.individual.eligible);
    const scored = (team.get(u)?.occurrences ?? []).filter(counts);
    byUser[u] = {
      npsGoodMonths: months.filter((c) => (c?.average ?? 0) >= 9).length,
      npsPerfectMonths: months.filter((c) => (c?.average ?? 0) >= 10).length,
      commissionEur: commissions.find((c) => c.username === u)?.totalCommission ?? 0,
      cleanMonths: rigorMonths.filter((m) => !scored.some((o) => o.occurredOn.startsWith(m))).length,
      roadmapBlocks: done.get(u)?.length ?? 0,
      producerWins: elections.filter((e) => e.podium[0]?.username === u).length,
      producerNow: elections[0]?.podium[0]?.username === u,
    };
  }
  return { byUser, producerName: elections[0]?.podium[0]?.name ?? null };
}

const cached = unstable_cache(computeMedalFacts, ["medal-facts-v1"], {
  tags: ["medal-facts", PRODUCER_CACHE_TAG],
  revalidate: 1800,
});

/** A versão em cache, para o header e a galeria. null se alguma fonte
 *  falhar — a falha não fica em cache, e quem lê trata null como «sem
 *  números» (as medalhas destas famílias simplesmente não aparecem). */
export async function getMedalFacts(): Promise<MedalFactsBook | null> {
  try {
    return await cached();
  } catch (err) {
    console.error("medalhas: números do SEO DPT falharam:", err instanceof Error ? err.message : err);
    return null;
  }
}
