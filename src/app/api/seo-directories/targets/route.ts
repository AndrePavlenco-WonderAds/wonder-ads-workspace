// GET (?slug=…) / PUT the per-client backlink target pipeline.
// Any logged-in workspace user. PUT body: { slug, targets: [...] } and
// replaces that client's whole target list.

import { NextResponse } from "next/server";
import { getCurrentEmployee } from "@/lib/auth/server";
import {
  getTargetsMap,
  saveClientTargets,
} from "@/lib/seo-backlink-targets-store";

export const runtime = "nodejs";

export async function GET(req: Request) {
  if (!(await getCurrentEmployee())) {
    return NextResponse.json({ error: "Not authorised" }, { status: 401 });
  }
  const slug = new URL(req.url).searchParams.get("slug");
  const map = await getTargetsMap();
  if (slug) {
    return NextResponse.json({ slug, targets: map[slug] ?? [] });
  }
  return NextResponse.json({ targets: map });
}

export async function PUT(req: Request) {
  if (!(await getCurrentEmployee())) {
    return NextResponse.json({ error: "Not authorised" }, { status: 401 });
  }
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const slug =
    body && typeof body === "object"
      ? (body as { slug?: unknown }).slug
      : undefined;
  const targets =
    body && typeof body === "object"
      ? (body as { targets?: unknown }).targets
      : undefined;
  if (typeof slug !== "string" || !slug || !Array.isArray(targets)) {
    return NextResponse.json(
      { error: "Body must be { slug: string, targets: [...] }" },
      { status: 400 },
    );
  }
  try {
    const saved = await saveClientTargets(slug, targets);
    return NextResponse.json({ ok: true, slug, targets: saved });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Save failed: ${message}` }, { status: 500 });
  }
}
