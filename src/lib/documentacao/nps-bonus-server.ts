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
  NPS_BONUS_EXCLUDED_SLUGS,
  computeNpsBonusMonth,
  lisbonMonthKey,
  type ConsultantInput,
  type NpsBonusMonth,
} from "./nps-bonus";

type Portfolio = {
  /** Clientes SEO ativos já com o dono resolvido (sem pausados nem a WonderAds). */
  owned: Array<{ slug: string; title: string; owner: string }>;
  records: Awaited<ReturnType<typeof getNpsRecordsFor>>;
  consultants: ReturnType<typeof seoConsultants>;
};

/** Uma leitura para tudo: a carteira de hoje e o NPS de todos os clientes. */
async function loadPortfolio(): Promise<Portfolio> {
  const [clients, resolver] = await Promise.all([
    getSeoClients().catch(() => []),
    getConsultantResolver(),
  ]);
  const inactive = await getInactiveSeoSlugSet(clients.map((c) => c.slug));
  // A WonderAds é a própria agência, não um cliente: não conta.
  const active = clients.filter((c) => !inactive.has(c.slug) && !NPS_BONUS_EXCLUDED_SLUGS.has(c.slug));
  const records = await getNpsRecordsFor(active.map((c) => c.slug));
  const consultants = seoConsultants();
  const known = new Set(consultants.map((c) => c.username));
  const owned: Portfolio["owned"] = [];
  for (const client of active) {
    const owner = findEmployeeByName(resolver.resolve(client.slug, client.consultant));
    if (owner && known.has(owner.username)) owned.push({ slug: client.slug, title: client.title, owner: owner.username });
  }
  return { owned, records, consultants };
}

function monthFrom(p: Portfolio, month: string): NpsBonusMonth {
  const byUser = new Map<string, ConsultantInput>(p.consultants.map((c) => [c.username, { ...c, projects: [] }]));
  for (const client of p.owned) {
    // Submissões guardadas da mais recente para a mais antiga: a primeira
    // do mês é a última resposta desse mês.
    const answer = (p.records[client.slug]?.submissions ?? []).find((s) => lisbonMonthKey(s.submittedAt) === month);
    byUser.get(client.owner)?.projects.push({
      slug: client.slug,
      name: client.title,
      score: answer ? answer.scores.overall : null,
      answeredAt: answer ? answer.submittedAt : null,
    });
  }
  for (const row of byUser.values()) {
    row.projects.sort((a, b) => a.name.localeCompare(b.name, "pt"));
  }
  return computeNpsBonusMonth(month, Array.from(byUser.values()));
}

export async function buildNpsBonusMonth(month: string): Promise<NpsBonusMonth> {
  return monthFrom(await loadPortfolio(), month);
}

/** Vários meses com uma só leitura (o chip do SEO DPT lê dois). */
export async function buildNpsBonusMonths(months: string[]): Promise<NpsBonusMonth[]> {
  const p = await loadPortfolio();
  return months.map((m) => monthFrom(p, m));
}
