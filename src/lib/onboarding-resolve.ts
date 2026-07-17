// Resolve a client for the public onboarding pages. A client may be:
//   • an existing SEO project (in getSeoClients), or
//   • a brand-new client that only exists in the onboarding registry yet
//     (before they submit the form and get promoted onto the board).
// Either way we need a title + icon to render the hub / lessons / form.

import "server-only";
import { getClientBySlug } from "@/lib/notion";
import { getClientLogo } from "@/lib/client-meta";
import { getConsultantForSlug } from "@/lib/client-overrides";
import { getOnboardingClient } from "@/lib/onboarding-clients-store";
import { tracksForServices, type OnbService } from "@/lib/onboarding-tracks";

export type ResolvedOnboardingClient = {
  slug: string;
  title: string;
  icon: string | null;
  /** Uploaded/known logo image URL, if any. */
  logo: string | null;
  consultant: string | null;
  /** true when this is already a real SEO project. */
  onBoard: boolean;
  /** Services the client signed up for (defaults to SEO). */
  services: OnbService[];
  /** Active content tracks derived from the services. */
  tracks: ("seo" | "ads")[];
  /** Whether the Ads onboarding is for an e-commerce business. */
  ecommerce: boolean;
};

export async function resolveOnboardingClient(
  slug: string,
): Promise<ResolvedOnboardingClient | null> {
  const [seo, reg] = await Promise.all([
    getClientBySlug(slug).catch(() => null),
    getOnboardingClient(slug),
  ]);
  if (!seo && !reg) return null;

  // Services come from the onboarding record if one exists, else default to
  // SEO (so pre-existing board clients keep the original flow).
  const services = reg?.services?.length ? reg.services : ["seo" as OnbService];
  const tracks = tracksForServices(services);
  const ecommerce = Boolean(reg?.ecommerce);

  if (seo) {
    const consultant = getConsultantForSlug(slug);
    return {
      slug,
      title: seo.title,
      icon: seo.icon,
      logo: getClientLogo(slug),
      consultant:
        reg?.consultant ??
        (consultant && consultant !== "Unassigned" ? consultant : null),
      onBoard: true,
      services,
      tracks,
      ecommerce,
    };
  }

  return {
    slug,
    title: reg!.title,
    icon: reg!.icon,
    logo: getClientLogo(slug),
    consultant: reg!.consultant,
    onBoard: false,
    services,
    tracks,
    ecommerce,
  };
}
