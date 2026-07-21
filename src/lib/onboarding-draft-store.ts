// Draft (in-progress) onboarding-form answers, saved BEFORE the client
// submits. Lets someone fill half the form, leave, and come back the next
// day (even on another device) with their progress restored. Kept fully
// separate from the final intake store (onboarding-intake-store.ts) so a
// draft never triggers the PDF/promotion side-effects of a real submit.
//
// One KV key per (slug, track) so the general / SEO / Ads forms don't
// clobber each other. Auto-expires after 90 days of inactivity.

import { kv } from "@vercel/kv";

const keyFor = (slug: string, track: string) =>
  `onboarding-draft:${slug}:${track}`;
const TTL_SECONDS = 60 * 60 * 24 * 90; // 90 days

export type OnboardingDraftFile = { url: string; name: string };

export type OnboardingDraft = {
  texts: Record<string, string>;
  choices: Record<string, string[]>;
  files: Record<string, OnboardingDraftFile[]>;
  /** Step index the client had reached, so we can resume where they left off. */
  step: number;
  /** Epoch ms of the last save. */
  updatedAt: number;
};

export const onboardingDraftStorageConfigured = Boolean(
  process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN,
);

export async function getOnboardingDraft(
  slug: string,
  track: string,
): Promise<OnboardingDraft | null> {
  if (!onboardingDraftStorageConfigured) return null;
  try {
    return (await kv.get<OnboardingDraft>(keyFor(slug, track))) ?? null;
  } catch (err) {
    console.error("KV onboarding-draft read failed:", err);
    return null;
  }
}

export async function saveOnboardingDraft(
  slug: string,
  track: string,
  draft: OnboardingDraft,
): Promise<void> {
  if (!onboardingDraftStorageConfigured) {
    throw new Error("KV storage not configured on this deployment.");
  }
  await kv.set(keyFor(slug, track), draft, { ex: TTL_SECONDS });
}

export async function clearOnboardingDraft(
  slug: string,
  track: string,
): Promise<void> {
  if (!onboardingDraftStorageConfigured) return;
  try {
    await kv.del(keyFor(slug, track));
  } catch (err) {
    console.error("KV onboarding-draft delete failed:", err);
  }
}
