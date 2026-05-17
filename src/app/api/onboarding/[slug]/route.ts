import { NextResponse } from "next/server";
import {
  deleteOnboardingForSlug,
  getOnboardingForSlug,
  saveOnboardingForSlug,
  onboardingStorageConfigured,
  type OnboardingDoc,
} from "@/lib/onboarding-store";

const MAX_NAME_LENGTH = 200;
const ALLOWED_CONTENT_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
  "text/markdown",
]);

function sanitize(raw: unknown): OnboardingDoc | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const { url, name, contentType, sizeBytes, uploadedAt } = o;
  if (typeof url !== "string" || !/^https?:\/\//i.test(url)) return null;
  if (typeof name !== "string" || name.trim().length === 0) return null;
  if (typeof contentType !== "string" || !ALLOWED_CONTENT_TYPES.has(contentType)) {
    return null;
  }
  return {
    url,
    name: name.trim().slice(0, MAX_NAME_LENGTH),
    contentType,
    sizeBytes: typeof sizeBytes === "number" ? sizeBytes : null,
    uploadedAt: typeof uploadedAt === "number" ? uploadedAt : Date.now(),
  };
}

export async function GET(
  _req: Request,
  context: { params: Promise<{ slug: string }> },
) {
  const { slug } = await context.params;
  const doc = await getOnboardingForSlug(slug);
  return NextResponse.json(doc);
}

export async function PUT(
  req: Request,
  context: { params: Promise<{ slug: string }> },
) {
  if (!onboardingStorageConfigured) {
    return NextResponse.json(
      { error: "Storage not configured" },
      { status: 503 },
    );
  }
  const { slug } = await context.params;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const clean = sanitize(body);
  if (!clean) {
    return NextResponse.json(
      { error: "Invalid onboarding document" },
      { status: 400 },
    );
  }
  try {
    const saved = await saveOnboardingForSlug(slug, clean);
    return NextResponse.json(saved);
  } catch (err) {
    console.error("onboarding save failed", err);
    return NextResponse.json(
      { error: "Storage write failed" },
      { status: 500 },
    );
  }
}

export async function DELETE(
  _req: Request,
  context: { params: Promise<{ slug: string }> },
) {
  const { slug } = await context.params;
  await deleteOnboardingForSlug(slug);
  return NextResponse.json({ ok: true });
}
