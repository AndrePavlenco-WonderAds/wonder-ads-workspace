// Public endpoint (no auth — outside the middleware matcher, like ./submit)
// that saves/loads a DRAFT of the onboarding form. Called by the client form
// on a 60s auto-save timer and when the client taps "Guardar progresso".
//
// Unlike ./submit it has NO side-effects: it does not generate the PDF, does
// not promote the client onto the SEO board, and does not mark the lesson
// complete. It just persists the in-progress answers so they can be restored
// later (see onboarding-draft-store.ts).

import { NextResponse } from "next/server";
import { resolveOnboardingClient } from "@/lib/onboarding-resolve";
import {
  getOnboardingDraft,
  saveOnboardingDraft,
  type OnboardingDraft,
  type OnboardingDraftFile,
} from "@/lib/onboarding-draft-store";

export const runtime = "nodejs";

const asTrack = (v: unknown): string =>
  v === "ads" ? "ads" : v === "common" ? "common" : "seo";

function sanitizeTexts(v: unknown): Record<string, string> {
  if (!v || typeof v !== "object") return {};
  const out: Record<string, string> = {};
  for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
    if (typeof val === "string") out[k] = val.slice(0, 20000);
  }
  return out;
}

function sanitizeChoices(v: unknown): Record<string, string[]> {
  if (!v || typeof v !== "object") return {};
  const out: Record<string, string[]> = {};
  for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
    if (Array.isArray(val)) {
      const picked = val.filter((x): x is string => typeof x === "string");
      if (picked.length) out[k] = picked;
    }
  }
  return out;
}

function sanitizeFiles(v: unknown): Record<string, OnboardingDraftFile[]> {
  if (!v || typeof v !== "object") return {};
  const out: Record<string, OnboardingDraftFile[]> = {};
  for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
    if (!Array.isArray(val)) continue;
    const files = val
      .filter(
        (f): f is OnboardingDraftFile =>
          !!f &&
          typeof f === "object" &&
          typeof (f as OnboardingDraftFile).url === "string" &&
          typeof (f as OnboardingDraftFile).name === "string",
      )
      .map((f) => ({ url: f.url, name: f.name }))
      .slice(0, 20);
    if (files.length) out[k] = files;
  }
  return out;
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const track = asTrack(new URL(req.url).searchParams.get("track"));

  const client = await resolveOnboardingClient(slug).catch(() => null);
  if (!client) {
    return NextResponse.json({ error: "unknown client" }, { status: 404 });
  }

  const draft = await getOnboardingDraft(slug, track);
  return NextResponse.json({ draft });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;

  const client = await resolveOnboardingClient(slug).catch(() => null);
  if (!client) {
    return NextResponse.json({ error: "unknown client" }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }
  const raw = (body ?? {}) as {
    texts?: unknown;
    choices?: unknown;
    files?: unknown;
    step?: unknown;
    track?: unknown;
  };

  const now = Date.now();
  const draft: OnboardingDraft = {
    texts: sanitizeTexts(raw.texts),
    choices: sanitizeChoices(raw.choices),
    files: sanitizeFiles(raw.files),
    step:
      typeof raw.step === "number" && Number.isFinite(raw.step) && raw.step >= 0
        ? Math.floor(raw.step)
        : 0,
    updatedAt: now,
  };

  try {
    await saveOnboardingDraft(slug, asTrack(raw.track), draft);
  } catch (err) {
    console.error("onboarding draft save failed:", err);
    return NextResponse.json({ error: "storage" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, updatedAt: now });
}
