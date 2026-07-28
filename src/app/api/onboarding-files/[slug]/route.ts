// Client-supplied files sent from the PUBLIC onboarding page.
//
// Writes straight into the same `files:<slug>` library the client page
// reads, tagged `source: "onboarding"`. Because the onboarding slug and
// the SEO project slug are the same string (see onboarding-clients-store),
// nothing has to be "migrated" when the client is promoted — the files are
// already in the right place the moment the project exists.
//
// APPEND-ONLY on purpose. This route is unauthenticated (same trust level
// as the public intake form), so it must never be able to replace or drop
// what's already in the library the way PUT /api/files/[slug] can.

import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { detectKind, type ClientFile } from "@/lib/client-files";
import { getFilesForSlug, saveFilesForSlug } from "@/lib/files-storage";
import { getOnboardingClient } from "@/lib/onboarding-clients-store";

export const runtime = "nodejs";

/** Hard ceiling for the whole library, matching /api/files/[slug]. */
const MAX_FILES = 200;
/** Per-submission cap — one paste of links shouldn't fill the library. */
const MAX_PER_REQUEST = 30;
const MAX_NAME_LENGTH = 200;

type Incoming = { name?: unknown; url?: unknown };

function cleanOne(raw: unknown): ClientFile | null {
  if (!raw || typeof raw !== "object") return null;
  const { name, url } = raw as Incoming;
  if (typeof url !== "string") return null;
  const trimmed = url.trim();
  // http/https only — blocks javascript:, data:, file: and friends.
  if (!/^https?:\/\//i.test(trimmed)) return null;
  try {
    new URL(trimmed);
  } catch {
    return null;
  }
  const label =
    typeof name === "string" && name.trim() ? name.trim() : trimmed;
  return {
    id: crypto.randomUUID(),
    kind: detectKind(label !== trimmed ? label : trimmed),
    name: label.slice(0, MAX_NAME_LENGTH),
    url: trimmed,
    addedAt: Date.now(),
    source: "onboarding",
  };
}

/** How many files the client has already sent — drives the card's
 *  red → green state on load. */
export async function GET(
  _req: Request,
  context: { params: Promise<{ slug: string }> },
) {
  const { slug } = await context.params;
  const files = await getFilesForSlug(slug);
  const mine = files.filter((f) => f.source === "onboarding");
  return NextResponse.json({
    count: mine.length,
    files: mine.map((f) => ({
      id: f.id,
      name: f.name,
      kind: f.kind,
      addedAt: f.addedAt,
    })),
  });
}

export async function POST(
  req: Request,
  context: { params: Promise<{ slug: string }> },
) {
  const { slug } = await context.params;

  // Only slugs that are actually in an onboarding flow can be written to,
  // so the open endpoint can't be pointed at an arbitrary client.
  const onboarding = await getOnboardingClient(slug);
  if (!onboarding) {
    return NextResponse.json({ error: "unknown client" }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }
  const incoming = Array.isArray((body as { files?: unknown })?.files)
    ? ((body as { files: unknown[] }).files as unknown[])
    : [];
  const additions = incoming
    .slice(0, MAX_PER_REQUEST)
    .map(cleanOne)
    .filter((f): f is ClientFile => f !== null);

  if (additions.length === 0) {
    return NextResponse.json({ error: "no valid files" }, { status: 400 });
  }

  try {
    const existing = await getFilesForSlug(slug);
    // Same URL twice (double-submit, or a link already sent) is a no-op.
    const seen = new Set(existing.map((f) => f.url));
    const fresh = additions.filter((f) => !seen.has(f.url));
    const next = [...fresh, ...existing].slice(0, MAX_FILES);
    await saveFilesForSlug(slug, next);
    revalidatePath(`/seo/${slug}`);
    return NextResponse.json({
      ok: true,
      added: fresh.length,
      count: next.filter((f) => f.source === "onboarding").length,
    });
  } catch (err) {
    console.error("onboarding files save failed", err);
    return NextResponse.json({ error: "storage write failed" }, { status: 500 });
  }
}
