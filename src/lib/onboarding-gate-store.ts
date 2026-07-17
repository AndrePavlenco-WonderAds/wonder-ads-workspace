// Records a client's one-time confirmation, before starting onboarding, that
// they have signed the contract and paid the invoice. Legally-registered, so
// we persist it server-side (per slug) rather than in the browser.

import { kv } from "@vercel/kv";

const KEY_PREFIX = "onboarding-gate:";

export type OnboardingGate = {
  confirmedAt: number;
};

export const onboardingGateStorageConfigured = Boolean(
  process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN,
);

function key(slug: string): string {
  return `${KEY_PREFIX}${slug}`;
}

export async function getGateConfirmedAt(slug: string): Promise<number | null> {
  if (!onboardingGateStorageConfigured) return null;
  try {
    const rec = await kv.get<OnboardingGate>(key(slug));
    return rec && typeof rec.confirmedAt === "number" ? rec.confirmedAt : null;
  } catch (err) {
    console.error("KV onboarding-gate read failed:", err);
    return null;
  }
}

/** Confirm the gate (idempotent — keeps the first confirmation timestamp). */
export async function confirmGate(
  slug: string,
  nowMs: number,
): Promise<number> {
  if (!onboardingGateStorageConfigured) {
    throw new Error("KV storage not configured on this deployment.");
  }
  const existing = await getGateConfirmedAt(slug);
  if (existing) return existing;
  await kv.set(key(slug), { confirmedAt: nowMs } satisfies OnboardingGate);
  return nowMs;
}
