import { Search } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { DepartmentHeader } from "@/components/department-header";
import { ClaudeChat } from "@/components/claude-chat";
import { KpisCard } from "@/components/kpis-card";
import { ClientCard } from "@/components/client-card";
import { getSeoClients, type NotionClient } from "@/lib/notion";

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

  return (
    <PageShell>
      <DepartmentHeader
        title="SEO DPT"
        tagline="Organic growth in Google and AIs. #1 SEO & GEO Agency in Portugal."
        Icon={Search}
      />

      <div className="mt-12 grid grid-cols-1 gap-10 lg:mt-16 lg:grid-cols-[1fr_420px]">
        <div className="order-2 space-y-10 lg:order-1">
          <section aria-label="Clients">
            <header className="mb-5 flex items-baseline justify-between">
              <h2 className="text-sm font-medium uppercase tracking-[0.18em] text-white/55">
                Clients
              </h2>
              <span className="text-xs text-white/35">
                {clients.length || "—"}
              </span>
            </header>

            {notionError ? (
              <NotionFallback message={notionError} />
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {clients.map((c, i) => (
                  <ClientCard
                    key={c.id}
                    title={c.title}
                    icon={c.icon}
                    href={`/seo/${c.slug}`}
                    index={i}
                  />
                ))}
              </div>
            )}
          </section>

          <KpisCard />
        </div>
        <div className="order-1 lg:order-2 lg:sticky lg:top-6 lg:self-start">
          <ClaudeChat
            department="seo"
            placeholder="Ask SEO Claude — strategy, audits, briefs..."
          />
        </div>
      </div>
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
