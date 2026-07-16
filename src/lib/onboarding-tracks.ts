// Onboarding "tracks" — the flow a client sees is composed from the services
// they signed up for. SEO → track "seo"; Google/Meta Ads → track "ads".
// Content tagged "common" (welcome, strategy session, thank-you) shows in
// every flow. Combining SEO + Ads yields a flow with steps from both.

export type OnbTrack = "seo" | "ads" | "common";
export type OnbService = "seo" | "google-ads" | "meta-ads";

export const ONBOARDING_SERVICES: { value: OnbService; label: string }[] = [
  { value: "seo", label: "Consultoria SEO" },
  { value: "google-ads", label: "Consultoria Google Ads" },
  { value: "meta-ads", label: "Consultoria Meta Ads" },
];

const VALID_SERVICES = new Set<string>(["seo", "google-ads", "meta-ads"]);

export function normalizeServices(raw: unknown): OnbService[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: OnbService[] = [];
  for (const x of raw) {
    if (typeof x === "string" && VALID_SERVICES.has(x) && !seen.has(x)) {
      seen.add(x);
      out.push(x as OnbService);
    }
  }
  return out;
}

/** The active content tracks for a set of services. Defaults to SEO so
 *  pre-existing clients (no services on file) keep the original flow. */
export function tracksForServices(services: string[]): ("seo" | "ads")[] {
  const t: ("seo" | "ads")[] = [];
  if (services.includes("seo")) t.push("seo");
  if (services.includes("google-ads") || services.includes("meta-ads"))
    t.push("ads");
  return t.length ? t : ["seo"];
}

export function servicesLabel(services: string[]): string {
  const labels = ONBOARDING_SERVICES.filter((s) =>
    services.includes(s.value),
  ).map((s) => s.label);
  return labels.length ? labels.join(" · ") : "Consultoria SEO";
}
