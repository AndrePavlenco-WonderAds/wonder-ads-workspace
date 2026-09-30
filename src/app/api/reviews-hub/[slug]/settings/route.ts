// PUT /api/reviews-hub/<slug>/settings — grava as Definições (estratégias,
// tom, assinatura, automação). Ligar a automação carimba `enabledAt`: é a
// linha a partir da qual as reviews novas passam a ser tratadas sozinhas.

import { NextResponse } from "next/server";
import { hubGate, readJson } from "@/lib/reviews-hub/route-helpers";
import { getSettings, logActivity, saveSettings } from "@/lib/reviews-hub/store";
import {
  STAR_LEVELS,
  type HubSettings,
  type ResponseMode,
  type StarLevel,
} from "@/lib/reviews-hub/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MODES = new Set<ResponseMode>(["auto", "approval", "manual"]);
const s = (v: unknown, max: number, fallback: string) =>
  typeof v === "string" ? v.slice(0, max) : fallback;

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const gate = await hubGate(slug, { write: true });
  if (gate instanceof NextResponse) return gate;
  const body = await readJson<{ settings?: Partial<HubSettings> }>(req);
  const incoming = body?.settings;
  if (!incoming || typeof incoming !== "object") {
    return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  }

  const current = await getSettings(slug);
  const strategies = { ...current.strategies };
  for (const level of STAR_LEVELS) {
    const key = String(level) as `${StarLevel}`;
    const inc = incoming.strategies?.[key];
    if (!inc) continue;
    strategies[key] = {
      title: s(inc.title, 80, strategies[key].title).trim() || strategies[key].title,
      description: s(inc.description, 300, strategies[key].description),
      guidelines: s(inc.guidelines, 2000, strategies[key].guidelines),
      mode: MODES.has(inc.mode as ResponseMode) ? (inc.mode as ResponseMode) : strategies[key].mode,
    };
  }

  const wantEnabled =
    typeof incoming.automation?.enabled === "boolean"
      ? incoming.automation.enabled
      : current.automation.enabled;
  const switchedOn = wantEnabled && !current.automation.enabled;
  const switchedOff = !wantEnabled && current.automation.enabled;

  const next: HubSettings = {
    automation: {
      enabled: wantEnabled,
      enabledAt: wantEnabled ? (switchedOn ? Date.now() : current.automation.enabledAt) : null,
      updatedBy: switchedOn || switchedOff ? gate.actor : current.automation.updatedBy,
    },
    strategies,
    signature: s(incoming.signature, 120, current.signature).trim() || current.signature,
    tone: s(incoming.tone, 1200, current.tone),
    contactLine: s(incoming.contactLine, 200, current.contactLine),
    extraRules: s(incoming.extraRules, 2000, current.extraRules),
  };
  await saveSettings(slug, next);
  await logActivity(slug, {
    at: Date.now(),
    kind: "settings",
    text: switchedOn
      ? "Automação ligada"
      : switchedOff
        ? "Automação desligada"
        : "Definições das respostas atualizadas",
    by: gate.actor,
  });
  return NextResponse.json({ ok: true, settings: await getSettings(slug) });
}
