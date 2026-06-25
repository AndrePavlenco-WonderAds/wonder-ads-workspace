import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Wand2 } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { CreativesStudio } from "@/components/creatives-studio";
import { getAdsClient } from "@/lib/ads-clients";
import { getCreatives } from "@/lib/ads/ads-creatives-store";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const client = getAdsClient(slug);
  return {
    title: client
      ? `Creatives Studio — ${client.title} · Wonder Ads`
      : "Creatives Studio — Wonder Ads",
  };
}

export default async function CreativesPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const client = getAdsClient(slug);
  if (!client) notFound();

  const history = await getCreatives(slug);

  return (
    <PageShell wide sessionTimer>
      <Link
        href={`/ads/${slug}`}
        className="animate-fade-up group inline-flex w-fit items-center gap-2 text-sm text-white/55 transition hover:text-white"
      >
        <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
        Voltar a {client.title}
      </Link>

      <section className="animate-fade-up mt-8 flex items-center gap-3">
        <span className="brand-gradient-bg flex h-11 w-11 items-center justify-center rounded-2xl shadow-[0_10px_40px_-10px_rgba(120,61,245,0.65)]">
          <Wand2 className="h-5 w-5 text-white" strokeWidth={2.25} />
        </span>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            <span className="brand-gradient-text">Creatives Studio</span>
          </h1>
          <p className="text-[12px] text-white/45">
            Gera criativos para {client.title} com o Claude Creatives Pro Max.
          </p>
        </div>
      </section>

      <CreativesStudio
        slug={slug}
        clientName={client.title}
        initialHistory={history}
      />
    </PageShell>
  );
}
