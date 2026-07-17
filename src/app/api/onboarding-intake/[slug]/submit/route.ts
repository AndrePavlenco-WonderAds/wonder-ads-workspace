// Public endpoint (no auth — outside the middleware matcher) that receives a
// submitted onboarding form (SEO or Ads). It:
//   1. validates + merges the answers into the client's intake (so a SEO and
//      an Ads submission coexist),
//   2. regenerates the branded answers PDF (all of the client's forms) and
//      attaches it to the "Onboarding Form" zone on the SEO project page,
//   3. promotes a brand-new client onto the SEO board ("auto-create project"),
//   4. marks the submitted form's lesson complete in the onboarding hub,
//   5. revalidates the affected pages.

import { NextResponse } from "next/server";
import { revalidatePath, revalidateTag } from "next/cache";
import { put } from "@vercel/blob";
import {
  flattenFields,
  requiredNames,
  otherKeysOf,
  stepsForForm,
  stepTrack,
  isCheckbox,
  isFile,
} from "@/lib/onboarding-questions";
import { getFormSteps } from "@/lib/onboarding-content-store";
import {
  getOnboardingIntake,
  saveOnboardingIntake,
  ONBOARDING_INTAKE_SCHEMA_VERSION,
  type OnboardingIntake,
  type OnboardingIntakeFile,
} from "@/lib/onboarding-intake-store";
import { saveOnboardingForSlug } from "@/lib/onboarding-store";
import { buildOnboardingPdf } from "@/lib/onboarding-pdf";
import { resolveOnboardingClient } from "@/lib/onboarding-resolve";
import {
  getOnboardingClient,
  patchOnboardingClient,
} from "@/lib/onboarding-clients-store";
import { setLessonCompletion } from "@/lib/onboarding-progress-store";

export const runtime = "nodejs";
export const maxDuration = 60;

const asString = (v: unknown): string => (typeof v === "string" ? v : "");
const asStringArray = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];

function sanitizeFiles(v: unknown): OnboardingIntakeFile[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter(
      (f): f is OnboardingIntakeFile =>
        !!f &&
        typeof f === "object" &&
        typeof (f as OnboardingIntakeFile).url === "string" &&
        typeof (f as OnboardingIntakeFile).name === "string",
    )
    .map((f) => ({ url: f.url, name: f.name }))
    .slice(0, 20);
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
  const raw = (body ?? {}) as {
    texts?: Record<string, unknown>;
    choices?: Record<string, unknown>;
    files?: Record<string, unknown>;
    track?: unknown;
    lessonId?: unknown;
  };

  const submittedTrack = raw.track === "ads" ? "ads" : "seo";
  const lessonId =
    typeof raw.lessonId === "string" && raw.lessonId
      ? raw.lessonId
      : submittedTrack === "ads"
        ? "form-ads"
        : "form";

  // Full catalogue (KV override or default); this submission only covers the
  // fields of the submitted form (track).
  const allSteps = await getFormSteps();
  const formSteps = stepsForForm(allSteps, {
    track: submittedTrack,
    ecommerce: client.ecommerce,
  });
  const fields = flattenFields(formSteps);

  // Rebuild each collection from the submitted form's field catalogue (ignore
  // anything the client sends that we don't recognise).
  const texts: Record<string, string> = {};
  const choices: Record<string, string[]> = {};
  const files: Record<string, OnboardingIntakeFile[]> = {};

  for (const field of fields) {
    if (isCheckbox(field)) {
      const picked = asStringArray(raw.choices?.[field.name]).filter((v) =>
        field.options.some((o) => o.value === v),
      );
      if (picked.length) choices[field.name] = picked;
    } else if (isFile(field)) {
      const f = sanitizeFiles(raw.files?.[field.name]);
      if (f.length) files[field.name] = f;
    } else {
      const t = asString(raw.texts?.[field.name]).trim();
      if (t) texts[field.name] = t;
    }
  }
  // "Other" free-text answers (keyed field__option).
  for (const key of otherKeysOf(formSteps)) {
    const t = asString(raw.texts?.[key]).trim();
    if (t) texts[key] = t;
  }

  // Server-side required-field check (for this form only).
  const missing = requiredNames(formSteps).filter((name) => {
    const field = fields.find((f) => f.name === name);
    if (!field) return false;
    if (isCheckbox(field)) return (choices[name]?.length ?? 0) === 0;
    if (isFile(field)) return (files[name]?.length ?? 0) === 0;
    return !(texts[name] && texts[name].trim());
  });
  if (missing.length) {
    return NextResponse.json({ error: "missing_required", missing }, { status: 400 });
  }

  // Merge into any existing intake so the other form's answers survive.
  const existing = await getOnboardingIntake(slug);
  const now = Date.now();
  const intake: OnboardingIntake = {
    schemaVersion: ONBOARDING_INTAKE_SCHEMA_VERSION,
    submittedAt: now,
    texts: { ...(existing?.texts ?? {}), ...texts },
    choices: { ...(existing?.choices ?? {}), ...choices },
    files: { ...(existing?.files ?? {}), ...files },
    pdfUrl: existing?.pdfUrl ?? null,
  };

  try {
    await saveOnboardingIntake(slug, intake);
  } catch (err) {
    console.error("onboarding intake save failed:", err);
    return NextResponse.json({ error: "storage" }, { status: 500 });
  }

  // Regenerate the branded PDF from every form the client has (their tracks).
  try {
    const clientSteps = allSteps.filter(
      (s) =>
        (client.tracks as string[]).includes(stepTrack(s)) &&
        (!s.ecommerce || client.ecommerce),
    );
    const pdfBytes = await buildOnboardingPdf({
      clientTitle: client.title,
      intake,
      steps: clientSteps,
    });
    const blob = await put(
      `onboarding/${slug}/formulario-${now}.pdf`,
      Buffer.from(pdfBytes),
      { access: "public", contentType: "application/pdf", addRandomSuffix: true },
    );
    intake.pdfUrl = blob.url;
    await saveOnboardingIntake(slug, intake);
    await saveOnboardingForSlug(slug, {
      url: blob.url,
      name: `Formulário de Onboarding — ${client.title}.pdf`,
      contentType: "application/pdf",
      sizeBytes: pdfBytes.byteLength,
      uploadedAt: now,
    });
  } catch (err) {
    // Non-fatal: the answers are stored; the PDF can be regenerated later.
    console.error("onboarding PDF generation failed:", err);
  }

  // Promote a brand-new client onto the SEO board.
  try {
    const reg = await getOnboardingClient(slug);
    if (reg && reg.isNew && !reg.promotedAt) {
      await patchOnboardingClient(slug, { promotedAt: now });
      revalidateTag("seo-clients");
    }
  } catch (err) {
    console.error("onboarding promote failed:", err);
  }

  // Mark the submitted form's lesson complete in the hub.
  try {
    await setLessonCompletion(slug, lessonId, true, now);
  } catch (err) {
    console.error("onboarding progress update failed:", err);
  }

  revalidatePath(`/seo/${slug}`);
  revalidatePath(`/${slug}/onboarding`);
  revalidatePath(`/${slug}/onboarding/${lessonId}`);

  return NextResponse.json({ ok: true, pdfUrl: intake.pdfUrl });
}
