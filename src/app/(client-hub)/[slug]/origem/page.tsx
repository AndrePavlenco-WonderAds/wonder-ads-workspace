// /<slug>/origem — a Origem de Pacientes do cliente (v78.68, piloto MyMedic;
// redesenhada na v78.69 com a marca do cliente: fundo claro, Manrope).
//
// Público no middleware (não está no matcher): sem sessão da equipa, a
// receção vê o portão do PIN; a equipa WonderAds entra direto. Só os
// clientes com entrada em src/lib/origem/config.ts têm página.

import type { CSSProperties } from "react";
import type { Metadata, Viewport } from "next";
import { Manrope } from "next/font/google";
import { notFound } from "next/navigation";
import { getClientLogo } from "@/lib/client-meta";
import { getLogoOverride } from "@/lib/admin-client-logos-store";
import { getOrigemViewer } from "@/lib/origem/access";
import { getOrigemConfig, type OrigemTheme } from "@/lib/origem/config";
import { getHistory, getLiveSnapshot } from "@/lib/origem/store";
import { OrigemGate } from "@/components/origem/origem-gate";
import { OrigemApp } from "@/components/origem/origem-app";

export const dynamic = "force-dynamic";

// A letra do site da MyMedic.
const manrope = Manrope({ subsets: ["latin"], weight: ["400", "500", "600", "700", "800"], display: "swap" });

export const viewport: Viewport = { themeColor: "#F3F9F9", width: "device-width", initialScale: 1, viewportFit: "cover" };

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const cfg = getOrigemConfig(slug);
  return {
    title: cfg ? `Origem dos ${cfg.person.many} · ${cfg.brand}` : "Origem",
    robots: { index: false, follow: false },
    // No tablet da receção: «Adicionar ao ecrã principal» abre em ecrã inteiro.
    appleWebApp: { capable: true, title: "Origem", statusBarStyle: "default" },
  };
}

/** As cores do cliente como variáveis CSS — os componentes só usam estas. */
function themeVars(t: OrigemTheme): CSSProperties {
  return {
    "--o-paper": t.paper,
    "--o-ink": t.ink,
    "--o-muted": t.muted,
    "--o-line": t.line,
    "--o-primary": t.primary,
    "--o-deep": t.deep,
    "--o-accent": t.accent,
  } as CSSProperties;
}

export default async function OrigemPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const cfg = getOrigemConfig(slug);
  if (!cfg) notFound();
  const logo = (await getLogoOverride(slug).catch(() => null)) ?? getClientLogo(slug);

  const viewer = await getOrigemViewer(slug);
  const shell = `${manrope.className} min-h-[100dvh] bg-[var(--o-paper)] text-[var(--o-ink)] antialiased`;
  // O fundo do resto da app é escuro; aqui o «elástico» do iPad mostra o papel.
  const paper = <style>{`html,body{background:${cfg.theme.paper}}`}</style>;

  if (!viewer) {
    return (
      <div className={shell} style={themeVars(cfg.theme)}>
        {paper}
        <OrigemGate slug={slug} brand={cfg.brand} logo={logo} peopleMany={cfg.person.many} />
      </div>
    );
  }

  const [history, live] = await Promise.all([
    getHistory(cfg).catch(() => []),
    getLiveSnapshot(cfg).catch(() => ({ stats: null, today: [] })),
  ]);
  const current = live.stats;
  return (
    <div className={shell} style={themeVars(cfg.theme)}>
      {paper}
      <OrigemApp
        bootstrap={{
          slug,
          cfg,
          logo,
          viewer: { kind: viewer.kind, name: viewer.kind === "team" ? viewer.name : null, canWrite: viewer.canWrite },
          history: current ? [...history.filter((m) => m.month !== current.month), current] : history,
          today: live.today,
          serverNow: Date.now(),
        }}
      />
    </div>
  );
}
