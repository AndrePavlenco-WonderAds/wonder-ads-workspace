// Os clientes do painel «IA no site»: a carteira SEO ativa (sem pausados,
// suspensos nem saídos) + a própria WonderAds (o piloto). Servidor apenas.

import "server-only";
import { getSeoClients } from "@/lib/notion";
import { getPausedSlugSet } from "@/lib/admin-paused-clients-store";
import { getAdminRecord } from "@/lib/admin-clients-store";
import { getClientWebsite } from "@/lib/client-meta";
import { getReportConfig } from "./report-config-store";
import type { FleetClient } from "./ai-fleet";

/** A CDT fica de fora (pedido do André, 10/11/2026). */
const EXCLUDED = new Set(["cdt"]);

export async function getFleetClients(): Promise<FleetClient[]> {
  const [seo, paused] = await Promise.all([getSeoClients().catch(() => []), getPausedSlugSet()]);
  const base = new Map<string, string>(seo.map((c) => [c.slug, c.title]));
  if (!base.has("wonderads")) base.set("wonderads", "WonderAds");

  const rows = await Promise.all(
    [...base].map(async ([slug, title]) => {
      if (EXCLUDED.has(slug) || paused.has(slug)) return null;
      const [rec, cfg] = await Promise.all([
        slug === "wonderads" ? null : getAdminRecord(slug, "SEO").catch(() => null),
        getReportConfig(slug).catch(() => null),
      ]);
      if (rec && (rec.status === "paused" || rec.status === "offboarded")) return null;
      const site = getClientWebsite(slug) ?? cfg?.aiVisibilitySite ?? null;
      return {
        slug,
        title,
        site,
        pluginSite: cfg?.aiVisibilitySite ?? null,
        pluginKey: cfg?.aiVisibilityKey ?? null,
      } satisfies FleetClient;
    }),
  );
  return rows
    .filter((r): r is FleetClient => r !== null)
    .sort((a, b) => a.title.localeCompare(b.title, "pt"));
}
