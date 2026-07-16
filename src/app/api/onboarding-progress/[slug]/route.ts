// Public endpoint (no auth — outside the middleware matcher) to mark an
// onboarding lesson complete / incomplete. Updates the per-client progress
// record and revalidates the hub, the lesson page and the internal project
// view so completion reflects everywhere.

import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { findLesson } from "@/lib/onboarding-lessons";
import { resolveOnboardingClient } from "@/lib/onboarding-resolve";
import { setLessonCompletion } from "@/lib/onboarding-progress-store";

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
  const { lessonId, done } = (body ?? {}) as {
    lessonId?: unknown;
    done?: unknown;
  };
  if (typeof lessonId !== "string" || !findLesson(lessonId)) {
    return NextResponse.json({ error: "unknown lesson" }, { status: 400 });
  }

  try {
    const updated = await setLessonCompletion(
      slug,
      lessonId,
      Boolean(done),
      Date.now(),
    );
    revalidatePath(`/${slug}/onboarding`);
    revalidatePath(`/${slug}/onboarding/${lessonId}`);
    revalidatePath(`/seo/${slug}`);
    return NextResponse.json({ ok: true, completed: updated.completed });
  } catch (err) {
    console.error("onboarding progress write failed:", err);
    return NextResponse.json({ error: "storage" }, { status: 500 });
  }
}
