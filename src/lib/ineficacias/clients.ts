// Os clientes que o consultor pode escolher no campo «Cliente ou projeto» da
// folha RH-03 (v77.91): a carteira dele primeiro, depois todos os outros
// clientes da agência — um erro pode acontecer num cliente de um colega
// (substituição, apoio). «Interno» e o texto livre vivem no próprio picker.
//
// Fontes: a carteira SEO (Notion, re-resolvida pelo slug com as migrações
// do SuperAdmin), os rosters em código de ADS e Web, e os clientes que a
// direção acrescentou à mão no /admin/projects. Os clientes cancelados
// (removidos do roster financeiro) ficam de fora.

import "server-only";
import { getSeoClients } from "@/lib/notion";
import { ADS_CLIENTS } from "@/lib/ads-clients";
import { WEB_CLIENTS } from "@/lib/web-clients";
import { getConsultantResolver } from "@/lib/consultant-assignments";
import { getExtraClients } from "@/lib/admin-extra-clients-store";
import { getRemovedSlugSet } from "@/lib/admin-removed-clients-store";
import type { ClientChoice, ClientChoices } from "@/lib/ineficacias/shared";

export async function clientChoicesFor(consultantName: string): Promise<ClientChoices> {
  const [seo, extras, removed, resolver] = await Promise.all([
    getSeoClients().catch((err) => {
      console.error("Ineficácias: getSeoClients falhou:", err);
      return [];
    }),
    getExtraClients().catch(() => []),
    getRemovedSlugSet().catch(() => new Set<string>()),
    getConsultantResolver().catch(() => null),
  ]);

  const bySlug = new Map<string, ClientChoice & { mine: boolean }>();
  function add(c: { slug: string; title: string; icon: string | null }, dept: string, mine: boolean) {
    if (removed.has(c.slug) || !c.title?.trim()) return;
    const existing = bySlug.get(c.slug);
    if (existing) {
      if (!existing.depts.includes(dept)) existing.depts.push(dept);
      existing.mine ||= mine;
      return;
    }
    bySlug.set(c.slug, { slug: c.slug, title: c.title.trim(), icon: shortIcon(c.icon), depts: [dept], mine });
  }

  for (const c of seo) {
    const owner = resolver ? resolver.resolve(c.slug, c.consultant) : c.consultant;
    add(c, "SEO", owner === consultantName);
  }
  for (const c of ADS_CLIENTS) add(c, "ADS", c.consultant === consultantName);
  for (const c of WEB_CLIENTS) add(c, "Web", c.consultant === consultantName);
  for (const c of extras) add(c, c.departments[0] ?? "Cliente", false);

  const all = [...bySlug.values()].sort((a, b) => a.title.localeCompare(b.title, "pt"));
  const strip = (c: ClientChoice & { mine: boolean }): ClientChoice => ({ slug: c.slug, title: c.title, icon: c.icon, depts: c.depts });
  return {
    mine: all.filter((c) => c.mine).map(strip),
    others: all.filter((c) => !c.mine).map(strip),
  };
}

/** Só emojis curtos servem de ícone — um URL de imagem da Notion não. */
function shortIcon(icon: string | null | undefined): string | null {
  if (!icon) return null;
  const t = icon.trim();
  return t && t.length <= 4 && !t.includes("/") ? t : null;
}
