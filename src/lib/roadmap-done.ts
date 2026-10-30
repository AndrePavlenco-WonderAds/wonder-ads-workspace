// As tarefas do roadmap já feitas, por consultor (v78.59) — para o
// levantamento do Producer of the Month (as do mês) e para a medalha
// «Entregas» (todas).
//
// Uma tarefa conta quando está «implemented»; a data é o `statusChangedAt`
// (a última mudança de estado). Lêem-se o roadmap atual e os arquivados de
// cada cliente SEO, sem repetir tarefas (o mesmo id passa de um roadmap para
// o seguinte quando se estende). O dono é o consultor de HOJE do cliente,
// resolvido como no Bónus NPS: a app não guarda o histórico de atribuições.
//
// Custo: 1 a 4 leituras de KV por cliente SEO. Quem chama decide a cache.

import "server-only";
import { getConsultantResolver } from "@/lib/consultant-assignments";
import { getSeoClients } from "@/lib/notion";
import { findEmployeeByName } from "@/lib/proposals/consultant";
import { getCurrentRoadmap, listArchivedRoadmaps } from "@/lib/roadmap-store";

/** username → o `statusChangedAt` (ms) de cada tarefa feita nos roadmaps dos
 *  clientes dele. Só para os usernames em `known`. */
export async function implementedTasksByOwner(known: ReadonlySet<string>): Promise<Map<string, number[]>> {
  const [clients, resolver] = await Promise.all([getSeoClients().catch(() => []), getConsultantResolver()]);
  const owned = clients
    .map((c) => ({ slug: c.slug, owner: findEmployeeByName(resolver.resolve(c.slug, c.consultant))?.username ?? null }))
    .filter((c): c is { slug: string; owner: string } => Boolean(c.owner && known.has(c.owner)));
  const out = new Map<string, number[]>();
  await Promise.all(
    owned.map(async ({ slug, owner }) => {
      try {
        const [current, archived] = await Promise.all([getCurrentRoadmap(slug), listArchivedRoadmaps(slug)]);
        const seen = new Set<string>();
        const times: number[] = [];
        for (const rm of [current, ...archived]) {
          for (const task of rm?.tasks ?? []) {
            if (task.status !== "implemented" || seen.has(task.id) || typeof task.statusChangedAt !== "number") continue;
            seen.add(task.id);
            times.push(task.statusChangedAt);
          }
        }
        if (times.length > 0) out.set(owner, [...(out.get(owner) ?? []), ...times]);
      } catch (err) {
        console.error("roadmap-done: leitura falhou:", slug, err instanceof Error ? err.message : err);
      }
    }),
  );
  return out;
}
