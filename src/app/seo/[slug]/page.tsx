import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { ClientBrief } from "@/components/client-brief";
import { getBriefForSlug } from "@/lib/briefs-storage";
import { getClientBySlug, getSeoClients } from "@/lib/notion";

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

  return (
    <PageShell>
      <BackLink />

      <section className="animate-fade-up mt-10 flex flex-wrap items-start justify-between gap-5 sm:mt-14">
        <div className="flex items-center gap-5">
          <div className="relative shrink-0">
            <div
              className="brand-gradient-bg flex h-16 w-16 items-center justify-center rounded-2xl text-3xl shadow-[0_10px_40px_-8px_rgba(120,61,245,0.7)]"
              aria-hidden
            >
              <span className="leading-none">{client.icon ?? "🌐"}</span>
            </div>
            <div
              aria-hidden
              className="absolute inset-0 -z-10 rounded-2xl opacity-60 blur-2xl"
              style={{ background: "var(--brand-gradient)" }}
            />
          </div>

          <div>
            <span className="inline-flex items-center rounded-full border border-white/15 bg-white/5 px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-[0.18em] text-white/70">
              SEO DPT · Client
            </span>
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
