// Desbloqueios de projetos em pausa (v80.36).
//
// Um projeto em pausa fecha todas as páginas públicas do cliente (ver
// paused-projects.ts). Um SuperAdmin pode reabrir partes dele durante algum
// tempo — 30, 60 ou 90 dias, ou sem prazo — a partir do cartão do cliente
// nos «Pausados / Suspensos» do SEO DPT. Ex.: deixar a tabela de aprovações
// aberta 30 dias depois de um projeto terminar.
//
// Puro e Edge-safe: lido pelo middleware, pelo servidor e pelo browser.
// O prazo conta-se na leitura: um desbloqueio expirado volta a fechar sozinho,
// sem cron.

export const UNLOCKS_KEY = "seo-paused-unlocks";

export type UnlockUnitId = "aprovacoes" | "origem" | "reviews-hub" | "onboarding" | "nps";

export type UnlockUnit = {
  id: UnlockUnitId;
  /** Como a direção o vê no SEO DPT. */
  label: string;
  /** Pastilha curta no cartão. */
  short: string;
  /** Como o cliente o vê. */
  client: { pt: string; en: string };
  /** O caminho depois de /<slug>. */
  path: string;
  /** As secções públicas (/<slug>/<secção>) que abre. */
  sections: string[];
  /** As APIs (/api/<nome>/<slug>) que essas páginas usam. */
  apis: string[];
};

export const UNLOCK_UNITS: UnlockUnit[] = [
  {
    id: "aprovacoes",
    label: "Pending Review e pré-visualizações",
    short: "Pending Review",
    client: { pt: "Aprovações e relatórios", en: "Approvals and reports" },
    path: "/pendingreview",
    sections: ["pendingreview", "preview"],
    apis: ["reviews"],
  },
  {
    id: "origem",
    label: "Registo de leads (Origem)",
    short: "Origem",
    client: { pt: "Registo de leads", en: "Lead tracking" },
    path: "/origem",
    sections: ["origem"],
    apis: ["origem"],
  },
  {
    id: "reviews-hub",
    label: "Reviews Hub",
    short: "Reviews Hub",
    client: { pt: "Reviews Hub", en: "Reviews Hub" },
    path: "/reviews",
    sections: ["reviews"],
    apis: ["reviews-hub"],
  },
  {
    id: "onboarding",
    label: "Onboarding",
    short: "Onboarding",
    client: { pt: "Onboarding", en: "Onboarding" },
    path: "/onboarding",
    sections: ["onboarding"],
    apis: ["onboarding-gate", "onboarding-intake", "onboarding-accesses", "onboarding-files", "onboarding-progress"],
  },
  {
    id: "nps",
    label: "Inquérito NPS",
    short: "NPS",
    client: { pt: "Inquérito de satisfação", en: "Satisfaction survey" },
    path: "/survey",
    sections: ["survey"],
    apis: ["nps"],
  },
];

export const UNLOCK_DURATIONS: Array<{ days: number | null; label: string }> = [
  { days: 30, label: "30 dias" },
  { days: 60, label: "60 dias" },
  { days: 90, label: "90 dias" },
  { days: null, label: "Sem prazo" },
];

export type UnlockGrant = {
  /** Fim do desbloqueio (ms). null = sem prazo, até alguém o fechar. */
  until: number | null;
  grantedAt: number;
  grantedBy: string;
};

export type ProjectUnlocks = Partial<Record<UnlockUnitId, UnlockGrant>>;
export type UnlocksMap = Record<string, ProjectUnlocks>;

/** O que o browser recebe de um desbloqueio ativo. */
export type ActiveUnlock = { unit: UnlockUnitId; until: number | null };

const UNIT_IDS = new Set<string>(UNLOCK_UNITS.map((u) => u.id));

export function unlockUnit(id: string): UnlockUnit | null {
  return UNLOCK_UNITS.find((u) => u.id === id) ?? null;
}

export function unitForSection(section: string): UnlockUnit | null {
  return UNLOCK_UNITS.find((u) => u.sections.includes(section)) ?? null;
}

export function unitForApi(api: string): UnlockUnit | null {
  return UNLOCK_UNITS.find((u) => u.apis.includes(api)) ?? null;
}

export function isGrantActive(g: UnlockGrant | undefined | null, now: number = Date.now()): boolean {
  return Boolean(g) && (g!.until === null || g!.until > now);
}

/** Os desbloqueios ainda em vigor de um projeto, pela ordem de UNLOCK_UNITS. */
export function activeUnlocks(p: ProjectUnlocks | undefined, now: number = Date.now()): ActiveUnlock[] {
  if (!p) return [];
  return UNLOCK_UNITS.filter((u) => isGrantActive(p[u.id], now)).map((u) => ({ unit: u.id, until: p[u.id]!.until }));
}

/** O valor chega como o @vercel/kv o gravou (objeto, ou JSON em texto via
 *  REST). Tudo o que não tem a forma certa cai. */
export function parseUnlocks(raw: unknown): UnlocksMap {
  let value = raw;
  if (typeof value === "string") {
    try {
      value = JSON.parse(value);
    } catch {
      return {};
    }
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const out: UnlocksMap = {};
  for (const [slug, units] of Object.entries(value as Record<string, unknown>)) {
    if (!units || typeof units !== "object") continue;
    const project: ProjectUnlocks = {};
    for (const [unit, g] of Object.entries(units as Record<string, unknown>)) {
      if (!UNIT_IDS.has(unit) || !g || typeof g !== "object") continue;
      const grant = g as Record<string, unknown>;
      const until = grant.until === null ? null : typeof grant.until === "number" ? grant.until : undefined;
      if (until === undefined) continue;
      project[unit as UnlockUnitId] = {
        until,
        grantedAt: typeof grant.grantedAt === "number" ? grant.grantedAt : 0,
        grantedBy: typeof grant.grantedBy === "string" ? grant.grantedBy : "",
      };
    }
    if (Object.keys(project).length > 0) out[slug] = project;
  }
  return out;
}

const DAY = 24 * 60 * 60 * 1000;
const HOUR = 60 * 60 * 1000;

/** «faltam 29 dias» / «29 days left». Abaixo de 2 dias, em horas. */
export function remainingLabel(until: number | null, now: number, lang: "pt" | "en"): string {
  if (until === null) return lang === "pt" ? "sem prazo" : "no end date";
  const left = until - now;
  if (left <= 0) return lang === "pt" ? "terminou" : "ended";
  if (left < 2 * DAY) {
    const h = Math.max(1, Math.ceil(left / HOUR));
    return lang === "pt" ? `falta${h === 1 ? "" : "m"} ${h} h` : `${h} h left`;
  }
  const d = Math.ceil(left / DAY);
  return lang === "pt" ? `faltam ${d} dias` : `${d} days left`;
}

/** «29 d» / «5 h» / «∞» — para as pastilhas do cartão. */
export function remainingShort(until: number | null, now: number): string {
  if (until === null) return "∞";
  const left = until - now;
  if (left <= 0) return "0 d";
  if (left < 2 * DAY) return `${Math.max(1, Math.ceil(left / HOUR))} h`;
  return `${Math.ceil(left / DAY)} d`;
}
