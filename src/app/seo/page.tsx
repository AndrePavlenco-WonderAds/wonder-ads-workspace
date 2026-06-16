import { PageShell } from "@/components/page-shell";
import { AccessDenied } from "@/components/access-denied";
import { getCurrentEmployee } from "@/lib/auth/server";
import { accessibleDepts } from "@/lib/auth/credentials";
import { DepartmentHeader } from "@/components/department-header";
import { KpisCard } from "@/components/kpis-card";
import { ClientCard } from "@/components/client-card";
import { WorldMap } from "@/components/world-map";
import { TypewriterPrompt } from "@/components/typewriter-prompt";
import { getSeoClients, type NotionClient } from "@/lib/notion";
import {
  CONSULTANT_ORDER,
  getConsultantForSlug,
} from "@/lib/client-overrides";
import { TIER_RANK } from "@/lib/client-tiers";
import {
  getClientLogo,
  getLogoBgMode,
  getLogoSizing,
} from "@/lib/client-meta";

export const metadata = {
  title: "SEO DPT — Wonder Ads Workspace",
};

// ISR — re-fetch from Notion every 60s.
export const revalidate = 60;

export default async function SeoPage() {
  // Dept gate — Web-only designers (Mike/Gustavo/Renan) can't open SEO.
  // SEO consultants + SuperAdmins pass; see accessibleDepts().
  const employee = await getCurrentEmployee();
  if (!employee || !accessibleDepts(employee).includes("seo")) {
    return (
      <PageShell>
        <AccessDenied
          title="No SEO access"
          description="The SEO department is open to SEO consultants and SuperAdmins. Web designers have access to the Web department instead."
          username={employee?.username}
        />
      </PageShell>
    );
  }

  let clients: NotionClient[] = [];
  let notionError: string | null = null;

  if (process.env.NOTION_API_KEY) {
    try {
      clients = await getSeoClients();
    } catch (err) {
      notionError =
        err instanceof Error ? err.message : "Failed to fetch clients";
    }
  } else {
    notionError = "NOTION_API_KEY not set";
  }

  // Group clients by consultant, then sort each column by tier
  // (growth → core → lite).
  // IMPORTANT: re-resolve consultant from slug at render time rather than
  // trusting c.consultant — getSeoClients() is wrapped in unstable_cache
  // (1h TTL) and the cached value can lag behind code-level consultant
  // renames in client-overrides.ts. Re-resolving here means any consultant
  // rename ships instantly, even before the cache evicts. The bug it fixes:
  // renaming "Yenisey" → "Yenisey R." dropped 5 clients off the board
  // because the cached consultant string didn't match the new column name.
  const grouped: Record<string, NotionClient[]> = {};
  for (const c of clients) {
    const consultant = getConsultantForSlug(c.slug);
    (grouped[consultant] ??= []).push({ ...c, consultant });
  }
  for (const list of Object.values(grouped)) {
    list.sort((a, b) => TIER_RANK[a.tier] - TIER_RANK[b.tier]);
  }

  const consultantColumns = CONSULTANT_ORDER.map((name) => ({
    name,
    clients: grouped[name] ?? [],
  })).filter((col) => col.clients.length > 0);

  return (
    <PageShell>
      <DepartmentHeader
        title="SEO DPT"
        tagline="Crescimento orgânico no Google e nas IAs. Agência #1 de SEO & GEO em Portugal."
        count={clients.length || undefined}
        countLabel="clients"
        rightSlot={<WorldMap />}
        extra={
          <TypewriterPrompt text="Which project are we working on now, boss?" />
        }
        large
      />

      <div className="mt-12 lg:mt-16">
        <section aria-label="Clients by Head Consultant">
          {notionError ? (
            <NotionFallback message={notionError} />
          ) : (
            <div className="grid grid-cols-1 gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {consultantColumns.map((col) => (
                <div key={col.name} className="space-y-5">
                  <header className="flex items-baseline justify-between border-b border-white/8 pb-3">
                    <h3 className="flex items-baseline gap-2 text-sm font-semibold uppercase tracking-[0.18em] text-white/70">
                      <span>{col.name}</span>
                    </h3>
                    <span className="text-xs font-medium uppercase tracking-[0.18em] text-white/35">
                      {col.clients.length}
                    </span>
                  </header>
                  <div className="space-y-4">
                    {col.clients.map((c, i) => (
                      <ClientCard
                        key={c.id}
                        title={c.title}
                        icon={c.icon}
                        logo={getClientLogo(c.slug)}
                        logoBgMode={getLogoBgMode(c.slug)}
                        logoSizing={getLogoSizing(c.slug)}
                        href={`/seo/${c.slug}`}
                        consultant={c.consultant}
                        palette={c.palette}
                        tier={c.tier}
                        index={i}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <section aria-label="SEO DPT KPIs" className="mt-12 sm:mt-16">
        <KpisCard />
      </section>
    </PageShell>
  );
}

function NotionFallback({ message }: { message: string }) {
  return (
    <div className="brand-gradient-border rounded-2xl bg-white/[0.035] p-6 backdrop-blur-md">
      <p className="text-sm uppercase tracking-[0.18em] text-white/45">
        Notion not connected
      </p>
      <p className="mt-3 max-w-xl text-white/70">
        Add <code className="rounded bg-white/10 px-1.5 py-0.5 text-sm">NOTION_API_KEY</code>{" "}
        as a Vercel environment variable and redeploy to load live client data
        from your SEO Space.
      </p>
      <p className="mt-3 text-xs text-white/35">Error: {message}</p>
    </div>
  );
}
