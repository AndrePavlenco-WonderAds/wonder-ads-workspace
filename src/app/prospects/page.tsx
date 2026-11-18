// /prospects — todas as Fichas do prospect (v80.0).
//
// Uma ficha por cliente que entrou pelo onboarding do C-Suite (e por qualquer
// ficha já gravada). Privada à workspace, aberta a toda a gente com sessão —
// os comerciais chegam aqui pelo menu do nome ou pelo SEO DPT.

import { redirect } from "next/navigation";
import { PageShell } from "@/components/page-shell";
import { LogoChip } from "@/components/logo-chip";
import { ProspectsIndex, type ProspectIndexItem } from "@/components/prospects/prospects-index";
import { getCurrentSession } from "@/lib/auth/server";
import { effectiveUsername } from "@/lib/auth/session";
import { findEmployeeByUsername } from "@/lib/auth/credentials";
import { canWriteProspects, prospectPeople } from "@/lib/prospects/access";
import { onboardingEntries, resolveProspectContexts } from "@/lib/prospects/context";
import { getProspectReadsMany, listProspectFiles } from "@/lib/prospects/store";
import { prospectCompleteness } from "@/lib/prospects/shared";
import { servicesLabel } from "@/lib/onboarding-tracks";
import { getLogoOverrides } from "@/lib/admin-client-logos-store";
import { getClientLogo, getLogoBgMode, getLogoSizing } from "@/lib/client-meta";
import { getClientPalette, paletteToGradient } from "@/lib/client-colors";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Fichas do prospect — Wonder Ads Workspace",
  robots: { index: false, follow: false },
};

export default async function ProspectsPage() {
  const session = await getCurrentSession();
  const username = effectiveUsername(session);
  const row = username ? findEmployeeByUsername(username) : null;
  if (!username || !row) redirect("/login?next=%2Fprospects");

  const [files, onboarding, logos] = await Promise.all([
    listProspectFiles(),
    onboardingEntries().catch(() => []),
    getLogoOverrides().catch(() => ({}) as Record<string, string>),
  ]);
  const bySlug = new Map(files.map((f) => [f.slug, f]));
  const entries = [
    ...files.map((f) => ({ slug: f.slug, title: f.title })),
    ...onboarding.filter((o) => !bySlug.has(o.slug)),
  ];
  const [ctxs, reads] = await Promise.all([
    resolveProspectContexts(entries),
    getProspectReadsMany(entries.map((e) => e.slug)),
  ]);
  const people = new Map(prospectPeople().map((p) => [p.username, p]));

  const items: ProspectIndexItem[] = [];
  for (const e of entries) {
    const ctx = ctxs.get(e.slug);
    if (!ctx) continue;
    const file = bySlug.get(e.slug) ?? null;
    const pct = file ? prospectCompleteness(file).pct : 0;
    const owner = file?.owner ? people.get(file.owner) ?? null : null;
    const consultant = ctx.consultantUsername ? people.get(ctx.consultantUsername) ?? null : null;
    const myRead = reads[e.slug]?.[username] ?? 0;
    const consultantRead = ctx.consultantUsername ? reads[e.slug]?.[ctx.consultantUsername] ?? null : null;
    items.push({
      slug: e.slug,
      title: ctx.title,
      stage: ctx.stage,
      consultant: ctx.consultant,
      consultantAvatar: consultant?.avatar ?? null,
      consultantRead: consultantRead !== null,
      ownerName: owner?.name ?? null,
      ownerAvatar: owner?.avatar ?? null,
      services: ctx.services.length ? servicesLabel(ctx.services) : "",
      pct,
      notes: file?.notes.length ?? 0,
      opportunities: file?.opportunities.length ?? 0,
      updatedAt: file && file.updatedBy ? file.updatedAt : file?.createdAt ?? ctx.onboarding?.createdAt ?? 0,
      updatedByName: file?.updatedBy ? people.get(file.updatedBy)?.name ?? file.updatedBy : null,
      summary: file?.summary.trim().slice(0, 220) ?? "",
      // «Nova para ti»: és o consultor do cliente e há coisas que não leste.
      forMe: Boolean(
        file &&
          ctx.consultantUsername === username &&
          file.updatedBy &&
          file.updatedAt > myRead &&
          file.updatedBy !== username,
      ),
      logo: (
        <LogoChip
          logo={logos[e.slug] ?? getClientLogo(e.slug)}
          emoji={ctx.icon ?? "🚀"}
          alt={`${ctx.title} logo`}
          gradient={paletteToGradient(getClientPalette(e.slug))}
          size="md"
          bgMode={getLogoBgMode(e.slug)}
          sizing={getLogoSizing(e.slug)}
        />
      ),
    });
  }
  items.sort((a, b) => Number(b.forMe) - Number(a.forMe) || b.updatedAt - a.updatedAt);

  return (
    <PageShell backHref="/" backLabel="Workspace">
      <ProspectsIndex items={items} canWrite={canWriteProspects(row)} renderedAt={Date.now()} />
    </PageShell>
  );
}
