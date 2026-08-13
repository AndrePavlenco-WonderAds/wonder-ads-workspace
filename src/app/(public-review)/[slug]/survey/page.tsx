// Public SEO satisfaction survey — no auth, no app chrome.
// The client lands here from a link the consultant shared and answers a
// short quiz. Mirrors the /[slug]/pendingreview public surface: clinic
// name + logo header, then the form, then a thin Wonder Ads footer.

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getClientBySlug } from "@/lib/notion";
import { getClientLogo } from "@/lib/client-meta";
import {
  getConsultantEmailForSlug,
  getConsultantForSlug,
} from "@/lib/client-overrides";
import { pickLang } from "@/lib/public-i18n";
import { NpsSurveyForm } from "@/components/nps-survey-form";
import { NpsIntro } from "@/components/nps-intro";

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
  pt: "Um formulário curto para avaliar o nosso trabalho — o serviço, os resultados, a comunicação e a equipa que acompanha a sua conta.",
  en: "A short form to evaluate our work — the service, the results, the communication and the team looking after your account.",
} as const;

const MINUTES = {
  pt: "Formulário de 5 minutos",
  en: "5-minute form",
} as const;

const EYEBROW = {
  pt: "Avaliação de Serviço · Cliente",
  en: "Service Evaluation · Client",
} as const;

const FOOTER = {
  pt: "Dúvidas? Fale com",
  en: "Questions? Reach",
} as const;

/** O separador do browser dizia «Pending Review · Wonder Ads» — o título do
 *  layout público, herdado de outra página. Quem recebe o link vê o nome do
 *  separador antes de ver a página, e «Pending Review» num inquérito de
 *  satisfação parece outra coisa qualquer (uma fatura por aprovar, um
 *  processo pendente). Passa a dizer o que é, com o nome do cliente. */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  if (RESERVED.has(slug)) return { title: "Wonder Ads" };
  const client = await getClientBySlug(slug).catch(() => null);
  const lang = pickLang(slug);
  const name = client?.title;
  const title = name
    ? lang === "pt"
      ? `Avaliação de Serviço · ${name} · Wonder Ads`
      : `Service Evaluation · ${name} · Wonder Ads`
    : lang === "pt"
      ? "Avaliação de Serviço · Wonder Ads"
      : "Service Evaluation · Wonder Ads";
  return {
    title,
    description:
      lang === "pt"
        ? "Formulário de 5 minutos para avaliar o serviço, os resultados e a equipa da Wonder Ads."
        : "A 5-minute form to evaluate Wonder Ads' service, results and team.",
    // Um link de cliente não tem nada que fazer no índice do Google.
    robots: { index: false, follow: false },
  };
}

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
    <main className="relative mx-auto min-h-screen max-w-2xl px-4 py-10 sm:px-6">
      {/* Auras da marca por trás de tudo. O fundo creme do layout público é
          liso de propósito; sem nada por trás, o cartão do inquérito fica a
          flutuar numa folha em branco. */}
      <span
        aria-hidden
        className="nps-aura pointer-events-none fixed -left-32 -top-24 -z-10 h-[420px] w-[420px] rounded-full opacity-[0.13] blur-3xl"
        style={{
          background:
            "radial-gradient(circle at 30% 30%, #783DF5 0%, #343ED7 60%, transparent 72%)",
        }}
      />
      <span
        aria-hidden
        className="nps-aura pointer-events-none fixed -right-40 top-1/3 -z-10 h-[460px] w-[460px] rounded-full opacity-[0.11] blur-3xl"
        style={{
          animationDelay: "-7s",
          background:
            "radial-gradient(circle at 60% 40%, #C535C9 0%, #783DF5 55%, transparent 72%)",
        }}
      />

      {/* Header */}
      <header className="mb-8 flex items-center gap-4">
        {logo && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={logo}
            alt={`${client.title} logo`}
            className="h-14 w-14 rounded-xl border border-black/8 bg-white object-contain p-1.5 shadow-[0_10px_30px_-14px_rgba(0,0,0,0.4)]"
          />
        )}
        <div className="flex-1">
          <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#A9834F]">
            {EYEBROW[lang]}
          </span>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-black/85 sm:text-[32px]">
            {client.title}
          </h1>
        </div>
      </header>

      <NpsIntro text={INTRO[lang]} minutesLabel={MINUTES[lang]} />

      <NpsSurveyForm slug={slug} clientName={client.title} lang={lang} />

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
