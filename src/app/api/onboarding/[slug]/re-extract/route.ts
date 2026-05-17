// POST /api/onboarding/[slug]/re-extract — re-run text extraction on the
// existing doc without forcing a re-upload. Useful when:
//   - The pdf-extract heuristics (competitor miner, suggestedSeed) improve
//     and we want to backfill existing client records.
//   - The PDF was uploaded before extraction was wired up and we want to
//     populate extractedText now.
//
// Re-uses the same extractor + sanitisation path as PUT so the resulting
// OnboardingDoc has identical shape.

import { NextResponse } from "next/server";
import {
  getOnboardingForSlug,
  saveOnboardingForSlug,
  onboardingStorageConfigured,
  type OnboardingDoc,
} from "@/lib/onboarding-store";
import { extractFromUrl } from "@/lib/pdf-extract";

export const maxDuration = 60;
export const runtime = "nodejs";

export async function POST(
  _req: Request,
  context: { params: Promise<{ slug: string }> },
) {
  if (!onboardingStorageConfigured) {
    return NextResponse.json(
      { error: "Storage not configured" },
      { status: 503 },
    );
  }
  const { slug } = await context.params;
  const existing = await getOnboardingForSlug(slug);
  if (!existing) {
    return NextResponse.json(
      { error: "No onboarding form on file to re-extract" },
      { status: 404 },
    );
  }
  let extracted = {
    text: "",
    competitors: [] as string[],
    suggestedSeed: null as string | null,
  };
  try {
    const result = await extractFromUrl(existing.url, existing.contentType);
    extracted = {
      text: result.text,
      competitors: result.competitors,
      suggestedSeed: result.suggestedSeed,
    };
  } catch (err) {
    console.error("onboarding re-extract failed:", err);
    return NextResponse.json(
      { error: `Re-extract failed: ${err instanceof Error ? err.message : String(err)}` },
      { status: 500 },
    );
  }
  const updated: OnboardingDoc = {
    ...existing,
    extractedText: extracted.text || null,
    competitors: extracted.competitors,
    suggestedSeed: extracted.suggestedSeed,
    extractedAt: extracted.text ? Date.now() : null,
  };
  try {
    const saved = await saveOnboardingForSlug(slug, updated);
    return NextResponse.json(saved);
  } catch (err) {
    console.error("onboarding re-extract save failed:", err);
    return NextResponse.json(
      { error: "Storage write failed" },
      { status: 500 },
    );
  }
}
