// Registry of clients going through the onboarding flow. A single KV array.
//
// Two roles:
//   1. Resolve a client's display name/icon on the PUBLIC onboarding pages
//      before they exist as a full SEO project (getClientBySlug would 404).
//   2. Once a *new* client submits the onboarding form, they are "promoted"
//      and merged into the SEO board roster (see notion.ts) — this is the
//      "auto-create the SEO project on submit" step.
//
// Existing SEO clients (already in Notion / EXTRA_SEO_CLIENTS) can also have
// an onboarding record so the internal team view + progress hub work for
// them; those carry `isNew: false` and are never merged (they're already on
// the board).

import { kv } from "@vercel/kv";
import { normalizeServices, type OnbService } from "@/lib/onboarding-tracks";

const KEY = "onboarding-clients";
const MAX = 2000;

export type OnboardingClient = {
  slug: string;
  title: string;
  icon: string | null;
  /** Consultant display name (e.g. "André Pereira"), or null if unassigned. */
  consultant: string | null;
  /** Services the client signed up for — drives which tracks appear. */
  services?: OnbService[];
  /** true when this client is NOT yet a real SEO project (needs promotion). */
  isNew: boolean;
  /** Epoch ms this onboarding record was created. */
  createdAt: number;
  /** Epoch ms the client submitted the form (and, if new, was promoted). */
  promotedAt?: number | null;
};

export const onboardingClientsStorageConfigured = Boolean(
  process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN,
);

export async function getOnboardingClients(): Promise<OnboardingClient[]> {
  if (!onboardingClientsStorageConfigured) return [];
  try {
    const stored = await kv.get<OnboardingClient[]>(KEY);
    if (!Array.isArray(stored)) return [];
    return stored
      .filter(
        (c) => c && typeof c.slug === "string" && typeof c.title === "string",
      )
      .map((c) => ({ ...c, services: normalizeServices(c.services) }));
  } catch (err) {
    console.error("KV onboarding-clients read failed:", err);
    return [];
  }
}

export async function getOnboardingClient(
  slug: string,
): Promise<OnboardingClient | null> {
  const all = await getOnboardingClients();
  return all.find((c) => c.slug === slug) ?? null;
}

/** Only new clients who submitted the form — merged into the SEO board. */
export async function getPromotedOnboardingClients(): Promise<
  OnboardingClient[]
> {
  const all = await getOnboardingClients();
  return all.filter((c) => c.isNew && c.promotedAt);
}

/** Create or replace an onboarding record (keyed by slug). */
export async function upsertOnboardingClient(
  rec: OnboardingClient,
): Promise<OnboardingClient> {
  if (!onboardingClientsStorageConfigured) {
    throw new Error("KV storage not configured on this deployment.");
  }
  const all = await getOnboardingClients();
  const next = [rec, ...all.filter((c) => c.slug !== rec.slug)].slice(0, MAX);
  await kv.set(KEY, next);
  return rec;
}

/** Patch an existing record; no-op if the slug is unknown. */
export async function patchOnboardingClient(
  slug: string,
  patch: Partial<OnboardingClient>,
): Promise<OnboardingClient | null> {
  if (!onboardingClientsStorageConfigured) {
    throw new Error("KV storage not configured on this deployment.");
  }
  const all = await getOnboardingClients();
  const found = all.find((c) => c.slug === slug);
  if (!found) return null;
  const updated = { ...found, ...patch, slug: found.slug };
  await kv.set(
    KEY,
    all.map((c) => (c.slug === slug ? updated : c)),
  );
  return updated;
}

export async function removeOnboardingClient(slug: string): Promise<void> {
  if (!onboardingClientsStorageConfigured) return;
  const all = await getOnboardingClients();
  await kv.set(
    KEY,
    all.filter((c) => c.slug !== slug),
  );
}
