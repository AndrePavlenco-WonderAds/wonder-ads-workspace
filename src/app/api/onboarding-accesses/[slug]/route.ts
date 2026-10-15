// Public endpoint (no auth — outside INTERNAL_PREFIXES, like the other
// /api/onboarding-* routes) where the client submits the credentials asked
// by an "access" lesson of the onboarding (v77.96: the website host).
//
// WRITE-ONLY. The entries land in the client's vault (accesses:<slug>, the
// «Accesses» section at the bottom of /seo/<slug>) and the response never
// echoes anything stored there — the public page only ever sees the
// label + date receipt. Re-submitting replaces what THIS lesson had sent;
// entries the team added by hand are never touched.
//
// No revalidatePath: the onboarding pages are force-dynamic (router.refresh
// on the client picks up the new state) and the vault on /seo/<slug> is
// fetched client-side.

import { NextResponse } from "next/server";
import { findLesson } from "@/lib/onboarding-lessons";
import { getCourse } from "@/lib/onboarding-content-store";
import { resolveOnboardingClient } from "@/lib/onboarding-resolve";
import { setLessonCompletion } from "@/lib/onboarding-progress-store";
import { replaceOnboardingAccesses } from "@/lib/client-accesses-store";

export const runtime = "nodejs";

const MAX_ENTRIES = 3;

function str(v: unknown, max: number): string {
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}

/** "dominios.pt/area-cliente" → "https://dominios.pt/area-cliente". Anything
 *  that still doesn't parse as an http(s) URL is rejected. */
function normaliseUrl(raw: string): string | null {
  if (!raw) return null;
  const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  try {
    const u = new URL(withScheme);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    if (!u.hostname.includes(".")) return null;
    return u.toString();
  } catch {
    return null;
  }
}

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
  const b = (body ?? {}) as {
    lessonId?: unknown;
    mode?: unknown;
    entries?: unknown;
    thirdParty?: unknown;
  };

  const lesson =
    typeof b.lessonId === "string" ? findLesson(await getCourse(), b.lessonId) : null;
  if (!lesson || lesson.kind !== "access") {
    return NextResponse.json({ error: "unknown lesson" }, { status: 400 });
  }
  const prefix = lesson.accessLabel?.trim() || lesson.title;

  type Partial = {
    label: string;
    url: string | null;
    username: string | null;
    password: string | null;
    notes: string | null;
  };
  const out: Partial[] = [];

  if (b.mode === "third-party") {
    const tp = (b.thirdParty ?? {}) as Record<string, unknown>;
    const provider = str(tp.provider, 80);
    const contact = str(tp.contact, 1500);
    if (contact.length < 5) {
      return NextResponse.json({ error: "missing_contact" }, { status: 400 });
    }
    out.push({
      label: `${prefix} — ${provider || "gerido por terceiros"}`.slice(0, 120),
      url: null,
      username: null,
      password: null,
      notes: `Gerido por outra pessoa/empresa. Contacto indicado pelo cliente:\n${contact}`,
    });
  } else {
    const rawEntries = Array.isArray(b.entries) ? b.entries.slice(0, MAX_ENTRIES) : [];
    for (const raw of rawEntries) {
      const e = (raw ?? {}) as Record<string, unknown>;
      const provider = str(e.provider, 80);
      const url = normaliseUrl(str(e.url, 600));
      const username = str(e.username, 200);
      // A password não leva trim — um espaço pode fazer parte dela.
      const password =
        typeof e.password === "string" ? e.password.slice(0, 400) : "";
      const notes = str(e.notes, 2000);
      if (!provider || !url || !username || !password) {
        return NextResponse.json({ error: "missing_fields" }, { status: 400 });
      }
      out.push({
        label: `${prefix} — ${provider}`.slice(0, 120),
        url,
        username,
        password,
        notes: notes || null,
      });
    }
    if (out.length === 0) {
      return NextResponse.json({ error: "missing_fields" }, { status: 400 });
    }
  }

  try {
    await replaceOnboardingAccesses(slug, lesson.id, out);
    await setLessonCompletion(slug, lesson.id, true, Date.now());
    return NextResponse.json({ ok: true, count: out.length });
  } catch (err) {
    console.error("onboarding accesses write failed:", err);
    return NextResponse.json({ error: "storage" }, { status: 500 });
  }
}
