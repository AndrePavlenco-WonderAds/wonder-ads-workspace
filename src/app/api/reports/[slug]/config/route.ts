// Per-client Monthly Report configuration.
//
// Until now this config existed in KV but had no way in — the only writer was
// the GBP locations route, and everything else (lead event names, GA4 property,
// GSC property) could only be changed in code. That forced the opposite fix:
// renaming events inside GA4 to match our defaults, which GA4 does NOT
// backfill, so every month before the rename silently reads 0.
//
//   GET → current config
//   PUT → save { eventMap?, extraLeadEvents?, ga4PropertyId?, gscSiteUrl? }

import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getCurrentEmployee } from "@/lib/auth/server";
import { editableDepts } from "@/lib/auth/credentials";
import {
  getReportConfig,
  saveReportConfig,
  LEAD_EVENT_KEYS,
  MAX_EVENT_ALIASES,
  type LeadEventMap,
} from "@/lib/report/report-config-store";
import {
  MAX_CUSTOM_LEAD_EVENTS,
  type CustomLeadEvent,
} from "@/lib/report/report-types";

export const runtime = "nodejs";

async function guard() {
  const employee = await getCurrentEmployee();
  return Boolean(employee && editableDepts(employee).includes("seo"));
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  if (!(await guard())) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const { slug } = await params;
  return NextResponse.json(await getReportConfig(slug));
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
    ga4PropertyId?: unknown;
    gscSiteUrl?: unknown;
  };

  const patch: {
    eventMap?: LeadEventMap;
    extraLeadEvents?: CustomLeadEvent[];
    ga4PropertyId?: string | null;
    gscSiteUrl?: string | null;
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

  // "" clears an override back to auto-resolution; undefined leaves it alone.
  for (const key of ["ga4PropertyId", "gscSiteUrl"] as const) {
    const v = body[key];
    if (typeof v === "string") patch[key] = v.trim() || null;
    else if (v === null) patch[key] = null;
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "nothing to save" }, { status: 400 });
  }

  try {
    const saved = await saveReportConfig(slug, patch, Date.now());
    revalidatePath(`/seo/${slug}`);
    return NextResponse.json({ ok: true, config: saved });
  } catch (err) {
    console.error("report config save failed:", err);
    return NextResponse.json({ error: "save_failed" }, { status: 500 });
  }
}
