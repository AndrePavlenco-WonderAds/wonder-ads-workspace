// A «ficha automática» de um projeto na passagem (v80.39): o que a app já
// sabe e quem sai não precisa de escrever — o plano, a data de arranque, o
// último NPS, quantos acessos há no cofre e a língua do cliente.

import "server-only";
import { listClientAccesses } from "@/lib/client-accesses-store";
import { TIER_LABEL, getClientTier } from "@/lib/client-tiers";
import { getNpsRecordsFor } from "@/lib/nps-store";
import { getSeoStartDates } from "@/lib/seo-start-dates";
import { reportLangFor } from "@/lib/weekly-report-format";

export type ProjectFacts = {
  tier: string | null;
  startedAt: string | null;
  lastNps: { score: number; at: number } | null;
  vaultCount: number;
  lang: "pt" | "en";
};

export async function projectFacts(slug: string): Promise<ProjectFacts> {
  const [starts, nps, vault] = await Promise.all([
    getSeoStartDates().catch((): Record<string, string | null> => ({})),
    getNpsRecordsFor([slug]).catch(() => ({}) as Awaited<ReturnType<typeof getNpsRecordsFor>>),
    listClientAccesses(slug).catch(() => []),
  ]);
  const tier = getClientTier(slug);
  const latest = nps[slug]?.submissions?.[0] ?? null;
  return {
    tier: tier ? TIER_LABEL[tier] : null,
    startedAt: starts[slug] ?? null,
    lastNps: latest ? { score: latest.scores.overall, at: latest.submittedAt } : null,
    vaultCount: vault.length,
    lang: reportLangFor(slug),
  };
}
