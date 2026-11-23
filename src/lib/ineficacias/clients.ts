// Os clientes que o consultor pode escolher no campo «Cliente ou projeto» da
// folha RH-03 (v77.91). Desde a v80.26 só a carteira dele: o consultor
// reporta os erros nos seus projetos ou num problema interno («Interno», que
// vive no próprio picker). Sem clientes de colegas nem texto livre.
//
// Fontes: a carteira SEO (Notion, re-resolvida pelo slug com as migrações
// do SuperAdmin) e os rosters em código de ADS e Web. Os clientes
// cancelados (removidos do roster financeiro) ficam de fora.

import "server-only";
import { getSeoClients } from "@/lib/notion";
import { ADS_CLIENTS } from "@/lib/ads-clients";
import { WEB_CLIENTS } from "@/lib/web-clients";
import { getConsultantResolver } from "@/lib/consultant-assignments";
import { getRemovedSlugSet } from "@/lib/admin-removed-clients-store";
import type { ClientChoice, ClientChoices } from "@/lib/ineficacias/shared";

export async function clientChoicesFor(consultantName: string): Promise<ClientChoices> {
  const [seo, removed, resolver] = await Promise.all([
    getSeoClients().catch((err) => {
      console.error("Ineficácias: getSeoClients falhou:", err);
      return [];
    }),
    getRemovedSlugSet().catch(() => new Set<string>()),
    getConsultantResolver().catch(() => null),
  ]);

  const bySlug = new Map<string, ClientChoice>();
  function add(c: { slug: string; title: string; icon: string | null }, dept: string) {
    if (removed.has(c.slug) || !c.title?.trim()) return;
    const existing = bySlug.get(c.slug);
    if (existing) {
      if (!existing.depts.includes(dept)) existing.depts.push(dept);
      return;
    }
    bySlug.set(c.slug, { slug: c.slug, title: c.title.trim(), icon: shortIcon(c.icon), depts: [dept] });
  }

  for (const c of seo) {
    const owner = resolver ? resolver.resolve(c.slug, c.consultant) : c.consultant;
    if (owner === consultantName) add(c, "SEO");
  }
  for (const c of ADS_CLIENTS) if (c.consultant === consultantName) add(c, "ADS");
  for (const c of WEB_CLIENTS) if (c.consultant === consultantName) add(c, "Web");

  return { mine: [...bySlug.values()].sort((a, b) => a.title.localeCompare(b.title, "pt")) };
}

/** Só emojis curtos servem de ícone — um URL de imagem da Notion não. */
function shortIcon(icon: string | null | undefined): string | null {
  if (!icon) return null;
  const t = icon.trim();
  return t && t.length <= 4 && !t.includes("/") ? t : null;
}
