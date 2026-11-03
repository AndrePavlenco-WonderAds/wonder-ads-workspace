// /<slug>/origem — a Origem de Pacientes do cliente (v78.68, piloto MyMedic).
//
// Público no middleware (não está no matcher): sem sessão da equipa, a
// receção vê o portão do PIN; a equipa WonderAds entra direto. Só os
// clientes com entrada em src/lib/origem/config.ts têm página.

import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import { getClientLogo } from "@/lib/client-meta";
import { getLogoOverride } from "@/lib/admin-client-logos-store";
import { getOrigemViewer } from "@/lib/origem/access";
import { getOrigemConfig } from "@/lib/origem/config";
import { getHistory } from "@/lib/origem/store";
import { OrigemGate } from "@/components/origem/origem-gate";
import { OrigemApp } from "@/components/origem/origem-app";

export const dynamic = "force-dynamic";

export const viewport: Viewport = { themeColor: "#07080d" };

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const cfg = getOrigemConfig(slug);
  return {
    title: cfg ? `Origem dos ${cfg.person.many} · ${cfg.brand}` : "Origem",
    robots: { index: false, follow: false },
  };
}

export default async function OrigemPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const cfg = getOrigemConfig(slug);
  if (!cfg) notFound();
  const logo = (await getLogoOverride(slug).catch(() => null)) ?? getClientLogo(slug);

  const viewer = await getOrigemViewer(slug);
  if (!viewer) return <OrigemGate slug={slug} brand={cfg.brand} logo={logo} peopleMany={cfg.person.many} />;

  const history = await getHistory(cfg).catch(() => []);
  return (
    <OrigemApp
      bootstrap={{
        slug,
        cfg,
        logo,
        viewer: { kind: viewer.kind, name: viewer.kind === "team" ? viewer.name : null, canWrite: viewer.canWrite },
        history,
      }}
    />
  );
}
