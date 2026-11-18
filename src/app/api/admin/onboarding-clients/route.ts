// Register / remove a client in the onboarding flow. SuperAdmin only.
//   POST   → start onboarding for a client (mints the public link). If the
//            client isn't already on the SEO board, they are flagged `isNew`
//            and get promoted onto it when they submit the form.
//   DELETE → remove an onboarding registration (?slug=…).

import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getCurrentSession, isCurrentUserAdmin } from "@/lib/auth/server";
import { slugify, getClientBySlug } from "@/lib/notion";
import {
  upsertOnboardingClient,
  removeOnboardingClient,
} from "@/lib/onboarding-clients-store";
import { normalizeServices } from "@/lib/onboarding-tracks";
import { effectiveUsername } from "@/lib/auth/session";
import { prospectPeople } from "@/lib/prospects/access";
import { ensureProspectFile } from "@/lib/prospects/store";

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
  const { title, consultant, icon, services, ecommerce, owner } = (body ?? {}) as {
    title?: unknown;
    consultant?: unknown;
    icon?: unknown;
    services?: unknown;
    ecommerce?: unknown;
    /** Username do comercial responsável (v80.0) — vai para a ficha. */
    owner?: unknown;
  };
  const cleanTitle = typeof title === "string" ? title.trim() : "";
  if (!cleanTitle) {
    return NextResponse.json({ error: "title required" }, { status: 400 });
  }
  const slug = slugify(cleanTitle);
  if (!slug) {
    return NextResponse.json({ error: "invalid title" }, { status: 400 });
  }
  const cleanServices = normalizeServices(services);
  if (cleanServices.length === 0) {
    return NextResponse.json(
      { error: "Selecione pelo menos um serviço." },
      { status: 400 },
    );
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
      services: cleanServices,
      ecommerce:
        Boolean(ecommerce) &&
        (cleanServices.includes("google-ads") ||
          cleanServices.includes("meta-ads")),
      isNew: !onBoard,
      createdAt: Date.now(),
      promotedAt: null,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }

  // FICHA DO PROSPECT (v80.0) — nasce com o onboarding, vazia, à espera das
  // notas do Comercial. Um onboarding recriado com o mesmo nome reaproveita
  // a ficha que já existia. Uma falha aqui não desfaz o onboarding: a ficha
  // cria-se sozinha na primeira escrita.
  const actor = effectiveUsername(await getCurrentSession()) ?? "?";
  const ownerUsername =
    typeof owner === "string" &&
    prospectPeople().some((p) => p.canOwn && p.username === owner)
      ? owner
      : null;
  let prospect = false;
  try {
    await ensureProspectFile(slug, cleanTitle, actor, ownerUsername);
    prospect = true;
  } catch (err) {
    console.error("prospect file create failed:", err);
  }

  revalidatePath(`/${slug}/onboarding`);
  return NextResponse.json({ ok: true, slug, onBoard, prospect });
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
