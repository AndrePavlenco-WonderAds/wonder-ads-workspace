import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { LogoChip } from "@/components/logo-chip";
import { RoadmapBoard } from "@/components/roadmap-board";
import { RoadmapChangelog } from "@/components/roadmap-changelog";
import { SendToReviewButton } from "@/components/send-to-review-button";
import { getClientBySlug } from "@/lib/notion";
import {
  getClientLogo,
  getLogoBgMode,
  getLogoSizing,
} from "@/lib/client-meta";
import { getClientPalette, paletteToGradient } from "@/lib/client-colors";
import {
  ensureRoadmap,
  roadmapLastDay,
  roadmapMonthCount,
  roadmapWeeks,
} from "@/lib/roadmap-store";
import { plannedTasks } from "@/lib/roadmap-fixed-blocks";
import { formatDate } from "@/lib/dates";
import { pickLang } from "@/lib/public-i18n";
import { getRoadmapLog } from "@/lib/roadmap-changelog-store";
import { getClientRenewal } from "@/lib/client-renewal-store";
import { getCurrentEmployee } from "@/lib/auth/server";
import { editableDepts } from "@/lib/auth/credentials";
import { SeoReadOnlyProvider, ReadOnlyBanner } from "@/components/seo-readonly";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const client = await getClientBySlug(slug).catch(() => null);
  return {
    title: client
      ? `Roadmap SEO — ${client.title} · Wonder Ads`
      : "Roadmap SEO · Wonder Ads",
  };
}

export default async function RoadmapPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const client = await getClientBySlug(slug).catch(() => null);
  if (!client) notFound();

  const logo = getClientLogo(slug);
  const logoBgMode = getLogoBgMode(slug);
  const logoSizing = getLogoSizing(slug);
  const gradient = paletteToGradient(getClientPalette(slug));

  // Renovação: chave própria, para sobreviver a um reinício do roadmap. Lida
  // primeiro porque um roadmap novo nasce com o comprimento do contrato.
  const renewal = await getClientRenewal(slug).catch(() => ({
    renewalDate: null,
    termMonths: 6 as const,
  }));
  const roadmap = await ensureRoadmap(slug, renewal.termMonths);
  const totalWeeks = roadmapWeeks(roadmap);
  const totalMonths = roadmapMonthCount(roadmap);
  const lastDay = roadmapLastDay(roadmap);
  const changelog = await getRoadmapLog(slug);

  // O nome do envio aparece ao CLIENTE na tabela Pending Review — vai na
  // língua dele (clientes EN como IHN ou Kings Gym continuam em inglês).
  const clientLang = pickLang(slug);
  const monthTaskName =
    clientLang === "pt"
      ? `Roadmap SEO — mês atual · ${client.title}`
      : `SEO Roadmap — current month · ${client.title}`;
  const fullTaskName =
    clientLang === "pt"
      ? `Roadmap SEO (${totalMonths} meses) · ${client.title}`
      : `SEO Roadmap (${totalMonths} months) · ${client.title}`;

  const employee = await getCurrentEmployee();
  const readOnly = !employee || !editableDepts(employee).includes("seo");

  return (
    <SeoReadOnlyProvider value={readOnly}>
    <PageShell
      wide
      backHref={`/seo/${slug}`}
      backLabel={client.title}
      backPrefix="Voltar a"
    >
      {readOnly && <ReadOnlyBanner />}
      <header className="animate-fade-up mt-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <LogoChip
            logo={logo}
            emoji={client.icon}
            alt={`${client.title} logo`}
            gradient={gradient}
            size="md"
            bgMode={logoBgMode}
            sizing={logoSizing}
          />
          <div>
            <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.18em] text-white/55">
              <Link
                href={`/seo/${slug}`}
                className="inline-flex items-center gap-1 transition hover:text-white"
              >
                <ArrowLeft className="h-3 w-3" />
                {client.title}
              </Link>
              <span className="text-white/25">·</span>
              <span>Roadmap SEO</span>
            </div>
            <h1 className="mt-1 text-2xl font-semibold leading-tight tracking-tight sm:text-3xl">
              <span className="brand-gradient-text">
                Roadmap de {totalMonths} meses
              </span>
            </h1>
            {/* Months are what the client signed; weeks are what the
                board works in. Both, plus the real end date. */}
            <p className="mt-1 text-[12px] text-white/50">
              {totalWeeks} semanas · {formatDate(roadmap.startDate)} →{" "}
              {formatDate(lastDay)}
            </p>
          </div>
        </div>
        {/* O «Gerar Weekly Report» viveu aqui até à v76.73. Saiu para o menu
            do consultor: o weekly report é trabalho semanal dele sobre a
            carteira toda, feito de uma sentada a partir dos daily updates —
            não é uma ação sobre este cliente, e ter o botão em cada roadmap
            sugeria o contrário. */}
        {!readOnly && plannedTasks(roadmap.tasks).length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <SendToReviewButton
              variant="default"
              clientSlug={slug}
              task={monthTaskName}
              category="Roadmap"
              docLink={`/${slug}/preview/roadmap/current-month`}
              sourceType="roadmap-month"
              label="Enviar mês atual"
              pt
            />
            <SendToReviewButton
              variant="prominent"
              clientSlug={slug}
              task={fullTaskName}
              category="Roadmap"
              docLink={`/${slug}/preview/roadmap`}
              sourceType="roadmap"
              label="Enviar roadmap completo"
              pt
            />
          </div>
        )}
      </header>

      <section className="mt-6">
        <RoadmapBoard
          clientSlug={slug}
          clientName={client.title}
          initialRenewalDate={renewal.renewalDate}
          initialTermMonths={renewal.termMonths}
          initialRoadmap={roadmap}
        />
        <RoadmapChangelog clientSlug={slug} initialEntries={changelog} />
      </section>
    </PageShell>
    </SeoReadOnlyProvider>
  );
}
