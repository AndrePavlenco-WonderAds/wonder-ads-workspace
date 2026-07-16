// Save / reset the editable onboarding CONTENT (lessons course + intake form).
// SuperAdmin only. The stores normalise + validate the payload and throw on a
// structurally invalid save, so a bad edit can never brick the flow.
//   POST   { kind: "course" | "form", data }  → save
//   DELETE ?kind=course|form                  → reset to the built-in default

import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { isCurrentUserAdmin } from "@/lib/auth/server";
import {
  saveCourse,
  resetCourse,
  saveFormSteps,
  resetFormSteps,
} from "@/lib/onboarding-content-store";

export const runtime = "nodejs";

export async function POST(req: Request) {
  if (!(await isCurrentUserAdmin())) {
    return NextResponse.json(
      { error: "Não há permissões suficientes." },
      { status: 403 },
    );
  }
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }
  const { kind, data } = (body ?? {}) as { kind?: unknown; data?: unknown };

  try {
    if (kind === "course") {
      const saved = await saveCourse(data);
      revalidatePath("/seo/onboarding-editor");
      return NextResponse.json({ ok: true, data: saved });
    }
    if (kind === "form") {
      const saved = await saveFormSteps(data);
      revalidatePath("/seo/onboarding-editor");
      return NextResponse.json({ ok: true, data: saved });
    }
    return NextResponse.json({ error: "unknown kind" }, { status: 400 });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(req: Request) {
  if (!(await isCurrentUserAdmin())) {
    return NextResponse.json(
      { error: "Não há permissões suficientes." },
      { status: 403 },
    );
  }
  const kind = new URL(req.url).searchParams.get("kind");
  try {
    if (kind === "course") await resetCourse();
    else if (kind === "form") await resetFormSteps();
    else return NextResponse.json({ error: "unknown kind" }, { status: 400 });
    revalidatePath("/seo/onboarding-editor");
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
