// /<slug>/reviews — o Reviews Hub do cliente (v77.53).
//
// Público no middleware (não está no matcher): quem chega sem sessão da
// equipa vê o portão da password; a equipa Wonder Ads entra direto. Só os
// clientes com entrada em src/lib/reviews-hub/config.ts têm página — os
// outros slugs dão 404.
//
// Fica num grupo de rotas próprio, e não em (public-review), porque aquele
// layout é claro (#f4f4ed) e esta plataforma é escura: aqui manda o layout
// raiz da app.

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getClientLogo } from "@/lib/client-meta";
import { getLogoOverride } from "@/lib/admin-client-logos-store";
import { getHubViewer } from "@/lib/reviews-hub/access";
import { getHubConfig } from "@/lib/reviews-hub/config";
import {
  getActivity,
  getDrafts,
  getLocations,
  getSettings,
  getSummary,
  getSyncState,
} from "@/lib/reviews-hub/store";
import { HubGate } from "@/components/reviews-hub/hub-gate";
import { ReviewsHubApp } from "@/components/reviews-hub/hub-app";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const cfg = getHubConfig(slug);
  return {
    title: cfg ? `Respostas a Reviews · ${cfg.brand}` : "Reviews",
    robots: { index: false, follow: false },
  };
}

export default async function ReviewsHubPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const cfg = getHubConfig(slug);
  if (!cfg) notFound();
  const logo = (await getLogoOverride(slug).catch(() => null)) ?? getClientLogo(slug);

  const viewer = await getHubViewer(slug);
  if (!viewer) return <HubGate slug={slug} brand={cfg.brand} logo={logo} />;

  const [locations, settings, sync, drafts, activity, summary] = await Promise.all([
    getLocations(slug),
    getSettings(slug),
    getSyncState(slug),
    getDrafts(slug),
    getActivity(slug),
    getSummary(slug),
  ]);

  return (
    <ReviewsHubApp
      bootstrap={{
        slug,
        brand: cfg.brand,
        logo,
        locations,
        settings,
        sync,
        drafts,
        activity: activity.slice(0, 40),
        summary,
        viewer,
      }}
    />
  );
}
