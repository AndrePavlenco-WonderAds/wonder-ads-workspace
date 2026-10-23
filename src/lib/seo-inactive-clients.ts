// Clientes SEO que já não recebem trabalho de consultor: pausados/suspensos
// no SEO DPT, cancelados no roster financeiro, ou com a ficha admin de SEO
// em «paused»/«offboarded».
//
// Existe porque cada vista que lê a carteira estava a decidir sozinha o que
// é «ativo» — o /seo tirava os pausados, o Weekly Reports não tirava nada e
// um contrato suspenso continuava a pedir mensagem de WhatsApp todas as
// semanas (v78.1). Quem precisar da carteira ATIVA de um consultor filtra
// por aqui.
//
// Custo: três leituras KV em paralelo, uma delas um mget com as fichas de
// todos os clientes de uma vez — nunca um get por cliente. Cada fonte que
// falhe conta como vazia: KV em baixo esconde menos, não mais.

import "server-only";
import { kv } from "@vercel/kv";
import { getPausedSlugSet } from "@/lib/admin-paused-clients-store";
import { getRemovedSlugSet } from "@/lib/admin-removed-clients-store";
import type { ClientStatus } from "@/lib/admin-clients-store";

const INACTIVE_STATUSES: ReadonlySet<ClientStatus> = new Set([
  "paused",
  "offboarded",
]);

/** Slugs (de entre `slugs`) cuja ficha admin de SEO diz pausado/terminado.
 *  Lê a chave por departamento e, na falta dela, a chave antiga de linha
 *  única — a mesma ordem de `getAdminRecord`. */
async function adminInactiveSlugs(slugs: string[]): Promise<Set<string>> {
  const out = new Set<string>();
  if (slugs.length === 0) return out;
  if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) return out;
  const keys = slugs.flatMap((s) => [`admin-client:${s}:seo`, `admin-client:${s}`]);
  let values: unknown[];
  try {
    values = await kv.mget<unknown[]>(...keys);
  } catch (err) {
    console.error("seo-inactive-clients: mget das fichas admin falhou:", err);
    return out;
  }
  slugs.forEach((slug, i) => {
    const rec = (values[i * 2] ?? values[i * 2 + 1]) as { status?: unknown } | null;
    const status = rec && typeof rec === "object" ? rec.status : undefined;
    if (typeof status === "string" && INACTIVE_STATUSES.has(status as ClientStatus)) {
      out.add(slug);
    }
  });
  return out;
}

/** Os slugs, de entre `slugs`, que estão pausados ou terminados. */
export async function getInactiveSeoSlugSet(slugs: string[]): Promise<Set<string>> {
  const [paused, removed, admin] = await Promise.all([
    getPausedSlugSet().catch(() => new Set<string>()),
    getRemovedSlugSet().catch(() => new Set<string>()),
    adminInactiveSlugs(slugs),
  ]);
  return new Set(slugs.filter((s) => paused.has(s) || removed.has(s) || admin.has(s)));
}
