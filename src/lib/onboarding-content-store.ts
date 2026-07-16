// SuperAdmin-editable overrides for the onboarding CONTENT — the lessons
// "course" and the intake FORM. Each is a single KV blob holding the full
// structure. When absent (or malformed) we fall back to the static defaults
// baked into onboarding-lessons.ts / onboarding-questions.ts, so the flow
// always works out of the box and can never be bricked by a bad save.

import { kv } from "@vercel/kv";
import {
  DEFAULT_ONBOARDING_CATEGORIES,
  normalizeCourse,
  type OnboardingCategory,
} from "@/lib/onboarding-lessons";
import {
  DEFAULT_ONBOARDING_STEPS,
  normalizeSteps,
  type OnbStep,
} from "@/lib/onboarding-questions";

const COURSE_KEY = "onboarding-course";
const FORM_KEY = "onboarding-form";

export const onboardingContentStorageConfigured = Boolean(
  process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN,
);

/** Live course — KV override if valid, else the static default. */
export async function getCourse(): Promise<OnboardingCategory[]> {
  if (!onboardingContentStorageConfigured) return DEFAULT_ONBOARDING_CATEGORIES;
  try {
    const stored = await kv.get<unknown>(COURSE_KEY);
    if (stored == null) return DEFAULT_ONBOARDING_CATEGORIES;
    return normalizeCourse(stored) ?? DEFAULT_ONBOARDING_CATEGORIES;
  } catch (err) {
    console.error("KV onboarding-course read failed:", err);
    return DEFAULT_ONBOARDING_CATEGORIES;
  }
}

/** True if a saved override exists (used by the editor to show "personalizado"). */
export async function courseIsCustom(): Promise<boolean> {
  if (!onboardingContentStorageConfigured) return false;
  try {
    return (await kv.get<unknown>(COURSE_KEY)) != null;
  } catch {
    return false;
  }
}

export async function saveCourse(
  raw: unknown,
): Promise<OnboardingCategory[]> {
  if (!onboardingContentStorageConfigured) {
    throw new Error("KV storage not configured on this deployment.");
  }
  const normalized = normalizeCourse(raw);
  if (!normalized) throw new Error("Estrutura do curso inválida.");
  await kv.set(COURSE_KEY, normalized);
  return normalized;
}

/** Reset to the built-in default (deletes the override). */
export async function resetCourse(): Promise<void> {
  if (!onboardingContentStorageConfigured) return;
  await kv.del(COURSE_KEY);
}

/** Live form steps — KV override if valid, else the static default. */
export async function getFormSteps(): Promise<OnbStep[]> {
  if (!onboardingContentStorageConfigured) return DEFAULT_ONBOARDING_STEPS;
  try {
    const stored = await kv.get<unknown>(FORM_KEY);
    if (stored == null) return DEFAULT_ONBOARDING_STEPS;
    return normalizeSteps(stored) ?? DEFAULT_ONBOARDING_STEPS;
  } catch (err) {
    console.error("KV onboarding-form read failed:", err);
    return DEFAULT_ONBOARDING_STEPS;
  }
}

export async function formIsCustom(): Promise<boolean> {
  if (!onboardingContentStorageConfigured) return false;
  try {
    return (await kv.get<unknown>(FORM_KEY)) != null;
  } catch {
    return false;
  }
}

export async function saveFormSteps(raw: unknown): Promise<OnbStep[]> {
  if (!onboardingContentStorageConfigured) {
    throw new Error("KV storage not configured on this deployment.");
  }
  const normalized = normalizeSteps(raw);
  if (!normalized) throw new Error("Estrutura do formulário inválida.");
  await kv.set(FORM_KEY, normalized);
  return normalized;
}

export async function resetFormSteps(): Promise<void> {
  if (!onboardingContentStorageConfigured) return;
  await kv.del(FORM_KEY);
}
