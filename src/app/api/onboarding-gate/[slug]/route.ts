// Public endpoint (no auth — outside the middleware matcher) to record the
// client's one-time confirmation that they've signed the contract and paid the
// invoice, before starting onboarding.

import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { resolveOnboardingClient } from "@/lib/onboarding-resolve";
import { confirmGate } from "@/lib/onboarding-gate-store";

export const runtime = "nodejs";

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
  const confirmation = (body as { confirmation?: unknown })?.confirmation;
  if (
    typeof confirmation !== "string" ||
    confirmation.trim().toLowerCase() !== "confirmar"
  ) {
    return NextResponse.json({ error: "not_confirmed" }, { status: 400 });
  }

  try {
    const at = await confirmGate(slug, Date.now());
    revalidatePath(`/${slug}/onboarding`);
    return NextResponse.json({ ok: true, confirmedAt: at });
  } catch (err) {
    console.error("onboarding gate confirm failed:", err);
    return NextResponse.json({ error: "storage" }, { status: 500 });
  }
}
