// Register / remove a client in the onboarding flow. SuperAdmin only.
//   POST   → start onboarding for a client (mints the public link). If the
//            client isn't already on the SEO board, they are flagged `isNew`
//            and get promoted onto it when they submit the form.
//   DELETE → remove an onboarding registration (?slug=…).

import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { isCurrentUserAdmin } from "@/lib/auth/server";
import { slugify, getClientBySlug } from "@/lib/notion";
import {
  upsertOnboardingClient,
  removeOnboardingClient,
} from "@/lib/onboarding-clients-store";

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
  const { title, consultant, icon } = (body ?? {}) as {
    title?: unknown;
    consultant?: unknown;
    icon?: unknown;
  };
  const cleanTitle = typeof title === "string" ? title.trim() : "";
  if (!cleanTitle) {
    return NextResponse.json({ error: "title required" }, { status: 400 });
  }
  const slug = slugify(cleanTitle);
  if (!slug) {
    return NextResponse.json({ error: "invalid title" }, { status: 400 });
  }

  const onBoard = Boolean(await getClientBySlug(slug).catch(() => null));

  try {
    await upsertOnboardingClient({
      slug,
      title: cleanTitle,
      icon: typeof icon === "string" && icon.trim() ? icon.trim() : null,
      consultant:
        typeof consultant === "string" && consultant.trim()
          ? consultant.trim()
          : null,
      isNew: !onBoard,
      createdAt: Date.now(),
      promotedAt: null,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }

  revalidatePath(`/${slug}/onboarding`);
  return NextResponse.json({ ok: true, slug, onBoard });
}

export async function DELETE(req: Request) {
  if (!(await isCurrentUserAdmin())) {
    return NextResponse.json(
      { error: "Não há permissões suficientes." },
      { status: 403 },
    );
  }
  const slug = new URL(req.url).searchParams.get("slug");
  if (!slug) {
    return NextResponse.json({ error: "slug required" }, { status: 400 });
  }
  try {
    await removeOnboardingClient(slug);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
