// Per-client onboarding-form upload — single slot, separate from the
// general ClientFiles library. The form drives keyword research + other AI
// actions so it's worth treating as a first-class document, not just another
// file in the gallery.

import { kv } from "@vercel/kv";

const KEY_PREFIX = "onboarding:";

export type OnboardingDoc = {
  /** Vercel Blob URL. */
  url: string;
  /** Original filename (what the user uploaded). */
  name: string;
  /** Detected content type, e.g. "application/pdf". */
  contentType: string;
  /** Size in bytes (best-effort from the browser). */
  sizeBytes: number | null;
  /** Epoch ms when this was uploaded. */
  uploadedAt: number;
  /** Plain-text extraction of the doc (PDF → text via unpdf, or the raw
   *  TXT/MD content). Populated server-side after upload. AI actions read
   *  this to anchor on what the client actually wrote. */
  extractedText?: string | null;
  /** Competitor URLs/domains the client named in the form (regex-mined from
   *  extractedText). Used to fetch each competitor's keyword footprint. */
  competitors?: string[];
  /** Epoch ms when extraction last ran. Lets us skip re-extracting on every
   *  read. */
  extractedAt?: number | null;
};

export const onboardingStorageConfigured = Boolean(
  process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN,
);

export async function getOnboardingForSlug(
  slug: string,
): Promise<OnboardingDoc | null> {
  if (!onboardingStorageConfigured) return null;
  try {
    const stored = await kv.get<OnboardingDoc>(`${KEY_PREFIX}${slug}`);
    return stored ?? null;
  } catch (err) {
    console.error("KV onboarding read failed:", err);
    return null;
  }
}

export async function saveOnboardingForSlug(
  slug: string,
  doc: OnboardingDoc,
): Promise<OnboardingDoc> {
  if (!onboardingStorageConfigured) {
    throw new Error("KV storage not configured on this deployment.");
  }
  await kv.set(`${KEY_PREFIX}${slug}`, doc);
  return doc;
}

export async function deleteOnboardingForSlug(slug: string): Promise<void> {
  if (!onboardingStorageConfigured) return;
  await kv.del(`${KEY_PREFIX}${slug}`);
}
