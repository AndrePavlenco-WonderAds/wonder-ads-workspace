// /projeto-em-pausa/<slug> (v78.81) — para onde o middleware reescreve as
// páginas públicas de um cliente pausado no SEO DPT (ver
// src/lib/paused-projects.ts). O URL que o cliente vê não muda.
//
// Só responde a clientes que estão MESMO em pausa: aberta à mão para um
// cliente ativo, dá 404 — nunca diz a um cliente ativo que está em pausa.

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getClientBySlug } from "@/lib/notion";
import { getClientLogo, getLogoBgMode } from "@/lib/client-meta";
import { getLogoOverride } from "@/lib/admin-client-logos-store";
import { getOrigemConfig } from "@/lib/origem/config";
import { isProjectPaused } from "@/lib/paused-projects";
import { pickLang } from "@/lib/public-i18n";
import { getCurrentSession } from "@/lib/auth/server";
import {
  NEUTRAL_PALETTE,
  PausedProjectPage,
  type PausedLogo,
  type PausedPalette,
} from "@/components/paused-project-page";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Projeto em pausa · Wonder Ads",
  robots: { index: false, follow: false },
};

/** «clinica-em-casa» → «Clinica Em Casa» — só se o roster não responder. */
function fromSlug(slug: string): string {
  return slug
    .split("-")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function chipBackground(slug: string): string {
  const mode = getLogoBgMode(slug);
  if (mode === "dark") return "#16131F";
  if (typeof mode === "object") return mode.custom;
  return "#FFFFFF";
}

export default async function PausedProject({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  if (!(await isProjectPaused(slug))) notFound();

  const cfg = getOrigemConfig(slug);
  const [client, override, session] = await Promise.all([
    getClientBySlug(slug).catch(() => null),
    getLogoOverride(slug).catch(() => null),
    getCurrentSession().catch(() => null),
  ]);
  const brand = cfg?.brand ?? client?.title ?? fromSlug(slug);

  // O símbolo da Origem (feito para fundo claro) e, sem ele, o logótipo do
  // cartão do cliente no workspace, no fundo que lhe serve.
  const mark = cfg && typeof cfg.theme.mark === "object" ? cfg.theme.mark.src : null;
  const chip = override ?? getClientLogo(slug);
  const logo: PausedLogo = mark
    ? { kind: "image", src: mark, background: "#FFFFFF" }
    : chip
      ? { kind: "image", src: chip, background: override ? "#FFFFFF" : chipBackground(slug) }
      : { kind: "butterfly" };

  const palette: PausedPalette = cfg
    ? {
        paper: cfg.theme.paper,
        ink: cfg.theme.ink,
        muted: cfg.theme.muted,
        line: cfg.theme.line,
        primary: cfg.theme.primary,
        accent: cfg.theme.accent,
      }
    : NEUTRAL_PALETTE;

  return (
    <PausedProjectPage
      brand={brand}
      logo={logo}
      palette={palette}
      lang={pickLang(slug)}
      teamNote={Boolean(session)}
    />
  );
}
