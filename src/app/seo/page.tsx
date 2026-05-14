import { PageShell } from "@/components/page-shell";
import { DepartmentHeader } from "@/components/department-header";
import { ClaudeChat } from "@/components/claude-chat";
import { KpisCard } from "@/components/kpis-card";
import { ClientCard } from "@/components/client-card";
import { WorldMap } from "@/components/world-map";
import { TypewriterPrompt } from "@/components/typewriter-prompt";
import { getSeoClients, type NotionClient } from "@/lib/notion";
import { CONSULTANT_ORDER } from "@/lib/client-overrides";
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
  const grouped: Record<string, NotionClient[]> = {};
  for (const c of clients) {
    (grouped[c.consultant] ??= []).push(c);
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
        tagline="Organic growth in Google and AIs. #1 SEO & GEO Agency in Portugal."
        count={clients.length || undefined}
        countLabel="clients"
        rightSlot={<WorldMap />}
        extra={<TypewriterPrompt text="What are we working on today, boss?" />}
        large
      />

      <div className="mt-12 grid grid-cols-1 gap-10 lg:mt-16 lg:grid-cols-[1fr_420px]">
        <section
          aria-label="Clients by Head Consultant"
          className="order-2 lg:order-1"
        >
          {notionError ? (
            <NotionFallback message={notionError} />
          ) : (
            <div className="grid grid-cols-1 gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
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
        <div className="order-1 lg:order-2 lg:sticky lg:top-6 lg:self-start">
          <ClaudeChat
            department="seo"
            placeholder="Ask SEO Claude — strategy, audits, briefs..."
          />
        </div>
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
