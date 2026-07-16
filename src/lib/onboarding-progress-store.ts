// Per-client progress through the onboarding "lessons" hub. One record per
// client slug, holding the set of completed lesson ids (see
// `onboarding-lessons.ts` for the catalogue).

import { kv } from "@vercel/kv";

const KEY_PREFIX = "onboarding-progress:";

export type OnboardingProgress = {
  /** Ids of the lessons the client has marked as completed. */
  completed: string[];
  /** Epoch ms of the last change. */
  updatedAt: number;
};

export const onboardingProgressStorageConfigured = Boolean(
  process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN,
);

function key(slug: string): string {
  return `${KEY_PREFIX}${slug}`;
}

function normalize(stored: unknown): OnboardingProgress {
  if (
    stored &&
    typeof stored === "object" &&
    Array.isArray((stored as OnboardingProgress).completed)
  ) {
    const rec = stored as OnboardingProgress;
    return {
      completed: rec.completed.filter((x) => typeof x === "string"),
      updatedAt: typeof rec.updatedAt === "number" ? rec.updatedAt : 0,
    };
  }
  return { completed: [], updatedAt: 0 };
}

export async function getOnboardingProgress(
  slug: string,
): Promise<OnboardingProgress> {
  if (!onboardingProgressStorageConfigured) return { completed: [], updatedAt: 0 };
  try {
    const stored = await kv.get<OnboardingProgress>(key(slug));
    return normalize(stored);
  } catch (err) {
    console.error("KV onboarding-progress read failed:", err);
    return { completed: [], updatedAt: 0 };
  }
}

/** Mark a lesson complete or incomplete; returns the updated record. */
export async function setLessonCompletion(
  slug: string,
  lessonId: string,
  done: boolean,
  nowMs: number,
): Promise<OnboardingProgress> {
  if (!onboardingProgressStorageConfigured) {
    throw new Error("KV storage not configured on this deployment.");
  }
  const current = await getOnboardingProgress(slug);
  const set = new Set(current.completed);
  if (done) set.add(lessonId);
  else set.delete(lessonId);
  const next: OnboardingProgress = {
    completed: Array.from(set),
    updatedAt: nowMs,
  };
  await kv.set(key(slug), next);
  return next;
}
