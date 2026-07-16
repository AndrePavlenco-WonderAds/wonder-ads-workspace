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

export type ResolvedOnboardingClient = {
  slug: string;
  title: string;
  icon: string | null;
  /** Uploaded/known logo image URL, if any. */
  logo: string | null;
  consultant: string | null;
  /** true when this is already a real SEO project. */
  onBoard: boolean;
};

export async function resolveOnboardingClient(
  slug: string,
): Promise<ResolvedOnboardingClient | null> {
  const seo = await getClientBySlug(slug).catch(() => null);
  if (seo) {
    const consultant = getConsultantForSlug(slug);
    return {
      slug,
      title: seo.title,
      icon: seo.icon,
      logo: getClientLogo(slug),
      consultant: consultant && consultant !== "Unassigned" ? consultant : null,
      onBoard: true,
    };
  }

  const reg = await getOnboardingClient(slug);
  if (reg) {
    return {
      slug,
      title: reg.title,
      icon: reg.icon,
      logo: getClientLogo(slug),
      consultant: reg.consultant,
      onBoard: false,
    };
  }

  return null;
}
