// /<slug>/origem — a Origem de Pacientes do cliente (v78.68, piloto MyMedic;
// redesenhada na v78.69 com a marca do cliente; v78.76 em todos os clientes
// de SEO ativos, cada um com as cores, a letra, o logótipo e os cantos dele).
//
// Público no middleware (não está no matcher): sem sessão da equipa, a
// receção vê o portão do PIN; a equipa WonderAds entra direto. Só os
// clientes com entrada em src/lib/origem/clients.ts têm página.

import type { CSSProperties } from "react";
import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import { getClientLogo } from "@/lib/client-meta";
import { getLogoOverride } from "@/lib/admin-client-logos-store";
import { getOrigemViewer } from "@/lib/origem/access";
import { getOrigemConfig, type OrigemClient } from "@/lib/origem/config";
import { ORIGEM_FONTS } from "@/lib/origem/fonts";
import { getHistory, getLiveSnapshot } from "@/lib/origem/store";
import { OrigemGate } from "@/components/origem/origem-gate";
import { OrigemApp } from "@/components/origem/origem-app";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ slug: string }> };

export async function generateViewport({ params }: Params): Promise<Viewport> {
  const { slug } = await params;
  const cfg = getOrigemConfig(slug);
  return { themeColor: cfg?.theme.paper ?? "#FFFFFF", width: "device-width", initialScale: 1, viewportFit: "cover" };
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const cfg = getOrigemConfig(slug);
  return {
    title: cfg ? `Origem dos ${cfg.person.many} · ${cfg.brand}` : "Origem",
    robots: { index: false, follow: false },
    // No tablet da receção: «Adicionar ao ecrã principal» abre em ecrã inteiro.
    appleWebApp: { capable: true, title: "Origem", statusBarStyle: "default" },
  };
}

const rgb = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

/** A mistura de duas cores (t = 0 → a, 1 → b). */
function mix(a: string, b: string, t: number): string {
  const x = rgb(a);
  const y = rgb(b);
  return `#${x.map((v, i) => Math.round(v + (y[i] - v) * t).toString(16).padStart(2, "0")).join("")}`;
}

/** Os cantos de cada marca: escala dos cartões e raio dos botões. */
const SHAPES = {
  round: { rs: "1", pill: "9999px" },
  soft: { rs: "0.6", pill: "9999px" },
  square: { rs: "0.3", pill: "7px" },
} as const;

/** As cores e a forma do cliente como variáveis CSS — os componentes só usam estas. */
function themeVars(cfg: OrigemClient): CSSProperties {
  const t = cfg.theme;
  const shape = SHAPES[t.shape ?? "round"];
  return {
    "--o-paper": t.paper,
    "--o-ink": t.ink,
    "--o-ink-rgb": rgb(t.ink).join(","),
    "--o-muted": t.muted,
    "--o-line": t.line,
    "--o-line-strong": mix(t.line, t.muted, 0.3),
    "--o-primary": t.primary,
    "--o-deep": t.deep,
    "--o-accent": t.accent,
    "--o-rs": shape.rs,
    "--o-pill": shape.pill,
    "--o-display": ORIGEM_FONTS[t.display ?? t.font].style.fontFamily,
    "--o-hw": String(t.heading ?? 800),
    "--o-logo-h": `${cfg.logo?.h ?? 40}px`,
  } as CSSProperties;
}

export default async function OrigemPage({ params }: Params) {
  const { slug } = await params;
  const cfg = getOrigemConfig(slug);
  if (!cfg) notFound();
  // O logótipo próprio da página (para fundo claro) manda; sem ele, o da ficha.
  const logo = cfg.logo?.src ?? (await getLogoOverride(slug).catch(() => null)) ?? getClientLogo(slug);

  const viewer = await getOrigemViewer(slug);
  const shell = `${ORIGEM_FONTS[cfg.theme.font].className} min-h-[100dvh] bg-[var(--o-paper)] text-[var(--o-ink)] antialiased`;
  // O fundo do resto da app é escuro; aqui o «elástico» do iPad mostra o papel.
  // .o-display = a letra e o peso dos títulos e dos números grandes da marca.
  const page = (
    <style>{`html,body{background:${cfg.theme.paper}}.o-display{font-family:var(--o-display);font-weight:var(--o-hw)}`}</style>
  );

  if (!viewer) {
    return (
      <div className={shell} style={themeVars(cfg)}>
        {page}
        <OrigemGate slug={slug} brand={cfg.brand} logo={logo} peopleMany={cfg.person.many} deskOf={cfg.desk.of} />
      </div>
    );
  }

  const [history, live] = await Promise.all([
    getHistory(cfg).catch(() => []),
    getLiveSnapshot(cfg).catch(() => ({ stats: null, today: [] })),
  ]);
  const current = live.stats;
  return (
    <div className={shell} style={themeVars(cfg)}>
      {page}
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
