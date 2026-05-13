import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { ClientBrief } from "@/components/client-brief";
import { SeoProjectContainers } from "@/components/seo-project-containers";
import { LogoChip } from "@/components/logo-chip";
import { getBriefForSlug } from "@/lib/briefs-storage";
import { getClientBySlug, getSeoClients } from "@/lib/notion";
import {
  getClientWebsite,
  displayDomain,
  getClientLogo,
  getLogoBgMode,
} from "@/lib/client-meta";
import { getClientPalette, paletteToGradient } from "@/lib/client-colors";

export const revalidate = 60;

export async function generateStaticParams() {
  if (!process.env.NOTION_API_KEY) return [];
  try {
    const clients = await getSeoClients();
    return clients.map((c) => ({ slug: c.slug }));
  } catch {
    return [];
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const client = await getClientBySlug(slug).catch(() => null);
  return {
    title: client
      ? `${client.title} — SEO DPT · Wonder Ads`
      : "Client — Wonder Ads Workspace",
  };
}

export default async function ClientPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  if (!process.env.NOTION_API_KEY) {
    return (
      <PageShell>
        <BackLink />
        <NotConfigured />
      </PageShell>
    );
  }

  const client = await getClientBySlug(slug);
  if (!client) notFound();

  const brief = await getBriefForSlug(slug);
  const notionUrl = `https://www.notion.so/${client.id.replace(/-/g, "")}`;
  const website = getClientWebsite(slug);
  const logo = getClientLogo(slug);
  const logoBgMode = getLogoBgMode(slug);
  const gradient = paletteToGradient(getClientPalette(slug));

  return (
    <PageShell>
      <BackLink />

      <section className="animate-fade-up mt-10 flex flex-wrap items-start justify-between gap-5 sm:mt-14">
        <div className="flex items-center gap-5">
          <div className="shrink-0">
            <LogoChip
              logo={logo}
              emoji={client.icon}
              alt={`${client.title} logo`}
              gradient={gradient}
              size="lg"
              bgMode={logoBgMode}
            />
          </div>

          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center rounded-full border border-white/15 bg-white/5 px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-[0.18em] text-white/70">
                SEO DPT · Client
              </span>
              {website && (
                <a
                  href={website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-0.5 text-[11px] font-medium text-white/65 transition hover:border-white/25 hover:bg-white/[0.08] hover:text-white"
                >
                  {displayDomain(website)}
                  <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>
            <h1 className="mt-2 text-4xl font-semibold leading-[1.05] tracking-tight sm:text-5xl">
              <span className="brand-gradient-text">{client.title}</span>
            </h1>
          </div>
        </div>

        <a
          href={notionUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-sm text-white/55 transition hover:text-white"
        >
          Open in Notion <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </section>

      <section className="animate-fade-up mt-10 sm:mt-14">
        <ClientBrief
          brief={brief}
          slug={slug}
          clientName={client.title}
        />
      </section>

      <section className="animate-fade-up mt-10 sm:mt-14">
        <SeoProjectContainers clientName={client.title} />
      </section>
    </PageShell>
  );
}

function BackLink() {
  return (
    <Link
      href="/seo"
      className="animate-fade-up group inline-flex w-fit items-center gap-2 text-sm text-white/55 transition hover:text-white"
    >
      <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
      Back to SEO DPT
    </Link>
  );
}

function NotConfigured() {
  return (
    <section className="animate-fade-up mt-10">
      <div className="brand-gradient-border rounded-2xl bg-white/[0.035] p-6 backdrop-blur-md">
        <p className="text-sm uppercase tracking-[0.18em] text-white/45">
          Notion not connected
        </p>
        <p className="mt-3 max-w-xl text-white/70">
          Add{" "}
          <code className="rounded bg-white/10 px-1.5 py-0.5 text-sm">
            NOTION_API_KEY
          </code>{" "}
          as a Vercel environment variable and redeploy to view this client.
        </p>
      </div>
    </section>
  );
}
