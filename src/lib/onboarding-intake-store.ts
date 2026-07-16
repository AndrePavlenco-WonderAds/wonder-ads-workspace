// Submitted answers of the SEO onboarding form ("A Vossa Audiência e
// Conteúdo"), one record per client slug. Separate from `onboarding-store.ts`
// (which holds a single uploaded document) — this is the structured quiz
// payload that we also render into the branded answers PDF.

import { kv } from "@vercel/kv";

const KEY_PREFIX = "onboarding-intake:";

export const ONBOARDING_INTAKE_SCHEMA_VERSION = 1;

export type OnboardingIntakeFile = { url: string; name: string };

export type OnboardingIntake = {
  schemaVersion: number;
  /** Epoch ms when the client submitted the form. */
  submittedAt: number;
  /** short / long / "other" free-text answers, keyed by field name. */
  texts: Record<string, string>;
  /** checkbox selections, keyed by field name. */
  choices: Record<string, string[]>;
  /** uploaded files, keyed by field name. */
  files: Record<string, OnboardingIntakeFile[]>;
  /** Vercel Blob URL of the generated answers PDF, once produced. */
  pdfUrl?: string | null;
};

export const onboardingIntakeStorageConfigured = Boolean(
  process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN,
);

function key(slug: string): string {
  return `${KEY_PREFIX}${slug}`;
}

export async function getOnboardingIntake(
  slug: string,
): Promise<OnboardingIntake | null> {
  if (!onboardingIntakeStorageConfigured) return null;
  try {
    const stored = await kv.get<OnboardingIntake>(key(slug));
    return stored ?? null;
  } catch (err) {
    console.error("KV onboarding-intake read failed:", err);
    return null;
  }
}

export async function saveOnboardingIntake(
  slug: string,
  intake: OnboardingIntake,
): Promise<OnboardingIntake> {
  if (!onboardingIntakeStorageConfigured) {
    throw new Error("KV storage not configured on this deployment.");
  }
  await kv.set(key(slug), intake);
  return intake;
}
