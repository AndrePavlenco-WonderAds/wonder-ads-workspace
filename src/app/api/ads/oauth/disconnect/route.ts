// Disconnect the agency OAuth for a platform. Session-gated.

import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getCurrentSession } from "@/lib/auth/server";
import { clearAdsOAuth } from "@/lib/ads/ads-oauth-store";

export const runtime = "nodejs";

export async function POST(req: Request) {
  if (!(await getCurrentSession())) {
    return NextResponse.json({ error: "Not authorised" }, { status: 401 });
  }
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }
  const platform = (body as { platform?: unknown })?.platform;
  if (platform !== "google" && platform !== "meta") {
    return NextResponse.json({ error: "unknown platform" }, { status: 400 });
  }
  await clearAdsOAuth(platform);
  revalidatePath("/ads", "layout");
  return NextResponse.json({ ok: true });
}
