import Link from "next/link";
import { ArrowUpRight, TrendingUp } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { AccessDenied } from "@/components/access-denied";
import { getCurrentEmployee } from "@/lib/auth/server";
import { accessibleDepts, editableDepts } from "@/lib/auth/credentials";
import { DepartmentHeader } from "@/components/department-header";
import { KpisCard } from "@/components/kpis-card";
import { SeoDirectoriesCard } from "@/components/seo-directories-card";
import { ClientCard } from "@/components/client-card";
import { WorldMap } from "@/components/world-map";
import { TypewriterPrompt } from "@/components/typewriter-prompt";
import { getSeoClients, slugify, type NotionClient } from "@/lib/notion";
import { getSeoOrganicVisitors30d } from "@/lib/ga4";
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
import { getLogoOverrides } from "@/lib/admin-client-logos-store";

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

  // Web designers get read-only SEO access — they see the client roster
  // and can open project pages, but the department-level tools (KPIs,
  // Directories, per-consultant roadmap boards) are for the SEO team.
  const readOnly = !editableDepts(employee).includes("seo");

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

  // Department-wide organic visitors (GA4, Organic Search, last 30 days).
  // Cached for 30 min so the page doesn't block on ~20 live GA4 calls.
  const organic = await getSeoOrganicVisitors30d(clients.map((c) => c.slug));

  // Custom uploaded logos override the static CLIENT_LOGOS map.
  const logoOverrides = await getLogoOverrides().catch(
    () => ({}) as Record<string, string>,
  );

  return (
    <PageShell>
      <DepartmentHeader
        title="SEO DPT"
        tagline="Crescimento orgânico no Google e nas IAs. Agência #1 de SEO & GEO em Portugal."
        count={clients.length || undefined}
        countLabel="clients"
        countSuffix={
          organic.configured ? (
            <OrganicVisitorsBadge total={organic.total} />
          ) : undefined
        }
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
                      {employee.isAdmin || employee.name === col.name ? (
                        <Link
                          href={`/seo/roadmaps/${slugify(col.name)}`}
                          className="group inline-flex items-baseline gap-1.5 text-white/80 transition hover:text-white"
                          title={`Open ${col.name}'s weekly roadmap overview`}
                        >
                          <span className="underline-offset-4 decoration-white/30 group-hover:underline">
                            {col.name}
                          </span>
                          <ArrowUpRight className="h-3 w-3 self-center opacity-0 transition group-hover:opacity-70" />
                        </Link>
                      ) : (
                        <span>{col.name}</span>
                      )}
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
                        logo={logoOverrides[c.slug] ?? getClientLogo(c.slug)}
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

      {!readOnly && (
        <section aria-label="SEO Directories" className="mt-12 sm:mt-16">
          <SeoDirectoriesCard />
        </section>
      )}

      {!readOnly && (
      <section aria-label="SEO DPT KPIs" className="mt-6 sm:mt-8">
        <KpisCard />
      </section>
      )}
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

/** Department-wide organic visitors pill, shown next to the clients
 *  count. Emerald accent so it reads as a growth signal. Number is the
 *  real GA4 organic-search users sum — only rendered when GA4 is
 *  configured and the total is > 0. */
function OrganicVisitorsBadge({ total }: { total: number }) {
  // Full number with thousands separators (e.g. "9,127") — no "k"
  // abbreviation, so the exact organic total is always visible.
  const display = total <= 0 ? "—" : total.toLocaleString("en-GB");
  return (
    <span
      className="animate-count-pop inline-flex items-center gap-2 rounded-full border border-emerald-400/35 bg-emerald-500/[0.10] px-3 py-1.5 text-emerald-100 backdrop-blur-md transition-all duration-300 hover:scale-105 hover:border-emerald-400/60 hover:bg-emerald-500/[0.16]"
      title={`${total.toLocaleString("en-GB")} organic visitors across all SEO clients (GA4 · Organic Search · last 30 days)`}
    >
      <TrendingUp className="h-3.5 w-3.5 text-emerald-300" strokeWidth={2.5} />
      <span className="text-base font-bold leading-none tracking-tight">
        {display}
      </span>
      <span className="text-base font-medium uppercase tracking-[0.16em] leading-none text-emerald-200/80">
        organic · 30d
      </span>
    </span>
  );
}
