// O lado servidor do bónus NPS: junta a carteira ativa de cada consultor SEO
// com as respostas NPS do mês e entrega ao módulo puro.
//
// Custo: o roster do Notion (em cache), as atribuições, o filtro de
// pausados/terminados (3 leituras) e UM mget com o NPS de todos os clientes.
//
// A carteira é a de HOJE (ativos atribuídos agora): a app não guarda o
// histórico de atribuições por mês. Um cliente que mudou de consultor a meio
// do mês conta para quem o tem agora.

import "server-only";
import { getConsultantResolver } from "@/lib/consultant-assignments";
import { getSeoClients } from "@/lib/notion";
import { getNpsRecordsFor } from "@/lib/nps-store";
import { findEmployeeByName } from "@/lib/proposals/consultant";
import { getInactiveSeoSlugSet } from "@/lib/seo-inactive-clients";
import { seoConsultants } from "./people";
import {
  computeNpsBonusMonth,
  lisbonMonthKey,
  type ConsultantInput,
  type NpsBonusMonth,
} from "./nps-bonus";

export async function buildNpsBonusMonth(month: string): Promise<NpsBonusMonth> {
  const [clients, resolver] = await Promise.all([
    getSeoClients().catch(() => []),
    getConsultantResolver(),
  ]);
  const inactive = await getInactiveSeoSlugSet(clients.map((c) => c.slug));
  const active = clients.filter((c) => !inactive.has(c.slug));
  const records = await getNpsRecordsFor(active.map((c) => c.slug));

  const byUser = new Map<string, ConsultantInput>(
    seoConsultants().map((c) => [c.username, { ...c, projects: [] }]),
  );

  for (const client of active) {
    const owner = findEmployeeByName(resolver.resolve(client.slug, client.consultant));
    const row = owner ? byUser.get(owner.username) : undefined;
    if (!row) continue;
    // Submissões guardadas da mais recente para a mais antiga: a primeira
    // do mês é a última resposta desse mês.
    const answer = (records[client.slug]?.submissions ?? []).find(
      (s) => lisbonMonthKey(s.submittedAt) === month,
    );
    row.projects.push({
      slug: client.slug,
      name: client.title,
      score: answer ? answer.scores.overall : null,
    });
  }

  for (const row of byUser.values()) {
    row.projects.sort((a, b) => a.name.localeCompare(b.name, "pt"));
  }

  return computeNpsBonusMonth(month, Array.from(byUser.values()));
}
