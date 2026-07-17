// Per-client ADS connection config (Google Ads customer id + Meta ad account
// id). Gated behind the workspace session. The app-level API credentials live
// in env vars — this route only manages the per-client account identifiers.

import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getCurrentSession } from "@/lib/auth/server";
import {
  getAdsConnectionConfig,
  saveAdsConnectionConfig,
} from "@/lib/ads/ads-connections-store";
import { googleAdsConfigured, metaAdsConfigured } from "@/lib/ads/ads-data";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ slug: string }> },
) {
  if (!(await getCurrentSession())) {
    return NextResponse.json({ error: "Not authorised" }, { status: 401 });
  }
  const { slug } = await ctx.params;
  const config = await getAdsConnectionConfig(slug);
  return NextResponse.json({
    config,
    // Tell the UI whether the shared app-level credentials are present.
    appCreds: { google: googleAdsConfigured(), meta: metaAdsConfigured() },
  });
}

export async function POST(
  req: Request,
  ctx: { params: Promise<{ slug: string }> },
) {
  if (!(await getCurrentSession())) {
    return NextResponse.json({ error: "Not authorised" }, { status: 401 });
  }
  const { slug } = await ctx.params;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }
  const { googleCustomerId, metaAdAccountId } = (body ?? {}) as {
    googleCustomerId?: unknown;
    metaAdAccountId?: unknown;
  };

  try {
    const saved = await saveAdsConnectionConfig(
      slug,
      { googleCustomerId, metaAdAccountId },
      Date.now(),
    );
    revalidatePath(`/ads/${slug}`);
    return NextResponse.json({ ok: true, config: saved });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
