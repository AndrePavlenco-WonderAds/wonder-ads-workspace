// Per-client analytics config for the Monthly Report. Everything the report
// needs to pull real data for one client, that isn't already resolvable from
// code: the exact GA4 property / GSC site / GBP location, the names of the
// client's lead events in GA4 (they vary per GTM setup), the timezone, and the
// LLM-referral regex list. All optional — sensible defaults fill the gaps so
// the report works out of the box and the config is only for overrides.
//
// Stored plaintext in Vercel KV (encrypted at rest), gated behind the
// workspace session on every route — same model as ads-connections-store.

import { kv } from "@vercel/kv";

const KEY_PREFIX = "report-config:";

export type ReportSection =
  | "leads"
  | "organic"
  | "ai"
  | "gbp"
  | "topQueries";

/** GA4 event names for each lead type — defaults match the spec's GTM guide,
 *  overridable per client because every GTM container names events its own way. */
export type LeadEventMap = {
  form: string;
  call: string;
  email: string;
  whatsapp: string;
};

export type ReportConfig = {
  /** GA4 numeric property id override (null = auto-resolve by domain). */
  ga4PropertyId: string | null;
  /** GSC site url override, e.g. "sc-domain:client.com" (null = auto). */
  gscSiteUrl: string | null;
  /** Google Business Profile location id (null until GBP is wired in Fase 3). */
  gbpLocationId: string | null;
  timezone: string;
  currency: string;
  eventMap: LeadEventMap;
  /** Regex source strings matched against GA4 sessionSource for AI Visibility. */
  llmRegex: string[];
  sectionsEnabled: Record<ReportSection, boolean>;
  updatedAt: number;
};

export const DEFAULT_LEAD_EVENT_MAP: LeadEventMap = {
  form: "generate_lead",
  call: "click_to_call",
  email: "click_to_email",
  whatsapp: "whatsapp_click",
};

/** Default AI-referral matchers (host fragments). The report matches each GA4
 *  sessionSource against these; kept configurable so new LLM surfaces are a
 *  one-line add, not a code change. */
export const DEFAULT_LLM_REGEX: string[] = [
  "chatgpt\\.com",
  "chat\\.openai\\.com",
  "gemini\\.google\\.com",
  "claude\\.ai",
  "perplexity\\.ai",
  "copilot\\.microsoft\\.com",
  "\\.bing\\.com/chat",
];

const ALL_SECTIONS: ReportSection[] = [
  "leads",
  "organic",
  "ai",
  "gbp",
  "topQueries",
];

export const reportConfigStorageConfigured = Boolean(
  process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN,
);

function key(slug: string): string {
  return `${KEY_PREFIX}${slug}`;
}

/** Defaults for a client with no saved override. Currency comes from the
 *  client's billing record when known, else EUR; timezone defaults to Lisbon. */
export function defaultReportConfig(slug: string, currency = "EUR"): ReportConfig {
  return {
    ga4PropertyId: null,
    gscSiteUrl: null,
    gbpLocationId: null,
    timezone: "Europe/Lisbon",
    currency,
    eventMap: { ...DEFAULT_LEAD_EVENT_MAP },
    llmRegex: [...DEFAULT_LLM_REGEX],
    sectionsEnabled: Object.fromEntries(
      ALL_SECTIONS.map((s) => [s, true]),
    ) as Record<ReportSection, boolean>,
    updatedAt: 0,
  };
}

const asStr = (v: unknown): string | null =>
  typeof v === "string" && v.trim() ? v.trim() : null;

function normalizeEventMap(v: unknown): LeadEventMap {
  const o = (v ?? {}) as Partial<Record<keyof LeadEventMap, unknown>>;
  return {
    form: asStr(o.form) ?? DEFAULT_LEAD_EVENT_MAP.form,
    call: asStr(o.call) ?? DEFAULT_LEAD_EVENT_MAP.call,
    email: asStr(o.email) ?? DEFAULT_LEAD_EVENT_MAP.email,
    whatsapp: asStr(o.whatsapp) ?? DEFAULT_LEAD_EVENT_MAP.whatsapp,
  };
}

function normalizeConfig(raw: unknown, slug: string): ReportConfig {
  const base = defaultReportConfig(slug, "EUR");
  if (!raw || typeof raw !== "object") return base;
  const o = raw as Record<string, unknown>;
  const regex = Array.isArray(o.llmRegex)
    ? o.llmRegex.filter((x): x is string => typeof x === "string" && x.length > 0)
    : null;
  const sections = { ...base.sectionsEnabled };
  if (o.sectionsEnabled && typeof o.sectionsEnabled === "object") {
    for (const s of ALL_SECTIONS) {
      const val = (o.sectionsEnabled as Record<string, unknown>)[s];
      if (typeof val === "boolean") sections[s] = val;
    }
  }
  return {
    ga4PropertyId: asStr(o.ga4PropertyId),
    gscSiteUrl: asStr(o.gscSiteUrl),
    gbpLocationId: asStr(o.gbpLocationId),
    timezone: asStr(o.timezone) ?? base.timezone,
    currency: asStr(o.currency) ?? base.currency,
    eventMap: normalizeEventMap(o.eventMap),
    llmRegex: regex && regex.length ? regex : base.llmRegex,
    sectionsEnabled: sections,
    updatedAt: typeof o.updatedAt === "number" ? o.updatedAt : 0,
  };
}

/** Live config for a client (saved override merged over defaults). Never
 *  throws — returns defaults when KV is off or the read fails. */
export async function getReportConfig(slug: string): Promise<ReportConfig> {
  if (!reportConfigStorageConfigured) {
    return defaultReportConfig(slug, "EUR");
  }
  try {
    const stored = await kv.get<unknown>(key(slug));
    return normalizeConfig(stored, slug);
  } catch (err) {
    console.error("KV report-config read failed:", err);
    return defaultReportConfig(slug, "EUR");
  }
}

/** Merge-patch a client's report config. */
export async function saveReportConfig(
  slug: string,
  patch: Partial<Omit<ReportConfig, "updatedAt">>,
  nowMs: number,
): Promise<ReportConfig> {
  if (!reportConfigStorageConfigured) {
    throw new Error("KV storage not configured on this deployment.");
  }
  const current = await getReportConfig(slug);
  const next = normalizeConfig(
    { ...current, ...patch, updatedAt: nowMs },
    slug,
  );
  await kv.set(key(slug), next);
  return next;
}
