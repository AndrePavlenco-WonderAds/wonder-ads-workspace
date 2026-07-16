// Public onboarding form (the "A Vossa Audiência e Conteúdo" quiz). Rendered
// as a dedicated step inside the onboarding flow. No auth / no app chrome.

import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { resolveOnboardingClient } from "@/lib/onboarding-resolve";
import { OnboardingIntakeForm } from "@/components/onboarding-intake-form";

export const dynamic = "force-dynamic";

const RESERVED = new Set([
  "seo",
  "ads",
  "web",
  "commercial",
  "changelog",
  "api",
  "review",
  "reviews",
  "survey",
  "_next",
  "static",
  "public",
]);

const BRAND_GRADIENT =
  "linear-gradient(135deg, #343ED7 0%, #783DF5 53.65%, #C535C9 100%)";

export default async function OnboardingFormPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  if (RESERVED.has(slug)) notFound();

  const client = await resolveOnboardingClient(slug);
  if (!client) notFound();

  const hubHref = `/${slug}/onboarding`;

  return (
    <main className="mx-auto min-h-screen max-w-2xl px-4 py-10 sm:px-6">
      {/* Breadcrumbs */}
      <nav className="mb-6 flex flex-wrap items-center gap-1.5 text-[12px] text-black/45">
        <Link href={hubHref} className="hover:text-black/70">
          Onboarding
        </Link>
        <ChevronRight className="h-3 w-3" />
        <Link href={hubHref} className="hover:text-black/70">
          Onboarding PT
        </Link>
        <ChevronRight className="h-3 w-3" />
        <span className="font-medium text-black/70">
          A Vossa Audiência e Conteúdo
        </span>
      </nav>

      <header className="mb-6">
        <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#A9834F]">
          {client.title}
        </span>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-black/85 sm:text-3xl">
          A Vossa Audiência e Conteúdo
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-black/55">
          Estamos muito entusiasmados por dar início a esta parceria! Para
          alcançarmos os melhores resultados possíveis, precisamos de recolher
          algumas informações antes da nossa Sessão de Estratégia. Responda com
          o máximo de detalhe — o seu progresso é guardado à medida que avança.
        </p>
      </header>

      <OnboardingIntakeForm slug={slug} hubHref={hubHref} />

      <footer className="mt-12 border-t border-black/8 pt-6 text-center text-[11px] text-black/45">
        <span
          className="font-semibold"
          style={{
            background: BRAND_GRADIENT,
            WebkitBackgroundClip: "text",
            backgroundClip: "text",
            WebkitTextFillColor: "transparent",
            color: "transparent",
          }}
        >
          Wonder Ads
        </span>
        {client.consultant && <> · {client.consultant}</>}
      </footer>
    </main>
  );
}
