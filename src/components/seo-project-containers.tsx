import { QuickActionsPanel } from "./quick-actions-panel";
import { TrackedKeywords } from "./tracked-keywords";
import { Ga4Metrics } from "./ga4-metrics";

export function SeoProjectContainers({
  slug,
  clientName,
  clientSlug,
}: {
  slug: string;
  clientName: string;
  clientSlug: string;
}) {
  return (
    <section
      aria-label="Project tools"
      className="grid grid-cols-1 gap-5 lg:grid-cols-3"
    >
      <QuickActionsPanel clientSlug={clientSlug} />
      <Ga4Metrics slug={slug} clientName={clientName} />
      <TrackedKeywords slug={slug} clientName={clientName} />
    </section>
  );
}
