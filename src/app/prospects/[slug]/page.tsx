// /prospects/<slug> — a Ficha do prospect (v80.0).
//
// Privada à workspace: o middleware exige sessão e esta página volta a
// verificá-la ela própria (um portão de layout não é fronteira de segurança).
// Abre para toda a gente com sessão — também os comerciais e os perfis só de
// leitura; quem pode escrever decide-o `canWriteProspects`.
//
// Abrir a ficha regista «li» (depois da resposta, num hash à parte): é assim
// que o Comercial vê que o consultor já a leu, e o chip do SEO deixa de
// dizer «nova».

import { notFound, redirect } from "next/navigation";
import { after } from "next/server";
import { PageShell } from "@/components/page-shell";
import { LogoChip } from "@/components/logo-chip";
import { ProspectFileView } from "@/components/prospects/prospect-file-view";
import { getCurrentSession } from "@/lib/auth/server";
import { effectiveUsername, isImpersonating } from "@/lib/auth/session";
import { findEmployeeByUsername } from "@/lib/auth/credentials";
import { canWriteProspects, prospectPeople } from "@/lib/prospects/access";
import { resolveProspectContext } from "@/lib/prospects/context";
import { getProspectFile, getProspectReads, markProspectRead } from "@/lib/prospects/store";
import { emptyProspectFile } from "@/lib/prospects/shared";
import { servicesLabel } from "@/lib/onboarding-tracks";
import { getLogoOverride } from "@/lib/admin-client-logos-store";
import { getClientLogo, getLogoBgMode, getLogoSizing } from "@/lib/client-meta";
import { getClientPalette, paletteToGradient } from "@/lib/client-colors";

export const dynamic = "force-dynamic";

const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,79}$/;
const OWNER_GROUP = ["Comercial", "Direção", "Consultores"];

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const ctx = SLUG_RE.test(slug) ? await resolveProspectContext(slug).catch(() => null) : null;
  return {
    title: ctx ? `${ctx.title} — Ficha do prospect · Wonder Ads` : "Ficha do prospect — Wonder Ads Workspace",
    robots: { index: false, follow: false },
  };
}

export default async function ProspectFilePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const session = await getCurrentSession();
  const username = effectiveUsername(session);
  const row = username ? findEmployeeByUsername(username) : null;
  if (!username || !row) redirect(`/login?next=${encodeURIComponent(`/prospects/${slug}`)}`);
  if (!SLUG_RE.test(slug)) notFound();

  const { file, failed } = await getProspectFile(slug);
  const ctx = await resolveProspectContext(slug, file?.title);
  if (!ctx) notFound();

  const impersonating = isImpersonating(session);
  const now = Date.now();
  const reads = await getProspectReads(slug);
  if (!impersonating) {
    reads[username] = now;
    after(() =>
      markProspectRead(slug, username, now).catch((err) => console.error("prospect read mark failed:", err)),
    );
  }

  const people = Object.fromEntries(
    prospectPeople().map((p) => [p.username, { name: p.name, avatar: p.avatar, role: p.role }]),
  );
  const owners = prospectPeople()
    .filter((p) => p.canOwn)
    .sort((a, b) => a.rank - b.rank || a.name.localeCompare(b.name, "pt"))
    .map((p) => ({ username: p.username, name: p.name, group: OWNER_GROUP[p.rank] ?? "Equipa" }));

  const logo = (await getLogoOverride(slug).catch(() => null)) ?? getClientLogo(slug);

  return (
    <PageShell backHref="/prospects" backLabel="Fichas do prospect">
      <ProspectFileView
        ctx={{
          slug,
          title: ctx.title,
          services: ctx.services,
          servicesLabel: ctx.services.length ? servicesLabel(ctx.services) : "",
          stage: ctx.stage,
          consultant: ctx.consultant,
          consultantUsername: ctx.consultantUsername,
          onBoard: ctx.onBoard,
          onboardingCreatedAt: ctx.onboarding?.createdAt ?? null,
          onboardingPublicPath: ctx.onboarding?.publicPath ?? null,
        }}
        initialFile={file ?? emptyProspectFile(slug, ctx.title, "", null, 0)}
        initialReads={reads}
        viewer={{
          username,
          name: row.name,
          canWrite: canWriteProspects(row) && !impersonating && !failed,
          isAdmin: Boolean(row.isAdmin),
          impersonating,
        }}
        people={people}
        owners={owners}
        renderedAt={now}
        loadFailed={failed}
        logo={
          <LogoChip
            logo={logo}
            emoji={ctx.icon ?? "🚀"}
            alt={`${ctx.title} logo`}
            gradient={paletteToGradient(getClientPalette(slug))}
            size="lg"
            bgMode={getLogoBgMode(slug)}
            sizing={getLogoSizing(slug)}
          />
        }
      />
    </PageShell>
  );
}
