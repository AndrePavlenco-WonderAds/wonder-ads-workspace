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
import {
  GBP_MAIN_PROFILE_ID,
  MAX_CUSTOM_LEAD_EVENTS,
  MAX_GBP_PROFILES,
  type CustomLeadEvent,
  type GbpProfile,
} from "./report-types";

const KEY_PREFIX = "report-config:";

export type ReportSection =
  | "leads"
  | "organic"
  | "ai"
  | "gbp"
  | "topQueries";

/** GA4 event names for each lead type — defaults match the spec's GTM guide,
 *  overridable per client because every GTM container names events its own way.
 *
 *  A LIST per type, not one name (v76.16). Renaming an event in GA4 to match
 *  our default is destructive: GA4 does not backfill, so every month before
 *  the rename reads 0. Listing the old AND the new name lets one client span
 *  a rename with its history intact — the report sums all of them.  */
export type LeadEventMap = {
  form: string[];
  call: string[];
  email: string[];
  whatsapp: string[];
};

export const LEAD_EVENT_KEYS: (keyof LeadEventMap)[] = [
  "form",
  "call",
  "email",
  "whatsapp",
];

export type ReportConfig = {
  /** GA4 numeric property id override (null = auto-resolve by domain). */
  ga4PropertyId: string | null;
  /** GSC site url override, e.g. "sc-domain:client.com" (null = auto). */
  gscSiteUrl: string | null;
  /** Google Business Profile location id of the client's MAIN listing
   *  (null = auto-match by website host). */
  gbpLocationId: string | null;
  /** Name for the main listing in the report, for clients with more than one
   *  (ex.: "Clínica Cascais"). null → the report calls it "Ficha principal". */
  gbpMainLabel: string | null;
  /** Additional Business Profiles beyond the main one. A multi-unit clinic has
   *  one listing per unit; each is pulled and reported separately. Empty for
   *  most clients. */
  extraGbpProfiles: GbpProfile[];
  timezone: string;
  currency: string;
  eventMap: LeadEventMap;
  /** Extra lead lines beyond the four defaults (2nd unit's phone, a form that
   *  only exists on one page…). Empty for most clients. */
  extraLeadEvents: CustomLeadEvent[];
  /** Regex source strings matched against GA4 sessionSource for AI Visibility. */
  llmRegex: string[];
  sectionsEnabled: Record<ReportSection, boolean>;
  updatedAt: number;
};

export const DEFAULT_LEAD_EVENT_MAP: LeadEventMap = {
  form: ["generate_lead"],
  call: ["click_to_call"],
  email: ["click_to_email"],
  whatsapp: ["whatsapp_click"],
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
    gbpMainLabel: null,
    extraGbpProfiles: [],
    timezone: "Europe/Lisbon",
    currency,
    eventMap: {
      form: [...DEFAULT_LEAD_EVENT_MAP.form],
      call: [...DEFAULT_LEAD_EVENT_MAP.call],
      email: [...DEFAULT_LEAD_EVENT_MAP.email],
      whatsapp: [...DEFAULT_LEAD_EVENT_MAP.whatsapp],
    },
    extraLeadEvents: [],
    llmRegex: [...DEFAULT_LLM_REGEX],
    sectionsEnabled: Object.fromEntries(
      ALL_SECTIONS.map((s) => [s, true]),
    ) as Record<ReportSection, boolean>,
    updatedAt: 0,
  };
}

const asStr = (v: unknown): string | null =>
  typeof v === "string" && v.trim() ? v.trim() : null;

/** Accepts the pre-v76.16 single-string shape as well as a list, so configs
 *  saved before the change keep working untouched. Trims, drops blanks and
 *  de-dupes; an empty result falls back to the default for that type. */
function asEventList(v: unknown, fallback: string[]): string[] {
  const raw = Array.isArray(v) ? v : typeof v === "string" ? [v] : [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    if (typeof item !== "string") continue;
    const name = item.trim();
    if (!name || seen.has(name)) continue;
    seen.add(name);
    out.push(name);
    if (out.length >= MAX_EVENT_ALIASES) break;
  }
  return out.length ? out : [...fallback];
}

/** Cap per lead type — a paste accident shouldn't blow up the GA4 filter. */
export const MAX_EVENT_ALIASES = 10;

function normalizeEventMap(v: unknown): LeadEventMap {
  const o = (v ?? {}) as Partial<Record<keyof LeadEventMap, unknown>>;
  return {
    form: asEventList(o.form, DEFAULT_LEAD_EVENT_MAP.form),
    call: asEventList(o.call, DEFAULT_LEAD_EVENT_MAP.call),
    email: asEventList(o.email, DEFAULT_LEAD_EVENT_MAP.email),
    whatsapp: asEventList(o.whatsapp, DEFAULT_LEAD_EVENT_MAP.whatsapp),
  };
}

/** Ids we accept from a client (and can safely embed in a channel key). */
const ID_RE = /^[A-Za-z0-9][A-Za-z0-9_-]{0,23}$/;

/** Extra lead lines. A line with no label or no event name is dropped — it
 *  would render as an unnamed row the consultant can never fill. */
function normalizeExtraLeadEvents(v: unknown): CustomLeadEvent[] {
  if (!Array.isArray(v)) return [];
  const out: CustomLeadEvent[] = [];
  const ids = new Set<string>();
  for (const item of v) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const label = typeof o.label === "string" ? o.label.trim().slice(0, 60) : "";
    const events = asEventList(o.events, []);
    if (!label || !events.length) continue;
    let id =
      typeof o.id === "string" && ID_RE.test(o.id) ? o.id : `x${out.length + 1}`;
    while (ids.has(id)) id = `${id}_`;
    ids.add(id);
    out.push({ id, label, events });
    if (out.length >= MAX_CUSTOM_LEAD_EVENTS) break;
  }
  return out;
}

/** Extra Business Profiles. A row with no label or no location id is dropped —
 *  it would render as an unnamed block the consultant can never fill. Ids are
 *  de-duped because they are embedded in the lead channel keys, and two rows
 *  sharing an id would share a manually filled value. */
function normalizeGbpProfiles(v: unknown): GbpProfile[] {
  if (!Array.isArray(v)) return [];
  const out: GbpProfile[] = [];
  const ids = new Set<string>([GBP_MAIN_PROFILE_ID]);
  for (const item of v) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const label = typeof o.label === "string" ? o.label.trim().slice(0, 60) : "";
    // Accept "locations/123" or the bare id; store the bare id.
    const locationId =
      typeof o.locationId === "string"
        ? o.locationId.trim().replace(/^locations\//, "").slice(0, 40)
        : "";
    if (!label || !locationId) continue;
    let id =
      typeof o.id === "string" && ID_RE.test(o.id) ? o.id : `g${out.length + 1}`;
    while (ids.has(id)) id = `${id}_`;
    ids.add(id);
    out.push({ id, label, locationId });
    if (out.length >= MAX_GBP_PROFILES) break;
  }
  return out;
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
    gbpMainLabel: asStr(o.gbpMainLabel),
    extraGbpProfiles: normalizeGbpProfiles(o.extraGbpProfiles),
    timezone: asStr(o.timezone) ?? base.timezone,
    currency: asStr(o.currency) ?? base.currency,
    eventMap: normalizeEventMap(o.eventMap),
    extraLeadEvents: normalizeExtraLeadEvents(o.extraLeadEvents),
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
