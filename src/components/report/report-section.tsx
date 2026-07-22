import Link from "next/link";
import { ArrowUpRight, FileBarChart, FileDown } from "lucide-react";
import { listReports } from "@/lib/report/report-store";
import { previousCompleteMonth } from "@/lib/report/report-dates";
import { formatDate } from "@/lib/dates";
import type { ReportStatus } from "@/lib/report/report-types";
import { GenerateReportButton } from "./generate-report-button";

const STATUS_PILL: Record<ReportStatus, string> = {
  draft: "border-amber-400/30 bg-amber-500/[0.10] text-amber-200/90",
  ready: "border-sky-400/30 bg-sky-500/[0.10] text-sky-200/90",
  sent: "border-emerald-400/30 bg-emerald-500/[0.10] text-emerald-200/90",
};
const STATUS_LABEL: Record<ReportStatus, string> = {
  draft: "Rascunho",
  ready: "Pronto",
  sent: "Enviado",
};

/** "Relatório Mensal" panel for the SEO client page — lists past reports and
 *  generates the next one. Rendered near the bottom of /seo/[slug]. */
export async function ReportSection({
  slug,
  readOnly = false,
}: {
  slug: string;
  readOnly?: boolean;
}) {
  const [reports, next] = [await listReports(slug), previousCompleteMonth()];
  const alreadyHasNext = reports.some((r) => r.period === next.key);

  return (
    <section id="section-report" className="scroll-mt-8">
      <header className="mb-5 flex items-center gap-3">
        <FileBarChart className="h-4 w-4 text-[#b79bff]" />
        <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-white/70">
          Relatório Mensal
        </h2>
        {reports.length > 0 && (
          <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-0.5 text-xs font-medium uppercase tracking-[0.16em] text-white/45">
            {reports.length}
          </span>
        )}
      </header>

      <div className="brand-gradient-border rounded-2xl bg-white/[0.035] p-5 backdrop-blur-md sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm text-white/75">
              Relatório de SEO &amp; Lead Gen do mês anterior — leads, orgânico,
              GSC e AI Visibility, com comparação face ao mês anterior.
            </p>
            <p className="mt-1 text-[12px] text-white/45">
              Próximo período: <span className="text-white/70">{next.label}</span>
              {alreadyHasNext ? " · já gerado" : ""}
            </p>
          </div>
          {!readOnly && (
            <GenerateReportButton
              slug={slug}
              period={next.key}
              label={alreadyHasNext ? `Regenerar ${next.label}` : `Gerar ${next.label}`}
            />
          )}
        </div>

        {reports.length > 0 && (
          <>
            <div className="mt-6 mb-2 flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.16em] text-white/40">
              Relatórios anteriores
            </div>
            <ul className="divide-y divide-white/8 border-t border-white/8">
              {reports.map((r) => (
                <li
                  key={r.period}
                  className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-3"
                >
                  <Link
                    href={`/seo/${slug}/report/${r.period}`}
                    className="group flex min-w-0 items-center gap-3"
                  >
                    <span className="text-sm font-medium text-white/85 transition group-hover:text-white">
                      {r.periodLabel}
                    </span>
                    <span
                      className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${STATUS_PILL[r.status]}`}
                    >
                      {STATUS_LABEL[r.status]}
                    </span>
                  </Link>
                  <div className="flex items-center gap-2">
                    <span className="mr-1 text-[11px] text-white/35">
                      {formatDate(r.generatedAt)}
                    </span>
                    <Link
                      href={`/seo/${slug}/report/${r.period}`}
                      className="inline-flex items-center gap-1.5 rounded-md border border-white/12 bg-white/[0.04] px-2.5 py-1 text-[11px] font-medium text-white/80 transition hover:border-white/25 hover:bg-white/[0.08] hover:text-white"
                    >
                      <ArrowUpRight className="h-3.5 w-3.5" />
                      Abrir
                    </Link>
                    <a
                      href={`/seo/${slug}/report/${r.period}?print=true`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-md border border-white/12 bg-white/[0.04] px-2.5 py-1 text-[11px] font-medium text-white/80 transition hover:border-[#783DF5]/40 hover:bg-white/[0.08] hover:text-white"
                      title={`Gerar PDF do relatório de ${r.periodLabel}`}
                    >
                      <FileDown className="h-3.5 w-3.5" />
                      PDF
                    </a>
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </section>
  );
}
