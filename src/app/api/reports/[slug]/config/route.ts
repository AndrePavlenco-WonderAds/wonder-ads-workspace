// Per-client Monthly Report configuration.
//
// Until now this config existed in KV but had no way in — the only writer was
// the GBP locations route, and everything else (lead event names, GA4 property,
// GSC property) could only be changed in code. That forced the opposite fix:
// renaming events inside GA4 to match our defaults, which GA4 does NOT
// backfill, so every month before the rename silently reads 0.
//
//   GET → current config
//   PUT → save { eventMap?, extraLeadEvents?, extraGbpProfiles?, gbpMainLabel?,
//                gbpLocationId?, ga4PropertyId?, gscSiteUrl? }

import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getCurrentEmployee } from "@/lib/auth/server";
import { editableDepts } from "@/lib/auth/credentials";
import {
  getReportConfig,
  normalizeKeywordList,
  saveReportConfig,
  LEAD_EVENT_KEYS,
  MAX_EVENT_ALIASES,
  type LeadEventMap,
  type ReportConfig,
} from "@/lib/report/report-config-store";
import { resolveGa4MeasurementId } from "@/lib/ga4";
import {
  MAX_CUSTOM_LEAD_EVENTS,
  MAX_GBP_PROFILES,
  type CustomLeadEvent,
  type GbpProfile,
} from "@/lib/report/report-types";

export const runtime = "nodejs";

async function guard() {
  const employee = await getCurrentEmployee();
  return Boolean(employee && editableDepts(employee).includes("seo"));
}

/** O token da Shopify NUNCA volta ao browser — só o facto de existir. */
function maskConfig(config: ReportConfig) {
  const { shopifyAccessToken, ...rest } = config;
  return { ...rest, shopifyAccessToken: null, shopifyTokenSet: Boolean(shopifyAccessToken) };
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  if (!(await guard())) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const { slug } = await params;
  return NextResponse.json(maskConfig(await getReportConfig(slug)));
}

/** Accepts a list or a single comma/newline-separated string per lead type. */
function parseEventList(v: unknown): string[] | null {
  const raw: unknown[] = Array.isArray(v)
    ? v
    : typeof v === "string"
      ? v.split(/[\n,]/)
      : [];
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
  return out.length ? out : null;
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  if (!(await guard())) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const { slug } = await params;
  const body = (await req.json().catch(() => ({}))) as {
    eventMap?: unknown;
    extraLeadEvents?: unknown;
    extraGbpProfiles?: unknown;
    gbpMainLabel?: unknown;
    gbpLocationId?: unknown;
    ga4PropertyId?: unknown;
    gscSiteUrl?: unknown;
    ecommerce?: unknown;
    shopifyShopDomain?: unknown;
    shopifyAccessToken?: unknown;
    currency?: unknown;
    keywordsHidden?: unknown;
    keywordsHideUnranked?: unknown;
  };

  const patch: {
    eventMap?: LeadEventMap;
    extraLeadEvents?: CustomLeadEvent[];
    extraGbpProfiles?: GbpProfile[];
    gbpMainLabel?: string | null;
    gbpLocationId?: string | null;
    ga4PropertyId?: string | null;
    gscSiteUrl?: string | null;
    ecommerce?: boolean;
    shopifyShopDomain?: string | null;
    shopifyAccessToken?: string | null;
    currency?: string;
    keywordsHidden?: string[];
    keywordsHideUnranked?: boolean;
  } = {};

  if (body.eventMap && typeof body.eventMap === "object") {
    const incoming = body.eventMap as Record<string, unknown>;
    const current = (await getReportConfig(slug)).eventMap;
    const next = { ...current };
    for (const key of LEAD_EVENT_KEYS) {
      if (!(key in incoming)) continue;
      const parsed = parseEventList(incoming[key]);
      // An empty list falls back to the existing value rather than wiping the
      // mapping — a blank field should never silently zero a lead channel.
      if (parsed) next[key] = parsed;
    }
    patch.eventMap = next;
  }

  // Extra lead lines. Unlike eventMap, an empty array IS meaningful here — it
  // is how the consultant deletes every extra line — so the array is written
  // through as sent. The store drops any entry missing a label or an event.
  if (Array.isArray(body.extraLeadEvents)) {
    const lines: CustomLeadEvent[] = [];
    for (const item of body.extraLeadEvents.slice(0, MAX_CUSTOM_LEAD_EVENTS)) {
      if (!item || typeof item !== "object") continue;
      const o = item as Record<string, unknown>;
      const events = parseEventList(o.events);
      const label = typeof o.label === "string" ? o.label.trim() : "";
      if (!label || !events) continue;
      lines.push({
        id: typeof o.id === "string" ? o.id : "",
        label,
        events,
      });
    }
    patch.extraLeadEvents = lines;
  }

  // Extra Business Profiles. Like the lead lines, an empty array is meaningful
  // — it's how the consultant removes every extra listing — so it's written
  // through. The store drops any row missing a name or a location id.
  if (Array.isArray(body.extraGbpProfiles)) {
    const profiles: GbpProfile[] = [];
    for (const item of body.extraGbpProfiles.slice(0, MAX_GBP_PROFILES)) {
      if (!item || typeof item !== "object") continue;
      const o = item as Record<string, unknown>;
      const label = typeof o.label === "string" ? o.label.trim() : "";
      const locationId =
        typeof o.locationId === "string" ? o.locationId.trim() : "";
      if (!label || !locationId) continue;
      profiles.push({
        id: typeof o.id === "string" ? o.id : "",
        label,
        locationId,
      });
    }
    patch.extraGbpProfiles = profiles;
  }

  // "" clears an override back to auto-resolution; undefined leaves it alone.
  for (const key of ["ga4PropertyId", "gscSiteUrl", "gbpLocationId", "gbpMainLabel"] as const) {
    const v = body[key];
    if (typeof v === "string") patch[key] = v.trim() || null;
    else if (v === null) patch[key] = null;
  }

  // Propriedade GA4 (v77.9). Um Measurement ID («G-…», o código que está no
  // site e no GTM) traduz-se para o número da propriedade — é esse que a
  // Data API quer. Sem correspondência nos streams visíveis, recusa-se em
  // vez de gravar um id que nunca ia responder; e um id que não é nem
  // número nem G-… também não entra.
  if (typeof patch.ga4PropertyId === "string") {
    const id = patch.ga4PropertyId.replace(/^properties\//, "");
    if (/^G-[A-Z0-9]{4,}$/i.test(id)) {
      const resolved = await resolveGa4MeasurementId(id).catch(() => null);
      if (!resolved) {
        return NextResponse.json(
          {
            error: `Nenhuma propriedade visível tem o stream ${id.toUpperCase()} — confirma que a service account tem acesso a essa propriedade no GA4.`,
          },
          { status: 400 },
        );
      }
      patch.ga4PropertyId = resolved;
    } else if (/^\d{5,16}$/.test(id)) {
      patch.ga4PropertyId = id;
    } else {
      return NextResponse.json(
        { error: "O ID da propriedade GA4 é um número (ou o código G-… do site)." },
        { status: 400 },
      );
    }
  }

  // Curadoria persistente da tabela de keywords (também escrita pela rota
  // do relatório quando o consultor guarda a secção 7).
  if (Array.isArray(body.keywordsHidden)) {
    patch.keywordsHidden = normalizeKeywordList(body.keywordsHidden);
  }
  if (typeof body.keywordsHideUnranked === "boolean") {
    patch.keywordsHideUnranked = body.keywordsHideUnranked;
  }

  // Ligação e-commerce/Shopify. O token só entra no patch quando é MESMO
  // enviado (string não-vazia grava, null remove) — um form que não mexeu no
  // campo não pode apagar o token gravado.
  if (typeof body.ecommerce === "boolean") patch.ecommerce = body.ecommerce;
  if (typeof body.shopifyShopDomain === "string") {
    patch.shopifyShopDomain = body.shopifyShopDomain.trim() || null;
  } else if (body.shopifyShopDomain === null) {
    patch.shopifyShopDomain = null;
  }
  if (typeof body.shopifyAccessToken === "string" && body.shopifyAccessToken.trim()) {
    patch.shopifyAccessToken = body.shopifyAccessToken.trim();
  } else if (body.shopifyAccessToken === null) {
    patch.shopifyAccessToken = null;
  }
  if (typeof body.currency === "string" && /^[A-Za-z]{3}$/.test(body.currency.trim())) {
    patch.currency = body.currency.trim().toUpperCase();
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "nothing to save" }, { status: 400 });
  }

  try {
    const saved = await saveReportConfig(slug, patch, Date.now());
    revalidatePath(`/seo/${slug}`);
    return NextResponse.json({ ok: true, config: maskConfig(saved) });
  } catch (err) {
    console.error("report config save failed:", err);
    return NextResponse.json({ error: "save_failed" }, { status: 500 });
  }
}
