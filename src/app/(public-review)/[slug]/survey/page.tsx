// Public SEO satisfaction survey — no auth, no app chrome.
// The client lands here from a link the consultant shared and answers a
// short quiz. Mirrors the /[slug]/pendingreview public surface: clinic
// name + logo header, then the form, then a thin Wonder Ads footer.

import { notFound } from "next/navigation";
import { getClientBySlug } from "@/lib/notion";
import { getClientLogo } from "@/lib/client-meta";
import {
  getConsultantEmailForSlug,
  getConsultantForSlug,
} from "@/lib/client-overrides";
import { pickLang } from "@/lib/public-i18n";
import { NpsSurveyForm } from "@/components/nps-survey-form";

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

const INTRO = {
  pt: "Um formulário curto para avaliar o serviço de SEO, os resultados orgânicos, a comunicação e o consultor responsável. Sem rodeios — cerca de 5 minutos, respostas diretas.",
  en: "A short form to evaluate the SEO service, the organic results, the communication and the consultant in charge. Straight to the point — about 5 minutes.",
} as const;

const EYEBROW = {
  pt: "Avaliação de Serviço SEO · Cliente",
  en: "SEO Service Evaluation · Client",
} as const;

const FOOTER = {
  pt: "Dúvidas? Fale com",
  en: "Questions? Reach",
} as const;

export default async function PublicSurveyPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  if (RESERVED.has(slug)) notFound();

  const client = await getClientBySlug(slug).catch(() => null);
  if (!client) notFound();

  const logo = getClientLogo(slug);
  const lang = pickLang(slug);
  const consultantName = getConsultantForSlug(slug);
  const consultantEmail = getConsultantEmailForSlug(slug);

  return (
    <main className="mx-auto min-h-screen max-w-2xl px-4 py-10 sm:px-6">
      {/* Header */}
      <header className="mb-8 flex items-center gap-4">
        {logo && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={logo}
            alt={`${client.title} logo`}
            className="h-12 w-12 rounded-lg border border-black/8 bg-white object-contain p-1"
          />
        )}
        <div className="flex-1">
          <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#A9834F]">
            {EYEBROW[lang]}
          </span>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-black/85 sm:text-3xl">
            {client.title}
          </h1>
        </div>
      </header>

      <p className="mb-8 max-w-xl text-sm leading-relaxed text-black/60">
        {INTRO[lang]}
      </p>

      <NpsSurveyForm slug={slug} lang={lang} />

      {/* Footer */}
      <footer className="mt-12 border-t border-black/8 pt-6 text-center text-[11px] text-black/45">
        <p>
          <span
            className="font-semibold"
            style={{
              background:
                "linear-gradient(135deg, #343ED7 0%, #783DF5 53.65%, #C535C9 100%)",
              WebkitBackgroundClip: "text",
              backgroundClip: "text",
              WebkitTextFillColor: "transparent",
              color: "transparent",
            }}
          >
            Wonder Ads
          </span>
          {consultantName && consultantName !== "Unassigned" && (
            <>
              {" · "}
              {FOOTER[lang]} {consultantName} —{" "}
              <a
                href={`mailto:${consultantEmail}`}
                className="font-medium text-black/60 underline-offset-2 hover:text-black/85 hover:underline"
              >
                {consultantEmail}
              </a>
            </>
          )}
        </p>
      </footer>
    </main>
  );
}
