import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, AlertTriangle, Rocket, CheckCircle2, FileDown } from "lucide-react";
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
import { FinalizeReportButton } from "@/components/report/finalize-report-button";
import { ReportCopyLinkButton } from "@/components/report/report-copy-link-button";
import { SendToReviewButton } from "@/components/send-to-review-button";
import type { FetchStatus } from "@/lib/report/report-types";

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
  error: "erro",
  deferred: "manual",
};

/** Actionable explanation for why GBP data isn't flowing yet. */
function gbpHint(s: FetchStatus): string {
  switch (s.status) {
    case "not-configured":
      return "Google Business Profile: sem service account Google configurado neste deployment.";
    case "no-location":
      return "Google Business Profile: a API respondeu, mas não encontrei a ficha deste cliente pela correspondência do website. Confirma o website na ficha GBP ou envia o location ID para eu fixar.";
    case "error":
      if (s.message?.includes("429")) {
        return "Google Business Profile: a API está a responder mas atingiu o limite de pedidos da Google (429). É temporário — tenta gerar de novo daqui a um minuto. Para o evitar de vez, fixa o location ID do cliente (evita a listagem de contas, que é o que atinge o limite) ou pede aumento de quota da Business Profile API no Google Cloud.";
      }
      return `Google Business Profile: ${s.message ?? "erro"}. Se o acesso à Business Profile API ainda estiver a ser aprovado pelo Google, é normal — usa o preenchimento manual entretanto.`;
    default:
      return "Google Business Profile ainda por ligar — preenche os cliques manualmente por agora.";
  }
}

function SourceChip({ name, s }: { name: string; s: FetchStatus }) {
  const color = s.ok
    ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-200/90"
    : s.status === "deferred"
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

  return (
    <PageShell wide backHref={`/seo/${slug}`} backLabel={client.title}>
      <div className="mx-auto max-w-3xl">
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
            </h1>
          </div>
          {!readOnly && (
            <GenerateReportButton
              slug={slug}
              period={period}
              label={snapshot ? "Regenerar" : "Gerar"}
              variant={snapshot ? "ghost" : "solid"}
            />
          )}
        </div>

        {!snapshot ? (
          <div className="brand-gradient-border rounded-2xl bg-white/[0.035] p-8 text-center backdrop-blur-md">
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
        ) : (
          <>
            {/* Internal provenance strip — never shown to the client. */}
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <SourceChip name="GA4" s={snapshot.fetch.ga4} />
              <SourceChip name="GSC" s={snapshot.fetch.gsc} />
              <SourceChip name="GBP" s={snapshot.fetch.gbp} />
            </div>

            {!readOnly && !snapshot.fetch.gbp.ok && (
              <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-white/12 bg-white/[0.03] px-4 py-3 text-[12.5px] leading-relaxed text-white/65">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-white/40" />
                <span>{gbpHint(snapshot.fetch.gbp)}</span>
              </div>
            )}

            {!readOnly && (
              <>
                {snapshot.status === "draft" && (
                  <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-amber-400/25 bg-amber-500/[0.07] px-4 py-3 text-[13px] text-amber-100/90">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
                    <span>
                      <b>Passo 1 — preencher os dados.</b> Há métricas por validar.
                      Preenche os valores em falta ou marca-os N/A abaixo; o cliente
                      nunca vê métricas não validadas.
                    </span>
                  </div>
                )}

                {/* Passo 2 — dados manuais */}
                <ReportManualInputs
                  slug={slug}
                  period={period}
                  channels={snapshot.leads.channels}
                  notes={snapshot.notes}
                />

                {/* Passo 3 — finalizar + ações do cliente (gated) */}
                <div className="brand-gradient-border mb-4 rounded-2xl bg-white/[0.035] p-5 backdrop-blur-md">
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
                        Depois de preencher os dados acima, finaliza o relatório. Só ao
                        finalizar é disparado o aviso no <b>#client-wins</b> e ficam
                        disponíveis o <b>PDF</b>, o <b>link público</b> e o <b>envio para
                        aprovação</b>. Regenerar o relatório volta a exigir finalizar
                        (novo aviso).
                      </p>
                      <FinalizeReportButton
                        slug={slug}
                        period={period}
                        finalized={false}
                      />
                    </>
                  )}
                </div>
              </>
            )}

            <ReportDocument snapshot={snapshot} variant="internal" />
          </>
        )}
      </div>
    </PageShell>
  );
}
