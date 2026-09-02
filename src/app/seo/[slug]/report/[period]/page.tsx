import { notFound } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  AlertTriangle,
  Rocket,
  CheckCircle2,
  ChevronDown,
  FileDown,
  MapPin,
  Store,
  Tags,
} from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { getCurrentEmployee } from "@/lib/auth/server";
import { editableDepts } from "@/lib/auth/credentials";
import { getClientBySlug } from "@/lib/notion";
import { getReport } from "@/lib/report/report-store";
import { isValidPeriodKey, periodFromKey } from "@/lib/report/report-dates";
import { formatDate } from "@/lib/dates";
import { ReportDocument } from "@/components/report/report-document";
import { ReportPrintView } from "@/components/report/report-print-view";
import { GenerateReportButton } from "@/components/report/generate-report-button";
import { ReportManualInputs } from "@/components/report/report-manual-inputs";
import { ReportEcomInputs } from "@/components/report/report-ecom-inputs";
import { ReportGscAiInputs } from "@/components/report/report-gsc-ai-inputs";
import {
  ReportSectionsToggle,
  type SectionOption,
} from "@/components/report/report-sections-toggle";
import { ReportShopifyConfig } from "@/components/report/report-shopify-config";
import { ReportLeadEvents } from "@/components/report/report-lead-events";
import { ReportGbpProfiles } from "@/components/report/report-gbp-profiles";
import { getReportConfig } from "@/lib/report/report-config-store";
import { FinalizeReportButton } from "@/components/report/finalize-report-button";
import { ReportCopyLinkButton } from "@/components/report/report-copy-link-button";
import { SendToReviewButton } from "@/components/send-to-review-button";
import {
  ECOM_METRIC_KEYS,
  isEcomCellUnresolved,
  isUnresolved,
  type FetchStatus,
} from "@/lib/report/report-types";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; period: string }>;
}) {
  const { slug, period } = await params;
  const client = await getClientBySlug(slug).catch(() => null);
  const label = isValidPeriodKey(period) ? periodFromKey(period).label : period;
  return {
    title: client
      ? `Relatório ${label} — ${client.title} · Wonder Ads`
      : "Relatório — Wonder Ads",
  };
}

const SOURCE_LABEL: Record<string, string> = {
  ok: "ligado",
  "not-configured": "sem service account",
  "no-property": "sem propriedade",
  "no-location": "ficha GBP por ligar",
  partial: "fichas em falta",
  error: "erro",
  deferred: "manual",
  "no-purchases": "sem purchase tracking",
  unused: "não usado (GA4 cobre)",
  "not-connected": "por ligar (opcional)",
};

/** Actionable explanation for why GBP data isn't flowing yet. */
function gbpHint(s: FetchStatus): string {
  switch (s.status) {
    case "not-configured":
      return "Google Business Profile: sem service account Google configurado neste deployment.";
    case "no-location":
      return "Google Business Profile: a API respondeu, mas não encontrei a ficha deste cliente pela correspondência do website. Confirma o website na ficha GBP ou envia o location ID para eu fixar.";
    case "partial":
      return `Google Business Profile: a ficha principal respondeu, mas há fichas adicionais sem dados. ${s.message ?? ""} Confirma o Location ID de cada uma em «Fichas do Google Business Profile», ou preenche os valores dessa unidade à mão.`;
    case "error":
      if (s.message?.includes("429")) {
        return "Google Business Profile: a API está ligada, mas a Google ainda não atribuiu quota ao projeto (429). Preenche os cliques do GBP manualmente por agora.";
      }
      return `Google Business Profile: ${s.message ?? "erro"}. Se o acesso à Business Profile API ainda estiver a ser aprovado pelo Google, é normal — usa o preenchimento manual entretanto.`;
    default:
      return "Google Business Profile ainda por ligar — preenche os cliques manualmente por agora.";
  }
}

function SourceChip({ name, s }: { name: string; s: FetchStatus }) {
  const color = s.ok
    ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-200/90"
    : s.status === "deferred" || s.status === "not-connected"
      ? "border-white/15 bg-white/5 text-white/55"
      : "border-amber-400/30 bg-amber-500/10 text-amber-200/90";
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] ${color}`}
      title={s.message}
    >
      <span className="font-semibold">{name}</span>
      <span className="opacity-75">{SOURCE_LABEL[s.status] ?? s.status}</span>
    </span>
  );
}

/** Bloco de configuração fechado por defeito. Estes cartões afinam-se uma vez
 *  por cliente e depois estorvam — a v77.0 tinha-os sempre abertos e a página
 *  lia-se como um manual. O `<details>` nativo dispensa JS. */
function ConfigDisclosure({
  icon: Icon,
  title,
  hint,
  children,
}: {
  icon: typeof Tags;
  title: string;
  hint: string;
  children: React.ReactNode;
}) {
  return (
    <details className="group mb-3 rounded-2xl border border-white/10 bg-white/[0.025]">
      <summary className="flex cursor-pointer select-none list-none items-center gap-2.5 px-4 py-3 [&::-webkit-details-marker]:hidden">
        <Icon className="h-4 w-4 shrink-0 text-[#b79bff]" />
        <span className="text-[13px] font-semibold text-white/85">{title}</span>
        <span className="min-w-0 flex-1 truncate text-right text-[11px] text-white/35">
          {hint}
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 text-white/35 transition group-open:rotate-180" />
      </summary>
      <div className="border-t border-white/8">{children}</div>
    </details>
  );
}

export default async function ReportPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string; period: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { slug, period } = await params;
  if (!isValidPeriodKey(period)) notFound();

  const snapshot = await getReport(slug, period);
  // Which GA4 events count as leads for this client — editable below the
  // manual inputs so a wrong mapping is fixed here, not inside GA4.
  const reportConfig = await getReportConfig(slug);

  // Print/PDF surface — bare branded document, no app chrome.
  const sp = await searchParams;
  if (sp.print === "true") {
    if (!snapshot) notFound();
    return <ReportPrintView snapshot={snapshot} />;
  }

  const client = await getClientBySlug(slug);
  if (!client) notFound();

  const employee = await getCurrentEmployee();
  const readOnly = !employee || !editableDepts(employee).includes("seo");

  const label = periodFromKey(period).label;
  const publicPath = `/${slug}/preview/report/${period}`;

  // Quanto falta validar — o número que dá sentido ao «Passo 1».
  const pendingChannels = snapshot
    ? snapshot.leads.channels.filter((c) => isUnresolved(c.metric)).length
    : 0;
  const ecomCurrent = snapshot?.ecom?.columns.find(
    (c) => !c.yoy && c.key === snapshot.period,
  );
  const pendingEcom = ecomCurrent
    ? ECOM_METRIC_KEYS.filter((k) => isEcomCellUnresolved(ecomCurrent.cells[k]))
        .length
    : 0;
  const pendingTotal = pendingChannels + pendingEcom;

  // As secções que este relatório pode ter — as e-commerce só nos ecommerce.
  const sectionOptions: SectionOption[] = [
    { key: "exec", label: "Resumo Executivo" },
    { key: "trend", label: "Evolução" },
    ...(snapshot?.ecom
      ? ([
          { key: "ecom", label: "Conversão e-commerce" },
          { key: "ecomPages", label: "Páginas mais acedidas" },
          { key: "ecomProducts", label: "Produtos mais vendidos" },
        ] as SectionOption[])
      : []),
    { key: "leads", label: "Leads por canal" },
    { key: "traffic", label: "Tráfego & Ficha Google" },
    { key: "ai", label: "AI Visibility" },
    ...(snapshot?.gscAi
      ? ([{ key: "gscAi", label: "Google IA (AI Overviews)" }] as SectionOption[])
      : []),
    { key: "kw", label: "Keywords & posições" },
    { key: "geo", label: "GEO · SEO para IA" },
    { key: "notes", label: "Notas & próximos passos" },
  ];

  // Resumo curto de cada bloco de configuração, para se ler fechado.
  const eventsSummary = [
    ...Object.values(reportConfig.eventMap).flat(),
    ...reportConfig.extraLeadEvents.map((e) => e.label),
  ]
    .slice(0, 3)
    .join(", ");
  const gbpSummary =
    reportConfig.extraGbpProfiles.length > 0
      ? `${reportConfig.extraGbpProfiles.length + 1} localizações`
      : "1 localização (auto)";
  const shopifySummary = reportConfig.shopifyAccessToken
    ? `${reportConfig.shopifyShopDomain ?? "loja"} · ligada`
    : "por ligar (opcional)";

  return (
    <PageShell wide backHref={`/seo/${slug}`} backLabel={client.title}>
      <div className="mx-auto max-w-[1560px]">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <Link
              href={`/seo/${slug}`}
              className="inline-flex items-center gap-1.5 text-[12px] text-white/45 transition hover:text-white/70"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              {client.title}
            </Link>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-white">
              Relatório Mensal · <span className="brand-gradient-text">{label}</span>
              {snapshot?.kind === "ecommerce" && (
                <span className="ml-3 align-middle rounded-full border border-[#783DF5]/40 bg-[#783DF5]/15 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-[#c9b2ff]">
                  e-commerce
                </span>
              )}
            </h1>
          </div>
          {!readOnly && (
            <GenerateReportButton
              slug={slug}
              period={period}
              label={snapshot ? "Regenerar" : "Gerar"}
              variant={snapshot ? "ghost" : "solid"}
              // Regenerar mantém o tipo e o idioma do relatório já gerado;
              // trocam-se no gerador da página do cliente.
              ecommerce={snapshot ? snapshot.kind === "ecommerce" : undefined}
              lang={snapshot?.lang}
            />
          )}
        </div>

        {!snapshot ? (
          <div className="brand-gradient-border mx-auto max-w-3xl rounded-2xl bg-white/[0.035] p-8 text-center backdrop-blur-md">
            <p className="text-white/75">
              Ainda não existe relatório para <b>{label}</b>.
            </p>
            <p className="mt-1 text-sm text-white/45">
              Gere-o para puxar os dados de GA4 + GSC deste mês.
            </p>
            {!readOnly && (
              <div className="mt-5 flex justify-center">
                <GenerateReportButton slug={slug} period={period} label={`Gerar ${label}`} />
              </div>
            )}
          </div>
        ) : readOnly ? (
          <div className="mx-auto max-w-3xl">
            <ReportDocument snapshot={snapshot} variant="internal" />
          </div>
        ) : (
          /* Dois painéis a partir de xl: preencher à esquerda, documento à
             direita — o consultor guarda um valor e vê logo onde ele cai,
             sem fazer scroll por um manual inteiro. */
          <div className="gap-6 xl:grid xl:grid-cols-[480px_minmax(0,1fr)] xl:items-start">
            {/* Sem sticky nem scroll próprio (v77.2): a coluna corre com a
                página até ao fim, como o documento ao lado. */}
            <div className="min-w-0 pb-4">
              {/* Proveniência das fontes — interno, nunca no documento. */}
              <div className="mb-3 flex flex-wrap items-center gap-1.5">
                <SourceChip name="GA4" s={snapshot.fetch.ga4} />
                <SourceChip name="GSC" s={snapshot.fetch.gsc} />
                <SourceChip name="GBP" s={snapshot.fetch.gbp} />
                {snapshot.ecom && (
                  <>
                    <SourceChip name="E-comm" s={snapshot.ecom.fetch.ga4} />
                    <SourceChip name="Shopify" s={snapshot.ecom.fetch.shopify} />
                  </>
                )}
              </div>

              {!snapshot.fetch.gbp.ok && (
                <details className="mb-3 rounded-xl border border-white/12 bg-white/[0.03]">
                  <summary className="flex cursor-pointer select-none list-none items-center gap-2 px-3.5 py-2.5 text-[12px] text-white/60 [&::-webkit-details-marker]:hidden">
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-white/40" />
                    GBP sem dados automáticos — porquê?
                  </summary>
                  <p className="border-t border-white/8 px-3.5 py-2.5 text-[12px] leading-relaxed text-white/55">
                    {gbpHint(snapshot.fetch.gbp)}
                  </p>
                </details>
              )}

              {/* Passo 1 — uma linha com o número, não um parágrafo. */}
              {snapshot.status === "draft" ? (
                <div className="mb-3 flex items-center gap-2.5 rounded-xl border border-amber-400/25 bg-amber-500/[0.07] px-3.5 py-2.5 text-[12.5px] text-amber-100/90">
                  <AlertTriangle className="h-4 w-4 shrink-0 text-amber-300" />
                  <span>
                    <b>Passo 1 — preencher.</b>{" "}
                    {pendingTotal > 0
                      ? `${pendingTotal} ${pendingTotal === 1 ? "métrica" : "métricas"} por validar.`
                      : "Há métricas por validar abaixo."}
                  </span>
                </div>
              ) : (
                <div className="mb-3 flex items-center gap-2.5 rounded-xl border border-emerald-400/25 bg-emerald-500/[0.06] px-3.5 py-2.5 text-[12.5px] text-emerald-100/90">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-300" />
                  Dados validados — pronto para finalizar.
                </div>
              )}

              {/* Que secções entram no documento — todas por defeito. */}
              <ReportSectionsToggle
                slug={slug}
                period={period}
                sections={sectionOptions}
                hidden={snapshot.hiddenSections ?? []}
              />

              {/* Passo 2 — dados manuais */}
              <ReportManualInputs
                slug={slug}
                period={period}
                channels={snapshot.leads.channels}
                notes={snapshot.notes}
              />

              {/* Google IA — impressões nas AI Overviews / AI Mode (GSC) */}
              {snapshot.gscAi && (
                <ReportGscAiInputs
                  slug={slug}
                  period={period}
                  gscAi={snapshot.gscAi}
                />
              )}

              {/* Relatório e-commerce: tabela de conversão + listas */}
              {snapshot.ecom && (
                <ReportEcomInputs
                  slug={slug}
                  period={period}
                  ecom={snapshot.ecom}
                />
              )}

              {/* Configuração do cliente — afinada uma vez, depois fechada. */}
              <div className="mb-1 mt-5 text-[11px] font-semibold uppercase tracking-[0.16em] text-white/35">
                Configuração do cliente
              </div>
              <ConfigDisclosure
                icon={Tags}
                title="Eventos de lead no GA4"
                hint={eventsSummary || "por configurar"}
              >
                <ReportLeadEvents
                  slug={slug}
                  eventMap={reportConfig.eventMap}
                  extraLeadEvents={reportConfig.extraLeadEvents}
                  bare
                />
              </ConfigDisclosure>
              <ConfigDisclosure
                icon={MapPin}
                title="Localizações do Google Business Profile"
                hint={gbpSummary}
              >
                <ReportGbpProfiles
                  slug={slug}
                  gbpMainLabel={reportConfig.gbpMainLabel}
                  extraGbpProfiles={reportConfig.extraGbpProfiles}
                  bare
                />
              </ConfigDisclosure>
              {snapshot.kind === "ecommerce" && (
                <ConfigDisclosure
                  icon={Store}
                  title="Ligação Shopify"
                  hint={shopifySummary}
                >
                  <ReportShopifyConfig
                    slug={slug}
                    shopDomain={reportConfig.shopifyShopDomain}
                    currency={reportConfig.currency}
                    tokenSet={Boolean(reportConfig.shopifyAccessToken)}
                    bare
                  />
                </ConfigDisclosure>
              )}

              {/* Passo 3 — finalizar + ações do cliente (gated) */}
              <div className="brand-gradient-border mt-5 rounded-2xl bg-white/[0.035] p-5 backdrop-blur-md">
                <div className="mb-3 flex items-center gap-2">
                  <Rocket className="h-4 w-4 text-[#b79bff]" />
                  <h3 className="text-sm font-semibold text-white/85">
                    Passo 3 — Finalizar &amp; partilhar
                  </h3>
                </div>

                {snapshot.finalizedAt ? (
                  <>
                    <p className="mb-4 inline-flex items-center gap-1.5 rounded-lg border border-emerald-400/25 bg-emerald-500/10 px-3 py-1.5 text-[12.5px] text-emerald-100/90">
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-300" />
                      Finalizado em {formatDate(snapshot.finalizedAt)} · anunciado no{" "}
                      #client-wins
                    </p>
                    <div className="mb-4 flex flex-wrap items-center gap-2">
                      <a
                        href={`/seo/${slug}/report/${period}?print=true`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-md border border-white/15 bg-white/[0.04] px-3 py-1.5 text-[12px] font-medium text-white/85 transition hover:border-white/30 hover:bg-white/[0.08]"
                      >
                        <FileDown className="h-3.5 w-3.5" />
                        Gerar PDF
                      </a>
                      <ReportCopyLinkButton path={publicPath} />
                      <SendToReviewButton
                        clientSlug={slug}
                        task={`Relatório Mensal — ${label}`}
                        category="Monthly Report"
                        docLink={publicPath}
                        sourceType="Monthly Report"
                        label="Enviar para aprovação"
                      />
                    </div>
                    <FinalizeReportButton slug={slug} period={period} finalized />
                  </>
                ) : (
                  <>
                    <p className="mb-4 text-[12px] leading-relaxed text-white/45">
                      Finalizar dispara o aviso no <b>#client-wins</b> e desbloqueia
                      o <b>PDF</b>, o <b>link público</b> e o <b>envio para
                      aprovação</b>. Regenerar volta a exigir finalizar.
                    </p>
                    <FinalizeReportButton
                      slug={slug}
                      period={period}
                      finalized={false}
                    />
                  </>
                )}
              </div>
            </div>

            <div className="mt-6 min-w-0 xl:mt-0">
              <ReportDocument snapshot={snapshot} variant="internal" />
            </div>
          </div>
        )}
      </div>
    </PageShell>
  );
}
