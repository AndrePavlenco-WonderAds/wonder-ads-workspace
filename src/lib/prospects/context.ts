// O contexto vivo de uma ficha (v80.0): em que etapa está o cliente, quem é
// o consultor, que serviços contratou. Nunca se guarda na ficha — deriva-se
// a cada pedido do registo de onboarding, da board do SEO e das migrações de
// consultor, para nunca ficar desatualizado.

import "server-only";
import { getSeoClients, type NotionClient } from "@/lib/notion";
import { getOnboardingClients, type OnboardingClient } from "@/lib/onboarding-clients-store";
import { getConsultantResolver } from "@/lib/consultant-assignments";
import { findEmployeeByName } from "@/lib/proposals/consultant";
import type { OnbService } from "@/lib/onboarding-tracks";
import type { ProspectStage } from "./shared";

export type ProspectContext = {
  slug: string;
  title: string;
  icon: string | null;
  services: OnbService[];
  onboarding: {
    createdAt: number;
    promotedAt: number | null;
    isNew: boolean;
    publicPath: string;
  } | null;
  /** Está na board do SEO DPT (a ficha do cliente existe). */
  onBoard: boolean;
  /** Nome de exibição do consultor, ou null. */
  consultant: string | null;
  consultantUsername: string | null;
  stage: ProspectStage;
};

type Sources = {
  board: Map<string, NotionClient>;
  onboarding: Map<string, OnboardingClient>;
  resolve: (slug: string, fallback: string | null | undefined) => string;
};

async function loadSources(): Promise<Sources> {
  const [board, onboarding, resolver] = await Promise.all([
    getSeoClients().catch(() => [] as NotionClient[]),
    getOnboardingClients(),
    getConsultantResolver(),
  ]);
  return {
    board: new Map(board.map((c) => [c.slug, c])),
    onboarding: new Map(onboarding.map((c) => [c.slug, c])),
    resolve: resolver.resolve,
  };
}

function build(slug: string, src: Sources, fallbackTitle?: string): ProspectContext | null {
  const client = src.board.get(slug) ?? null;
  const onb = src.onboarding.get(slug) ?? null;
  if (!client && !onb && !fallbackTitle) return null;

  let consultant: string | null = null;
  if (client) {
    const c = src.resolve(slug, onb?.consultant ?? client.consultant);
    consultant = c && c !== "Unassigned" ? c : null;
  } else if (onb?.consultant) {
    consultant = onb.consultant;
  }

  const stage: ProspectStage = client
    ? consultant
      ? "assigned"
      : "unassigned"
    : onb
      ? "onboarding"
      : "archived";

  return {
    slug,
    title: client?.title ?? onb?.title ?? fallbackTitle ?? slug,
    icon: client?.icon ?? onb?.icon ?? null,
    services: onb?.services ?? (client ? ["seo"] : []),
    onboarding: onb
      ? {
          createdAt: onb.createdAt,
          promotedAt: onb.promotedAt ?? null,
          isNew: onb.isNew,
          publicPath: `/${onb.slug}/onboarding`,
        }
      : null,
    onBoard: Boolean(client),
    consultant,
    consultantUsername: consultant ? (findEmployeeByName(consultant)?.username ?? null) : null,
    stage,
  };
}

/** O contexto de uma ficha. null quando o slug não é cliente, não está em
 *  onboarding e não tem ficha (`fallbackTitle` só vem quando a ficha existe). */
export async function resolveProspectContext(
  slug: string,
  fallbackTitle?: string,
): Promise<ProspectContext | null> {
  return build(slug, await loadSources(), fallbackTitle);
}

/** Vários de uma vez (a lista) — as fontes leem-se uma vez só. */
export async function resolveProspectContexts(
  entries: Array<{ slug: string; title?: string }>,
): Promise<Map<string, ProspectContext>> {
  const src = await loadSources();
  const out = new Map<string, ProspectContext>();
  for (const e of entries) {
    const ctx = build(e.slug, src, e.title);
    if (ctx) out.set(e.slug, ctx);
  }
  return out;
}

/** As fichas que a lista deve mostrar mesmo sem registo: os onboardings em
 *  curso (com ou sem ficha gravada). */
export async function onboardingEntries(): Promise<Array<{ slug: string; title: string }>> {
  const all = await getOnboardingClients();
  return all.map((c) => ({ slug: c.slug, title: c.title }));
}
